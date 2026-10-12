import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';
import { isDecimal, scaleOf } from '@ef/policy-core';
import { computeQuote, minorUnitsOf, type RateSnapshot } from '@ef/workflow-core';
import type { Problem } from '../shared';
import { checkRequest, deskConfig, DeskValidationError, quoteCurrencyFor, quoteView, validateDesk } from './desk';
import { parseRulesFile, RulesFileError, type RulesFile } from './rules';

/** One third-party host, for Alterna's logo only (product owner, 2026-10-12; DL-N37). Nothing else leaves the origin. */
export const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://www.alterna.ca; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const MAX_BODY = 8 * 1024;
export const LOOPBACK_HOSTS: readonly string[] = ['127.0.0.1', 'localhost', '::1'];

export interface DeskOptions {
  rulesFile: string;
  /** Built SPA to serve; omitted in dev (Vite serves the page). */
  staticDir?: string;
  rates: { get(currency: string): Promise<RateSnapshot | null> };
  now?: () => Date;
  recordNo?: (at: Date) => string;
  /** Receives method, path, status and short operational notes. Never bodies, query strings or error messages. */
  log?: (line: string) => void;
}

/** Re-reads the rules file on each use and recompiles only when its content changes. A bad file makes every check unavailable, never a guess. */
export class RulesSource {
  private cached: { hash: string; rules: RulesFile | null; issues: string[] } | null = null;
  constructor(private path: string, private log?: (line: string) => void) {}
  load(): { rules: RulesFile } | { issues: string[] } {
    let text: string;
    try { text = readFileSync(this.path, 'utf8'); } catch { return { issues: ['rules file not found'] }; }
    const hash = createHash('sha256').update(text).digest('hex');
    if (!this.cached || this.cached.hash !== hash) {
      try {
        const rules = parseRulesFile(JSON.parse(text));
        this.cached = { hash, rules, issues: [] };
        this.log?.(`rules loaded: ${rules.ruleSetId} ${rules.version} ${rules.status} file-sha256 ${hash.slice(0, 16)}`);
      } catch (e) {
        this.cached = { hash, rules: null, issues: e instanceof RulesFileError ? e.issues : ['rules file is not valid JSON'] };
        this.log?.(`rules file not usable: ${this.cached.issues.join('; ')}`);
      }
    }
    return this.cached.rules ? { rules: this.cached.rules } : { issues: this.cached.issues };
  }
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function newRecordNo(at: Date): string {
  const d = at.toISOString().slice(0, 10).replace(/-/g, '');
  const tail = [...randomBytes(6)].map(b => CROCKFORD[b % 32]).join('');
  return `EFD-${d}-${tail}`;
}

/** Fixed-window limiter per client address; old entries are pruned. */
class Limiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs = 60_000) {}
  allow(key: string, t: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter(x => t - x < this.windowMs);
    if (recent.length >= this.max) { this.hits.set(key, recent); return false; }
    recent.push(t); this.hits.set(key, recent);
    if (this.hits.size > 1000) for (const [k, v] of this.hits) if (!v.some(x => t - x < this.windowMs)) this.hits.delete(k);
    return true;
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', status >= 400 ? 'application/problem+json' : 'application/json');
  res.end(JSON.stringify(body));
}
const problem = (res: ServerResponse, status: number, p: Problem) => send(res, status, { status, ...p });

class TooLarge extends Error {}
async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []; let total = 0;
  for await (const c of req) {
    total += (c as Buffer).length;
    if (total > MAX_BODY) throw new TooLarge();
    chunks.push(c as Buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Only loopback host names are served, whatever the port: a rebinding attacker's host name is refused (DESK-SEC-06). */
export function hostAllowed(host: string | undefined): boolean {
  if (!host) return false;
  try { return LOOPBACK_HOSTS.includes(new URL(`http://${host}`).hostname.replace(/^\[|\]$/g, '')); } catch { return false; }
}

/** Same-origin only: a cross-site page cannot post JSON here without a CORS preflight we never answer, and a present Origin must match Host. */
function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}

const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

export function createDeskHandler(o: DeskOptions) {
  const source = new RulesSource(o.rulesFile, o.log);
  const now = o.now ?? (() => new Date());
  const recordNo = o.recordNo ?? newRecordNo;
  const quoteLimit = new Limiter(60), checkLimit = new Limiter(30);
  const root = o.staticDir ? resolve(o.staticDir) : undefined;

  const handle = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (!hostAllowed(req.headers.host)) return problem(res, 403, { code: 'FORBIDDEN', title: 'Request refused.' });
    const url = new URL(req.url ?? '/', 'http://desk.local');
    const path = url.pathname;
    const client = req.socket.remoteAddress ?? 'local';

    if (path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
      if (path === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true });

      const loaded = source.load();
      if ('issues' in loaded) return problem(res, 503, { code: 'RULES_UNAVAILABLE', title: 'The head-office rules could not be loaded.' });
      const rules = loaded.rules;

      if (path === '/api/config' && req.method === 'GET') return send(res, 200, deskConfig(rules));

      if (path === '/api/quote' && req.method === 'GET') {
        if (!quoteLimit.allow(client, now().getTime())) return problem(res, 429, { code: 'RATE_LIMITED', title: 'Too many estimates. Wait a moment.' });
        const sellAmount = url.searchParams.get('sellAmount') ?? '', sellCurrency = url.searchParams.get('sellCurrency') ?? '', buyCurrency = url.searchParams.get('buyCurrency') ?? '';
        const scale = minorUnitsOf(sellCurrency);
        // Only currencies head office lists, and only amounts the check itself would accept (DESK-SEC-03, DESK-QA-10).
        if (!rules.currencies.includes(sellCurrency) || !rules.currencies.includes(buyCurrency) || scale === undefined) return send(res, 200, { available: false, reason: 'UNSUPPORTED_PAIR' });
        if (!isDecimal(sellAmount) || sellAmount.startsWith('-') || scaleOf(sellAmount) > scale) return send(res, 200, { available: false, reason: 'INVALID_AMOUNT' });
        const foreign = quoteCurrencyFor(sellCurrency, buyCurrency);
        const snap = foreign ? await o.rates.get(foreign) : null;
        const view = quoteView(computeQuote({ amount: sellAmount, currency: sellCurrency }, buyCurrency, snap));
        return send(res, 200, view ? { available: true, quote: view } : { available: false, reason: 'NO_ESTIMATE' });
      }

      if (path === '/api/check' && req.method === 'POST') {
        if (!sameOrigin(req)) return problem(res, 403, { code: 'FORBIDDEN', title: 'Request refused.' });
        if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return problem(res, 415, { code: 'UNSUPPORTED_MEDIA_TYPE', title: 'Send JSON.' });
        if (!checkLimit.allow(client, now().getTime())) return problem(res, 429, { code: 'RATE_LIMITED', title: 'Too many checks. Wait a moment.' });
        let body: unknown;
        try { body = await readJson(req); } catch (e) {
          if (e instanceof TooLarge) { res.setHeader('Connection', 'close'); problem(res, 413, { code: 'TOO_LARGE', title: 'The request is too large.' }); req.destroy(); return; }
          return problem(res, 400, { code: 'BAD_REQUEST', title: 'The request could not be read.' });
        }
        const at = now();
        try {
          // Validate first, then fetch the rate for validated, listed currencies only; the check itself is pure.
          const valid = validateDesk(body, rules);
          const foreign = quoteCurrencyFor(valid.values.sell.currency, valid.values.buyCurrency);
          const snap = foreign ? await o.rates.get(foreign) : null;
          return send(res, 200, checkRequest(body, rules, at.toISOString(), recordNo(at), snap));
        } catch (e) {
          if (e instanceof DeskValidationError) return problem(res, 422, { code: 'VALIDATION', title: 'Some fields need fixing.', issues: e.issues });
          throw e;
        }
      }
      return problem(res, 404, { code: 'NOT_FOUND', title: 'Not found.' });
    }

    if (!root || (req.method !== 'GET' && req.method !== 'HEAD')) return problem(res, 404, { code: 'NOT_FOUND', title: 'Not found.' });
    let file = normalize(join(root, decodeURIComponent(path)));
    if (file !== root && !file.startsWith(root + sep)) return problem(res, 404, { code: 'NOT_FOUND', title: 'Not found.' });
    try { if (statSync(file).isDirectory()) file = join(file, 'index.html'); } catch { file = join(root, 'index.html'); }
    try { statSync(file); } catch { return problem(res, 404, { code: 'NOT_FOUND', title: 'Not found.' }); }
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', file.includes(`${sep}assets${sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache');
    await new Promise<void>(done => pipeline(createReadStream(file), res, err => {
      if (err && !res.headersSent) problem(res, 500, { code: 'INTERNAL', title: 'Something went wrong.' });
      done();
    }));
  };

  return (req: IncomingMessage, res: ServerResponse) => {
    handle(req, res)
      .catch(e => {
        o.log?.(`unexpected error: ${e instanceof Error ? e.constructor.name : typeof e}`);
        if (!res.headersSent) problem(res, 500, { code: 'INTERNAL', title: 'Something went wrong.' }); else res.end();
      })
      .finally(() => o.log?.(`${req.method} ${(req.url ?? '').split('?')[0]} ${res.statusCode}`));
  };
}
