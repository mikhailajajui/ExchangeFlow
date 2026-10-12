import { z } from 'zod';
import { feedIdOf, type RateSnapshot } from '@ef/workflow-core';
import type { RateProvider } from '@ef/ports';

/** The only host the feed may be fetched from. A different EF_RATE_URL is refused at start-up. */
export const ALLOWED_RATE_HOSTS: readonly string[] = ['uexchange.ca'];
export const DEFAULT_RATE_URL = 'https://uexchange.ca/get-currency-rate';

export interface RateProviderOptions {
  url?: string;
  fetch?: typeof fetch;
  /** Milliseconds since epoch; injected in tests. */
  now?: () => number;
  timeoutMs?: number;
  maxBytes?: number;
  ttlMs?: number;
  staleMs?: number;
  /** Receives a short failure class only, never the response body. */
  onError?: (reason: string) => void;
}

/** https only, exact host allow-list, no credentials, default port. Throws on anything else. */
export function assertRateUrl(raw: string): URL {
  let u: URL;
  try { u = new URL(raw); } catch { throw new Error('refusing to start: EF_RATE_URL is not a valid URL'); }
  if (u.protocol !== 'https:') throw new Error('refusing to start: EF_RATE_URL must use https');
  if (!ALLOWED_RATE_HOSTS.includes(u.hostname)) throw new Error(`refusing to start: EF_RATE_URL host must be one of ${ALLOWED_RATE_HOSTS.join(', ')}`);
  if (u.username || u.password || u.port) throw new Error('refusing to start: EF_RATE_URL must not carry credentials or a port');
  return u;
}

const POSITIVE_DECIMAL = /^\d{1,12}(\.\d{1,12})?$/;
const positiveDecimal = z.string().regex(POSITIVE_DECIMAL).refine(s => !/^0+(\.0+)?$/.test(s), 'must be positive');

const Feed = z.object({ rates: z.array(z.unknown()) });
const Entry = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  currency_code: z.string(),
  buy_value: positiveDecimal,
  sell_value: positiveDecimal,
  last_update: z.string().regex(/^[0-9T:\-. Z+]{10,32}$/),
  is_visible: z.literal('y'),
});

class FeedError extends Error {}

export class UexchangeRateProvider implements RateProvider {
  private url: URL;
  private f: typeof fetch;
  private now: () => number;
  private timeoutMs: number; private maxBytes: number; private ttlMs: number; private staleMs: number;
  private cache = new Map<string, { snap: RateSnapshot; at: number }>();
  private inflight = new Map<string, Promise<RateSnapshot>>();

  constructor(private opts: RateProviderOptions = {}) {
    this.url = assertRateUrl(opts.url ?? DEFAULT_RATE_URL);
    this.f = opts.fetch ?? fetch;
    this.now = opts.now ?? Date.now;
    this.timeoutMs = opts.timeoutMs ?? 5000;
    this.maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
    this.ttlMs = opts.ttlMs ?? 60_000;
    this.staleMs = opts.staleMs ?? 10 * 60_000;
  }

  async get(currency: string): Promise<RateSnapshot | null> {
    const feedId = feedIdOf(currency);
    if (feedId === undefined) return null;
    const hit = this.cache.get(currency);
    if (hit && this.now() - hit.at < this.ttlMs) return hit.snap;
    try {
      let p = this.inflight.get(currency);
      if (!p) { p = this.load(currency, feedId).finally(() => this.inflight.delete(currency)); this.inflight.set(currency, p); }
      return await p;
    } catch (e) {
      this.opts.onError?.(e instanceof FeedError ? e.message : 'FETCH_FAILED');
      if (hit && this.now() - hit.at <= this.staleMs) return { ...hit.snap, stale: true };
      return null;
    }
  }

  private async load(currency: string, feedId: string): Promise<RateSnapshot> {
    const body = await this.download();
    const feed = Feed.safeParse(body);
    if (!feed.success) throw new FeedError('BAD_SHAPE');
    const raw = feed.data.rates.find(e => typeof e === 'object' && e !== null && String((e as { id?: unknown }).id) === feedId);
    if (raw === undefined) throw new FeedError('ENTRY_MISSING');
    const entry = Entry.safeParse(raw);
    if (!entry.success || entry.data.currency_code !== currency) throw new FeedError('BAD_ENTRY');
    const e = entry.data;
    const snap: RateSnapshot = {
      currency, feedId, buy: e.buy_value, sell: e.sell_value, feedUpdatedAt: e.last_update,
      fetchedAt: new Date(this.now()).toISOString(), stale: false,
    };
    this.cache.set(currency, { snap, at: this.now() });
    return snap;
  }

  /** Same-host redirects only (at most 2); anything else is a failure. The body is read with a hard size cap. */
  private async download(): Promise<unknown> {
    let url = this.url;
    for (let hop = 0; hop < 3; hop++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), this.timeoutMs);
      try {
        const res = await this.f(url.toString(), { redirect: 'manual', signal: ctl.signal, headers: { accept: 'application/json' }, credentials: 'omit' });
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get('location');
          if (!loc) throw new FeedError('REDIRECT');
          try { url = assertRateUrl(new URL(loc, url).toString()); } catch { throw new FeedError('REDIRECT_REFUSED'); }
          await res.body?.cancel().catch(() => {});
          continue;
        }
        if (!res.ok) throw new FeedError('HTTP_STATUS');
        const len = Number(res.headers.get('content-length'));
        if (Number.isFinite(len) && len > this.maxBytes) throw new FeedError('TOO_LARGE');
        const text = await this.readCapped(res);
        try { return JSON.parse(text); } catch { throw new FeedError('BAD_JSON'); }
      } finally { clearTimeout(timer); }
    }
    throw new FeedError('TOO_MANY_REDIRECTS');
  }

  private async readCapped(res: Response): Promise<string> {
    if (!res.body) throw new FeedError('NO_BODY');
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > this.maxBytes) { await reader.cancel().catch(() => {}); throw new FeedError('TOO_LARGE'); }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
}

export function createRateProvider(opts: RateProviderOptions = {}): RateProvider { return new UexchangeRateProvider(opts); }
