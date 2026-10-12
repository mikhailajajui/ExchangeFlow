import { describe, it, expect } from 'vitest';
import { UexchangeRateProvider, assertRateUrl, DEFAULT_RATE_URL } from '../src';

const entry = (o: Record<string, unknown> = {}) => ({
  id: '20', currency_code: 'USD', buy_value: '1.3900', sell_value: '1.4499', spot_rate: '0.7015', last_update: '2026-10-01 19:03:18', is_visible: 'y', round_up: '10', ...o,
});
const feed = (rates: unknown[] = [{ id: '1', currency_code: 'EUR', buy_value: 'x' }, entry()]) => ({ last_update: '2026-10-01 19:03:18', rates });
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' }, ...init });

function harness(handler: (url: string, n: number) => Response | Promise<Response>, opts: { now?: () => number } = {}) {
  const calls: string[] = [];
  let t = Date.parse('2026-10-02T12:00:00.000Z');
  const clock = { now: () => t, advance: (ms: number) => { t += ms; } };
  const fetchFn = (async (url: string | URL, init?: RequestInit) => {
    calls.push(String(url));
    if (init?.signal?.aborted) throw new Error('aborted');
    return handler(String(url), calls.length);
  }) as typeof fetch;
  const errors: string[] = [];
  const p = new UexchangeRateProvider({ fetch: fetchFn, now: opts.now ?? clock.now, onError: r => errors.push(r) });
  return { p, calls, clock, errors };
}

describe('URL rules (fail closed at start-up)', () => {
  it('accepts the default and refuses other hosts, http, credentials, ports and look-alikes', () => {
    expect(assertRateUrl(DEFAULT_RATE_URL).hostname).toBe('uexchange.ca');
    for (const bad of ['http://uexchange.ca/get-currency-rate', 'https://evil.example/get-currency-rate', 'https://uexchange.ca.evil.example/x', 'https://www.uexchange.ca/x',
      'https://user:pw@uexchange.ca/x', 'https://uexchange.ca:8443/x', 'ftp://uexchange.ca/x', 'not a url', '']) {
      expect(() => assertRateUrl(bad), bad).toThrow(/refusing to start/);
    }
    expect(() => new UexchangeRateProvider({ url: 'https://evil.example/' })).toThrow(/refusing to start/);
  });
});

describe('parsing', () => {
  it('selects entry id 20 from the list and returns a snapshot', async () => {
    const { p, calls } = harness(() => json(feed()));
    const s = await p.get('USD');
    expect(s).toEqual({ currency: 'USD', feedId: '20', buy: '1.3900', sell: '1.4499', feedUpdatedAt: '2026-10-01 19:03:18', fetchedAt: '2026-10-02T12:00:00.000Z', stale: false });
    expect(calls).toEqual([DEFAULT_RATE_URL]); // no id parameter: the feed ignores it
  });
  it('never uses round_up or spot_rate', async () => {
    const s = await harness(() => json(feed([entry({ round_up: '999', spot_rate: '9.9' })]))).p.get('USD');
    expect(s).not.toHaveProperty('round_up'); expect(s).not.toHaveProperty('spot_rate');
  });
  it('an unconfigured currency returns null without a request', async () => {
    const { p, calls } = harness(() => json(feed()));
    expect(await p.get('EUR')).toBeNull(); expect(calls).toHaveLength(0);
  });
  const bad: [string, unknown][] = [
    ['missing entry', feed([{ id: '1' }])],
    ['not visible', feed([entry({ is_visible: 'n' })])],
    ['zero buy', feed([entry({ buy_value: '0.0000' })])],
    ['negative sell', feed([entry({ sell_value: '-1.4499' })])],
    ['non-decimal buy', feed([entry({ buy_value: '1,39' })])],
    ['number instead of string', feed([entry({ sell_value: 1.4499 })])],
    ['exponent', feed([entry({ sell_value: '1e0' })])],
    ['wrong currency code', feed([entry({ currency_code: 'EUR' })])],
    ['html in last_update', feed([entry({ last_update: '<img src=x onerror=alert(1)>' })])],
    ['no rates array', { rates: 'x' }],
    ['not an object', [1, 2]],
  ];
  for (const [name, body] of bad) {
    it(`rejects ${name} and reports no rate`, async () => {
      const { p, errors } = harness(() => json(body));
      expect(await p.get('USD')).toBeNull(); expect(errors).toHaveLength(1);
    });
  }
  it('a bad entry elsewhere in the list does not matter', async () => {
    expect((await harness(() => json(feed([{ id: '5', buy_value: 'junk' }, entry()]))).p.get('USD'))?.buy).toBe('1.3900');
  });
  it('rejects non-JSON and error statuses', async () => {
    expect(await harness(() => new Response('<html>', { status: 200 })).p.get('USD')).toBeNull();
    expect(await harness(() => new Response('{}', { status: 500 })).p.get('USD')).toBeNull();
    expect(await harness(() => { throw new Error('network'); }).p.get('USD')).toBeNull();
  });
});

describe('limits', () => {
  it('rejects a body over 2 MB, by header and by streaming', async () => {
    const huge = 'x'.repeat(2 * 1024 * 1024 + 10);
    expect(await harness(() => new Response(huge, { status: 200, headers: { 'content-length': String(huge.length) } })).p.get('USD')).toBeNull();
    const h = harness(() => new Response(huge, { status: 200 }));
    expect(await h.p.get('USD')).toBeNull(); expect(h.errors).toEqual(['TOO_LARGE']);
  });
  it('aborts after the timeout', async () => {
    const p = new UexchangeRateProvider({ timeoutMs: 20, fetch: ((_u: unknown, init?: RequestInit) => new Promise((_, rej) => init!.signal!.addEventListener('abort', () => rej(new Error('aborted'))))) as typeof fetch });
    expect(await p.get('USD')).toBeNull();
  });
});

describe('redirects', () => {
  it('refuses a redirect to another host and sends no second request there', async () => {
    const { p, calls, errors } = harness(() => new Response(null, { status: 302, headers: { location: 'https://evil.example/rates' } }));
    expect(await p.get('USD')).toBeNull(); expect(calls).toEqual([DEFAULT_RATE_URL]); expect(errors).toEqual(['REDIRECT_REFUSED']);
  });
  it('refuses a downgrade to http on the same host', async () => {
    const { p, calls } = harness(() => new Response(null, { status: 301, headers: { location: 'http://uexchange.ca/get-currency-rate' } }));
    expect(await p.get('USD')).toBeNull(); expect(calls).toHaveLength(1);
  });
  it('follows a same-host https redirect', async () => {
    const { p, calls } = harness((_u, n) => n === 1 ? new Response(null, { status: 301, headers: { location: '/v2/get-currency-rate' } }) : json(feed()));
    expect((await p.get('USD'))?.sell).toBe('1.4499'); expect(calls).toEqual([DEFAULT_RATE_URL, 'https://uexchange.ca/v2/get-currency-rate']);
  });
  it('gives up on a redirect loop', async () => {
    const { p } = harness(() => new Response(null, { status: 302, headers: { location: '/again' } }));
    expect(await p.get('USD')).toBeNull();
  });
});

describe('cache: 60 s TTL, stale-if-error up to 10 minutes', () => {
  it('serves from cache inside the TTL, refetches after it', async () => {
    let sell = '1.4499';
    const { p, calls, clock } = harness(() => json(feed([entry({ sell_value: sell })])));
    await p.get('USD'); await p.get('USD'); expect(calls).toHaveLength(1);
    clock.advance(59_000); await p.get('USD'); expect(calls).toHaveLength(1);
    sell = '1.5000'; clock.advance(2_000);
    const s = await p.get('USD'); expect(calls).toHaveLength(2); expect(s).toMatchObject({ sell: '1.5000', stale: false, fetchedAt: '2026-10-02T12:01:01.000Z' });
  });
  it('concurrent callers share one request', async () => {
    const { p, calls } = harness(async () => { await new Promise(r => setTimeout(r, 10)); return json(feed()); });
    await Promise.all([p.get('USD'), p.get('USD'), p.get('USD')]); expect(calls).toHaveLength(1);
  });
  it('on failure serves the cached snapshot flagged stale, up to 10 minutes, then nothing', async () => {
    let fail = false;
    const { p, clock } = harness(() => fail ? new Response('', { status: 503 }) : json(feed()));
    const fresh = await p.get('USD'); expect(fresh?.stale).toBe(false);
    fail = true; clock.advance(61_000);
    const stale = await p.get('USD');
    expect(stale).toMatchObject({ stale: true, buy: '1.3900', fetchedAt: fresh!.fetchedAt });
    clock.advance(9 * 60_000); // now 10 min 1 s after the fetch: too old
    expect(await p.get('USD')).toBeNull();
  });
  it('recovers when the feed comes back', async () => {
    let fail = true;
    const { p, clock } = harness(() => fail ? new Response('', { status: 503 }) : json(feed()));
    expect(await p.get('USD')).toBeNull();
    fail = false; clock.advance(1);
    expect((await p.get('USD'))?.stale).toBe(false);
  });
  it('a bad response never overwrites a good cached value', async () => {
    let body: unknown = feed();
    const { p, clock } = harness(() => json(body));
    await p.get('USD'); body = feed([entry({ buy_value: '0' })]); clock.advance(61_000);
    expect(await p.get('USD')).toMatchObject({ buy: '1.3900', stale: true });
  });
});
