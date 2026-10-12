import 'reflect-metadata';
import { describe, it, expect } from 'vitest';
import { securityHeaders, cookieNames, cookieOptions, resolveEnvironment, CsrfMiddleware, CSP, RateLimiter } from '../src/http';

const run = (url: string) => {
  const h: Record<string, string> = {};
  let called = false;
  securityHeaders({ originalUrl: url }, { setHeader: (k: string, v: string) => { h[k] = v; } } as never, () => { called = true; });
  return { h, called };
};

describe('security headers (UI-SEC-07/08/12)', () => {
  it('sets the full set on every response and Cache-Control no-store on /api', () => {
    const { h, called } = run('/api/requests');
    expect(called).toBe(true);
    expect(h['Content-Security-Policy']).toBe(CSP);
    expect(CSP).toContain("default-src 'self'"); expect(CSP).toContain("frame-ancestors 'none'"); expect(CSP).toContain("object-src 'none'"); expect(CSP).toContain("style-src 'self'");
    expect(CSP).not.toMatch(/unsafe-inline|unsafe-eval|https?:/);
    expect(h['Referrer-Policy']).toBe('no-referrer');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(h['Cache-Control']).toBe('no-store');
  });
  it('does not mark static assets no-store', () => { expect(run('/assets/app.js').h['Cache-Control']).toBeUndefined(); });
});

describe('production hardening (UI-SEC-10/11)', () => {
  it('EF_ENV defaults to prod and anything but dev, test or prod refuses to start', () => {
    expect(resolveEnvironment(undefined)).toBe('prod');
    expect(resolveEnvironment('dev')).toBe('dev'); expect(resolveEnvironment('test')).toBe('test');
    expect(() => resolveEnvironment('production')).toThrow(/refusing to start/);
    expect(() => resolveEnvironment('')).toThrow(/refusing to start/);
  });
  it('prod cookies are Secure, SameSite=Strict and __Host- prefixed; dev cookies are not', () => {
    expect(cookieNames('prod')).toEqual({ session: '__Host-ef_session', csrf: '__Host-ef_csrf' });
    expect(cookieOptions('prod')).toMatchObject({ secure: true, sameSite: 'strict', path: '/' });
    expect(cookieNames('dev').session).toBe('ef_session');
    expect(cookieOptions('dev')).toMatchObject({ secure: false, sameSite: 'lax' });
  });
  it('the CSRF origin check allows a localhost origin outside prod and refuses it in prod', () => {
    const attempt = (env: 'dev' | 'prod') => {
      const mw = new CsrfMiddleware({ environment: env });
      const out: { status?: number; next?: boolean } = {};
      const res = { status: (s: number) => { out.status = s; return res; }, type: () => res, json: () => res };
      const names = cookieNames(env);
      mw.use({ method: 'POST', originalUrl: '/api/requests', headers: { origin: 'http://localhost:5173', host: 'app.example', 'x-csrf-token': 't' }, cookies: { [names.csrf]: 't' } } as never, res as never, () => { out.next = true; });
      return out;
    };
    expect(attempt('dev').next).toBe(true);
    expect(attempt('prod')).toMatchObject({ status: 403 });
  });
  it('a malformed Origin header is refused, not a server error', () => {
    const mw = new CsrfMiddleware({ environment: 'dev' });
    let status = 0; const res = { status: (s: number) => { status = s; return res; }, type: () => res, json: () => res };
    mw.use({ method: 'POST', originalUrl: '/api/requests', headers: { origin: 'null', host: 'x' }, cookies: {} } as never, res as never, () => {});
    expect(status).toBe(403);
  });
});

describe('quote rate limit (30 per minute per session)', () => {
  const hit = (l: RateLimiter, k: string) => { try { l.check(k); return 'ok'; } catch (e: any) { return `${e.code}:${e.status}`; } };
  it('allows 30, then answers RATE_LIMITED (429), then resets after the window', () => {
    let t = 1_000_000; const l = new RateLimiter(30, 60_000, () => t);
    for (let i = 0; i < 30; i++) expect(hit(l, 's1')).toBe('ok');
    expect(hit(l, 's1')).toBe('RATE_LIMITED:429');
    t += 59_999; expect(hit(l, 's1')).toBe('RATE_LIMITED:429');
    t += 1; expect(hit(l, 's1')).toBe('ok');
  });
  it('counts each session separately', () => {
    const l = new RateLimiter(2, 60_000, () => 0);
    expect(hit(l, 'a')).toBe('ok'); expect(hit(l, 'a')).toBe('ok'); expect(hit(l, 'a')).toBe('RATE_LIMITED:429');
    expect(hit(l, 'b')).toBe('ok');
  });
});
