import { Injectable, type NestMiddleware, Catch, type ExceptionFilter, type ArgumentsHost, HttpException, Inject } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import type pg from 'pg';
import { resolveSession } from '@ef/adapter-postgres';
import { AppError } from '@ef/app-services';
import type { Actor } from '@ef/ports';

export const POOL = 'POOL', SERVICES = 'SERVICES', CONFIG = 'CONFIG', QUOTE_LIMITER = 'QUOTE_LIMITER';
export interface ApiConfig { environment: 'dev' | 'test' | 'prod' }
export type Req = Request & { actor?: Actor };

export type Environment = ApiConfig['environment'];
const ENVIRONMENTS: readonly Environment[] = ['dev', 'test', 'prod'];

/** Fail closed: an unset EF_ENV is production, and any value other than dev, test or prod refuses to start. `pnpm dev` sets EF_ENV=dev explicitly. */
export function resolveEnvironment(raw: string | undefined): Environment {
  const env = raw ?? 'prod';
  if (!ENVIRONMENTS.includes(env as Environment)) throw new Error(`refusing to start: EF_ENV must be one of ${ENVIRONMENTS.join(', ')} (got "${raw}")`);
  return env as Environment;
}

/** In prod the cookies carry the __Host- prefix (Secure, Path=/, no Domain) and the session is SameSite=Strict (UI-SEC-10/11). */
export const cookieNames = (env: Environment) => env === 'prod' ? { session: '__Host-ef_session', csrf: '__Host-ef_csrf' } : { session: 'ef_session', csrf: 'ef_csrf' };
export const cookieOptions = (env: Environment) => ({ sameSite: env === 'prod' ? 'strict' as const : 'lax' as const, secure: env === 'prod', path: '/', maxAge: 8 * 3600 * 1000 });

export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";

/** Security headers on every response; API responses are never cached (UI-SEC-07/08/12). */
export function securityHeaders(req: Pick<Request, 'originalUrl'>, res: Pick<Response, 'setHeader'>, next: NextFunction) {
  res.setHeader('Content-Security-Policy', CSP);
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.originalUrl.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  next();
}

export const newCsrf = () => randomBytes(18).toString('hex');

/** Loads the actor from the server-side session on every request. The browser holds only an opaque, HttpOnly cookie. */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  private cookie: string;
  constructor(@Inject(POOL) private pool: pg.Pool, @Inject(CONFIG) cfg: ApiConfig) { this.cookie = cookieNames(cfg.environment).session; }
  async use(req: Req, _res: Response, next: NextFunction) {
    const sid = req.cookies?.[this.cookie];
    if (sid && typeof sid === 'string') req.actor = (await resolveSession(this.pool, sid)) ?? undefined;
    next();
  }
}

/** CSRF: double-submit token on every state change, plus a same-origin check. */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private cookie: string; private allowLocalhost: boolean;
  constructor(@Inject(CONFIG) cfg: ApiConfig) { this.cookie = cookieNames(cfg.environment).csrf; this.allowLocalhost = cfg.environment !== 'prod'; }
  use(req: Req, res: Response, next: NextFunction) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    if (req.method === 'POST' && req.originalUrl.split('?')[0] === '/api/session') return next(); // login establishes the token
    const origin = req.headers.origin;
    let originHost: string | null = null;
    try { originHost = origin ? new URL(origin).host : null; } catch { /* malformed origin is refused below */ }
    if (origin && originHost !== req.headers.host && !(this.allowLocalhost && /^https?:\/\/localhost:\d+$/.test(origin))) {
      return problem(res, new AppError('FORBIDDEN', 'Cross-origin request refused'));
    }
    const c = String(req.cookies?.[this.cookie] ?? ''), h = String(req.headers['x-csrf-token'] ?? '');
    if (!c || c.length !== h.length || !timingSafeEqual(Buffer.from(c), Buffer.from(h))) {
      return problem(res, new AppError('FORBIDDEN', 'Missing or invalid CSRF token'));
    }
    next();
  }
}

/** Fixed-window limiter per key (a session). In memory: enough for one API process, replaced by a shared store when the API scales out. */
export class RateLimiter {
  private hits = new Map<string, { start: number; n: number }>();
  constructor(private limit = 30, private windowMs = 60_000, private now: () => number = Date.now) {}
  /** Throws RATE_LIMITED when the key has used its allowance in the current window. */
  check(key: string): void {
    const t = this.now();
    const h = this.hits.get(key);
    if (!h || t - h.start >= this.windowMs) {
      if (this.hits.size > 10_000) for (const [k, v] of this.hits) if (t - v.start >= this.windowMs) this.hits.delete(k);
      this.hits.set(key, { start: t, n: 1 }); return;
    }
    if (h.n >= this.limit) throw new AppError('RATE_LIMITED', 'Too many requests. Wait a moment and try again.');
    h.n++;
  }
}

export function actorOf(req: Req): Actor {
  if (!req.actor) throw new AppError('UNAUTHENTICATED', 'Sign in first');
  return req.actor;
}

function problem(res: Response, e: AppError) {
  res.status(e.status).type('application/problem+json').json({
    type: `https://exchangeflow.local/problems/${e.code}`, title: e.code, status: e.status, code: e.code, detail: e.message, ...e.extra,
  });
}

/** RFC 9457 problem details with stable codes. Unknown errors never leak internals. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  catch(err: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (err instanceof AppError) return problem(res, err);
    if (err instanceof HttpException) {
      const s = err.getStatus();
      return res.status(s).type('application/problem+json').json({ type: 'about:blank', title: err.message, status: s, code: s === 404 ? 'NOT_FOUND' : 'HTTP_ERROR' });
    }
    console.error('[api] unhandled error', err instanceof Error ? err.stack : err);
    res.status(500).type('application/problem+json').json({ type: 'about:blank', title: 'Internal error', status: 500, code: 'INTERNAL' });
  }
}
