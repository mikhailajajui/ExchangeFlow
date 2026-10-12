import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createServer, request, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canonicalJson } from '@ef/policy-core';
import { minorUnitsOf, quoteCurrencyFor, type RateSnapshot } from '@ef/workflow-core';
import { checkRequest, DeskValidationError } from '../src/server/desk';
import { parseRulesFile, RulesFileError, type RulesFile } from '../src/server/rules';
import { createDeskHandler, hostAllowed } from '../src/server/app';

const shipped = JSON.parse(readFileSync(resolve(__dirname, '../rules/branch-rules.json'), 'utf8'));
const rules: RulesFile = parseRulesFile(shipped);
const withRules = (over: Record<string, unknown>) => parseRulesFile({ ...shipped, ...over });
// Toronto is UTC-4 (EDT) until 2026-11-01, then UTC-5 (EST).
const TUE_1100 = '2026-10-13T15:00:00.000Z';
const SAT_1100 = '2026-10-17T15:00:00.000Z';
const USD: RateSnapshot = { currency: 'USD', feedId: '20', buy: '1.3500', sell: '1.4499', feedUpdatedAt: '2026-10-13 10:58:00', fetchedAt: TUE_1100, stale: false };

const body = (over: Record<string, unknown> = {}, values: Record<string, unknown> = {}) => ({
  branchId: 'BR-TOR', tellerId: 'T1234', ...over,
  values: { requestType: 'EXCHANGE', sell: { amount: '500.00', currency: 'CAD' }, buyCurrency: 'USD', paymentMethod: 'CASH', memberName: 'Jeanne Tremblay', ...values },
});
const cad = (amount: string) => body({}, { sell: { amount, currency: 'CAD' } });
const usd = (amount: string) => body({}, { sell: { amount, currency: 'USD' }, buyCurrency: 'CAD' });
const check = (b: unknown, at = TUE_1100, r = rules, rate: RateSnapshot | null = USD) => checkRequest(b, r, at, 'EFD-TEST-1', rate);

describe('decision table: interim rules (CAD up to 1,500.00, USD up to 2,000.00, Mon to Fri 09:00 to 17:00)', () => {
  it.each([
    ['500.00 CAD, Tuesday 11:00', cad('500.00'), TUE_1100, 'WITHIN_LIMITS'],
    ['1500.00 CAD, at the limit', cad('1500.00'), TUE_1100, 'WITHIN_LIMITS'],
    ['1500.01 CAD, above the limit', cad('1500.01'), TUE_1100, 'NOT_AT_BRANCH'],
    ['1000 CAD without decimals', cad('1000'), TUE_1100, 'WITHIN_LIMITS'],
    ['2000.00 USD to CAD, at the limit', usd('2000.00'), TUE_1100, 'WITHIN_LIMITS'],
    ['2000.01 USD to CAD, above the limit', usd('2000.01'), TUE_1100, 'NOT_AT_BRANCH'],
    ['1600.00 USD to CAD (above the CAD limit, within the USD limit)', usd('1600.00'), TUE_1100, 'WITHIN_LIMITS'],
    ['500.00 CAD, Saturday', cad('500.00'), SAT_1100, 'HEAD_OFFICE_REVIEW'],
    ['5000.00 CAD, Saturday: review beats decline', cad('5000.00'), SAT_1100, 'HEAD_OFFICE_REVIEW'],
    ['Sunday', cad('500.00'), '2026-10-18T15:00:00.000Z', 'HEAD_OFFICE_REVIEW'],
    ['08:59:59 EDT', cad('500.00'), '2026-10-13T12:59:59.000Z', 'HEAD_OFFICE_REVIEW'],
    ['09:00:00 EDT', cad('500.00'), '2026-10-13T13:00:00.000Z', 'WITHIN_LIMITS'],
    ['16:59:59 EDT', cad('500.00'), '2026-10-13T20:59:59.000Z', 'WITHIN_LIMITS'],
    ['17:00:00 EDT', cad('500.00'), '2026-10-13T21:00:00.000Z', 'HEAD_OFFICE_REVIEW'],
    ['08:59 EST after the clock change', cad('500.00'), '2026-11-03T13:59:00.000Z', 'HEAD_OFFICE_REVIEW'],
    ['09:00 EST after the clock change', cad('500.00'), '2026-11-03T14:00:00.000Z', 'WITHIN_LIMITS'],
    ['Friday 20:00 EDT is Saturday in UTC: still Friday after hours', cad('500.00'), '2026-10-17T00:00:00.000Z', 'HEAD_OFFICE_REVIEW'],
  ])('%s', (_n, b, at, kind) => {
    expect(check(b, at).result.kind).toBe(kind);
  });

  it('a branch holiday needs head-office review', () => {
    expect(check(cad('500.00'), TUE_1100, withRules({ holidays: ['2026-10-13'] })).result.kind).toBe('HEAD_OFFICE_REVIEW');
    expect(check(cad('500.00'), TUE_1100, withRules({ holidays: ['2026-10-14'] })).result.kind).toBe('WITHIN_LIMITS');
  });

  it('uses each branch time zone', () => {
    const r = withRules({ branches: [...shipped.branches, { id: 'BR-VAN', name: 'Vancouver', timezone: 'America/Vancouver' }] });
    const van = (at: string) => check(body({ branchId: 'BR-VAN' }), at, r).result.kind;
    expect(van('2026-10-13T15:30:00.000Z')).toBe('HEAD_OFFICE_REVIEW'); // 08:30 PDT
    expect(van('2026-10-13T16:30:00.000Z')).toBe('WITHIN_LIMITS');      // 09:30 PDT
  });

  it('a pair head office has not listed cannot be done at the branch', () => {
    const r = withRules({ currencies: ['CAD', 'USD', 'EUR'], branchLimit: { ...shipped.branchLimit, EUR: '700.00' } });
    const rec = check(body({}, { buyCurrency: 'EUR' }), TUE_1100, r, null);
    expect(rec.result.kind).toBe('NOT_AT_BRANCH');
    expect(rec.quote).toBeNull();
  });

  it('turning off business hours lets a weekend request within limits through', () => {
    expect(check(cad('500.00'), SAT_1100, withRules({ businessHoursOnly: false })).result.kind).toBe('WITHIN_LIMITS');
  });
});

describe('the record', () => {
  it('quotes 500.00 CAD at sell 1.4499 as 344.85 USD, rounded down', () => {
    expect(check(body()).quote?.give).toEqual({ amount: '344.85', currency: 'USD' });
  });
  it('quotes 250.00 USD at buy 1.3500 as 337.50 CAD', () => {
    expect(check(usd('250.00')).quote?.give).toEqual({ amount: '337.50', currency: 'CAD' });
  });
  it('gives no estimate when the amount rounds down to nothing', () => {
    expect(check(cad('0.01')).quote).toBeNull();
  });
  it('the decision does not depend on the rate or its failure', () => {
    const a = check(body()), b = check(body(), TUE_1100, rules, null);
    expect(b.result).toEqual(a.result);
    expect(b.engine.contextHash).toBe(a.engine.contextHash);
  });
  it('the member name is on the record but never reaches the engine', () => {
    const a = check(body()), b = check(body({}, { memberName: 'Someone Else' }));
    expect(a.member.name).toBe('Jeanne Tremblay');
    expect(b.engine.contextHash).toBe(a.engine.contextHash);
  });
  it('never shows rule keys, routing causes, restricted words or "Approved"', () => {
    for (const b of [body(), cad('20000.00')]) {
      const text = canonicalJson(check(b));
      expect(text).not.toMatch(/HO-(OVER|PAIR|WITHIN|OUTSIDE)|GUARDRAIL|NO_MATCH|RULE_REQUIRES|COMPLIANCE|sanction|\bPEP\b|FINTRAC|screening|suspicion|approved automatically/i);
    }
  });
  it('the decline next step uses "escalate"', () => {
    expect(check(cad('1500.01')).result.nextStep).toMatch(/escalate/);
  });
  it('records which rules were used and that they are on trial', () => {
    const rec = check(body());
    expect(rec.ruleSet).toMatchObject({ id: 'HO-FX-INTERIM', status: 'TRIAL' });
    expect(rec.ruleSet.policyHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('validation', () => {
  const issues = (b: unknown) => { try { check(b); } catch (e) { if (e instanceof DeskValidationError) return e.issues; throw e; } return []; };
  it('rejects a name with digits without echoing it', () => {
    const got = issues(body({}, { memberName: 'Jean 4111 1111' }));
    expect(got.map(i => i.path)).toContain('memberName');
    expect(JSON.stringify(got)).not.toContain('4111');
  });
  it.each([
    ['unknown branch', body({ branchId: 'BR-XXX' }), 'branchId'],
    ['missing staff ID', body({ tellerId: '' }), 'tellerId'],
    ['three decimals', cad('10.001'), 'sell.amount'],
    ['zero', cad('0.00'), 'sell.amount'],
    ['same currency', body({}, { buyCurrency: 'CAD' }), 'buyCurrency'],
    ['card number in the note', body({}, { note: 'card 4111 1111 1111 1111' }), 'note'],
    ['a wire', body({}, { requestType: 'WIRE' }), 'requestType'],
    ['a payment method head office has not listed', body({}, { paymentMethod: 'OTHER' }), 'paymentMethod'],
    ['"constructor" as a currency', body({}, { sell: { amount: '5.00', currency: 'constructor' } }), 'sell.currency'],
  ])('%s', (_n, b, path) => {
    expect(issues(b).map(i => i.path)).toContain(path);
  });
});

describe('prototype keys are never currencies (DESK-SEC-03)', () => {
  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])('%s', k => {
    expect(minorUnitsOf(k)).toBeUndefined();
    expect(quoteCurrencyFor(k, 'CAD')).toBeNull();
    expect(quoteCurrencyFor('CAD', k)).toBeNull();
  });
});

describe('rules file checks', () => {
  const bad = (over: Record<string, unknown>) => { try { parseRulesFile({ ...shipped, ...over }); } catch (e) { if (e instanceof RulesFileError) return e.issues.join(' | '); throw e; } return ''; };
  it('accepts the shipped file and ignores "#" notes', () => { expect(bad({})).toBe(''); expect(bad({ '# anything': 'a note' })).toBe(''); });
  it('needs an approver to be APPROVED', () => expect(bad({ status: 'APPROVED' })).toMatch(/approvedBy/));
  it('refuses numbers that are not decimal strings', () => expect(bad({ branchLimit: { CAD: 1500, USD: '2000.00' } })).toMatch(/branchLimit/));
  it('refuses a missing currency limit', () => expect(bad({ branchLimit: { CAD: '1500.00' } })).toMatch(/USD/));
  it('refuses a limit for a currency not offered', () => expect(bad({ branchLimit: { ...shipped.branchLimit, EUR: '700.00' } })).toMatch(/EUR is not in the currencies list/));
  it('refuses an empty pair list', () => expect(bad({ supportedPairs: [] })).toMatch(/at least one pair/));
  it('refuses repeated currencies', () => expect(bad({ currencies: ['CAD', 'USD', 'CAD'] })).toMatch(/repeat/));
  it('refuses an impossible date', () => expect(bad({ approvedOn: '2026-13-45' })).toMatch(/real date/));
  it('refuses an impossible holiday', () => expect(bad({ holidays: ['2026-02-30'] })).toMatch(/real date/));
  it('refuses a time zone not written exactly', () => expect(bad({ branches: [{ id: 'B1', name: 'X', timezone: 'america/toronto' }] })).toMatch(/time zone/));
  it('refuses an email address with extra parts', () => expect(bad({ confirmationEmail: 'x?bcc=a@evil.ca' })).toMatch(/email/));
  it('refuses unknown keys', () => expect(bad({ maxPerDay: '5' })).toMatch(/Unrecognized/));
});

describe('HTTP', () => {
  let server: Server; let base = ''; let port = 0; const dir = mkdtempSync(join(tmpdir(), 'efd-'));
  const rulesFile = join(dir, 'rules.json');
  const logs: string[] = []; const rateCalls: string[] = [];
  beforeAll(async () => {
    writeFileSync(rulesFile, JSON.stringify(shipped));
    server = createServer(createDeskHandler({ rulesFile, rates: { get: async c => { rateCalls.push(c); return USD; } }, now: () => new Date(TUE_1100), log: l => logs.push(l) }));
    await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
    const a = server.address(); port = typeof a === 'object' && a ? a.port : 0; base = `http://127.0.0.1:${port}`;
  });
  afterAll(() => new Promise<void>(r => server.close(() => r())));
  const post = (b: unknown, headers: Record<string, string> = {}) => fetch(`${base}/api/check`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(b) });

  it('config lists choices but not the limits', async () => {
    const res = await fetch(`${base}/api/config`);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    const csp = res.headers.get('content-security-policy') ?? '';
    // The only third-party host is Alterna's, for images (the logo); scripts, styles, fonts and connections stay 'self'.
    expect(csp.match(/https:\/\/[^\s;]+/g)).toEqual(['https://www.alterna.ca']);
    expect(csp).toMatch(/img-src 'self' data: https:\/\/www\.alterna\.ca;/);
    const text = await res.text();
    expect(text).toContain('Toronto Main');
    expect(text).not.toMatch(/1500|2000|branchLimit/);
  });

  it('checks a request and logs no personal data', async () => {
    const res = await post(body());
    expect(res.status).toBe(200);
    const rec = await res.json();
    expect(rec.result.kind).toBe('WITHIN_LIMITS');
    expect(rec.recordNo).toMatch(/^EFD-20261013-[0-9A-Z]{6}$/);
    expect(logs.join('\n')).not.toMatch(/Jeanne|Tremblay|500\.00/);
  });

  it('does not fetch a rate for a request that fails validation', async () => {
    rateCalls.length = 0;
    const res = await post(body({}, { sell: { amount: '5.00', currency: 'constructor' } }));
    expect(res.status).toBe(422);
    expect(rateCalls).toEqual([]);
  });

  it('quotes only listed currencies and valid amounts', async () => {
    rateCalls.length = 0;
    const q = (a: string, s: string, b: string) => fetch(`${base}/api/quote?${new URLSearchParams({ sellAmount: a, sellCurrency: s, buyCurrency: b })}`).then(r => r.json());
    expect(await q('5.00', 'constructor', 'CAD')).toMatchObject({ available: false });
    expect(await q('1000.005', 'CAD', 'USD')).toMatchObject({ available: false, reason: 'INVALID_AMOUNT' });
    expect(rateCalls).toEqual([]);
    expect(await q('500.00', 'CAD', 'USD')).toMatchObject({ available: true, quote: { give: { amount: '344.85' } } });
  });

  it('returns field issues as a 422 problem', async () => {
    const res = await post(body({}, { memberName: '' }));
    expect(res.status).toBe(422);
    expect((await res.json()).issues.map((i: { path: string }) => i.path)).toContain('memberName');
  });

  it('refuses a cross-origin post', async () => {
    expect((await post(body(), { origin: 'https://evil.example' })).status).toBe(403);
  });

  it('refuses a body over 8 KB', async () => {
    expect((await post({ ...body(), pad: 'x'.repeat(9000) })).status).toBe(413);
  });

  it('refuses a request addressed to a non-loopback host name (DNS rebinding)', async () => {
    const status = await new Promise<number>((done, fail) => {
      const req = request({ host: '127.0.0.1', port, path: '/api/config', headers: { host: `evil.example:${port}` } }, res => { res.resume(); done(res.statusCode ?? 0); });
      req.on('error', fail); req.end();
    });
    expect(status).toBe(403);
    expect(hostAllowed(`localhost:5174`)).toBe(true);
    expect(hostAllowed(`[::1]:3101`)).toBe(true);
    expect(hostAllowed(undefined)).toBe(false);
  });

  it('a broken rules file stops checks instead of guessing, and a fixed one is picked up', async () => {
    writeFileSync(rulesFile, JSON.stringify({ ...shipped, branchLimit: { CAD: 'lots' } }));
    const res = await post(body());
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('RULES_UNAVAILABLE');
    writeFileSync(rulesFile, JSON.stringify(shipped));
    expect((await post(body())).status).toBe(200);
    expect(logs.some(l => l.startsWith('rules loaded: HO-FX-INTERIM'))).toBe(true);
  });
});
