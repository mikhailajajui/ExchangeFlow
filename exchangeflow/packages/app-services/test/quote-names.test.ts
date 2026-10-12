import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import pg from 'pg';
import { startEnv, values, type Env } from './helpers';
import { AppError } from '../src';
import { runOutboxRelay } from '@ef/adapter-postgres';
import type { RateProvider, RateSnapshot } from '@ef/ports';

const snapshot = (o: Partial<RateSnapshot> = {}): RateSnapshot => ({
  currency: 'USD', feedId: '20', buy: '1.3900', sell: '1.4499', feedUpdatedAt: '2026-10-01 19:03:18', fetchedAt: '2026-10-02T12:00:00.000Z', stale: false, ...o,
});

/** A provider the tests can steer. `onGet` runs on every call, before the answer. */
class FakeRates implements RateProvider {
  next: RateSnapshot | null | Error = snapshot();
  calls = 0;
  onGet: (() => Promise<void>) | null = null;
  async get(currency: string) {
    this.calls++;
    if (this.onGet) await this.onGet();
    if (this.next instanceof Error) throw this.next;
    return this.next && this.next.currency === currency ? this.next : null;
  }
}

let env: Env; const rates = new FakeRates();
beforeAll(async () => { env = await startEnv('dev', rates); });
afterAll(async () => { await env.stop(); });

const teller = () => env.actor('u-teller-tor');
const submitNew = async (amount: string, o: Record<string, unknown> = {}) => {
  const t = await teller();
  const d = await env.svc.createDraft(t, values(amount, o));
  const r = await env.svc.submit(t, d.id, crypto.randomUUID());
  return { t, id: d.id, r };
};

describe('quote at submit (FR-70 indicative rate)', () => {
  it('stores the quote with the decision and returns it: 500.00 CAD gives 344.85 USD', async () => {
    rates.next = snapshot();
    const { id, r } = await submitNew('500.00');
    expect(r.outcome).toBe('AUTO_APPROVE');
    expect(r.quote?.give).toEqual({ amount: '344.85', currency: 'USD' });
    const row = (await env.pool.query('select revision, quote from request_quote where request_id=$1', [id])).rows;
    expect(row).toHaveLength(1); expect(row[0].revision).toBe(1); expect(row[0].quote.give.amount).toBe('344.85');
    const detail = await env.svc.getRequest(await teller(), id);
    expect(detail.quote?.give).toEqual({ amount: '344.85', currency: 'USD' });
    expect(detail.quote?.snapshot).toMatchObject({ feedUpdatedAt: '2026-10-01 19:03:18', stale: false });
  });
  it('USD to CAD uses the buy rate', async () => {
    const { r } = await submitNew('100.00', { sell: { amount: '100.00', currency: 'USD' }, buyCurrency: 'CAD' });
    expect(r.quote).toMatchObject({ give: { amount: '139.00', currency: 'CAD' }, side: 'BUY_RATE' });
  });
  it('a stale snapshot is stored flagged stale', async () => {
    rates.next = snapshot({ stale: true });
    const { r } = await submitNew('500.00');
    expect(r.quote?.snapshot.stale).toBe(true); rates.next = snapshot();
  });
  it('resubmit stores a quote for the new revision and detail returns the current one', async () => {
    const { id, r } = await submitNew('20000.00');
    const reviewer = await env.actor('u-reviewer');
    const m = await env.svc.decide(reviewer, id, 'REQUEST_INFO', 'Please confirm the purpose', r.version);
    rates.next = snapshot({ sell: '1.5000' });
    const re = await env.svc.resubmit(await teller(), id, values('300.00'), m.version);
    expect(re.quote?.give.amount).toBe('200.00'); // Python: Decimal('300.00')/Decimal('1.5000') = 200
    const revs = (await env.pool.query('select revision from request_quote where request_id=$1 order by revision', [id])).rows.map(x => x.revision);
    expect(revs).toEqual([1, 2]);
    expect((await env.svc.getRequest(await teller(), id)).quote?.give.amount).toBe('200.00');
    rates.next = snapshot();
  });
  it('rate unavailable: the submit still succeeds with quote null and the decision is unchanged', async () => {
    for (const bad of [null, new Error('feed down')]) {
      rates.next = bad;
      const { id, r } = await submitNew('500.00');
      expect(r).toMatchObject({ outcome: 'AUTO_APPROVE', status: 'APPROVED', quote: null });
      expect((await env.pool.query('select 1 from request_quote where request_id=$1', [id])).rowCount).toBe(0);
      expect((await env.svc.getRequest(await teller(), id)).quote).toBeNull();
    }
    rates.next = snapshot();
  });
  it('an unsupported pair has no quote and does not call the provider', async () => {
    const before = rates.calls;
    const { r } = await submitNew('100.00', { buyCurrency: 'EUR' });
    expect(r.quote).toBeNull(); expect(rates.calls).toBe(before);
  });
  it('the rate is fetched before the transaction: no control lock is held during the call', async () => {
    const probe = new pg.Client({ connectionString: env.pool.options.connectionString }); await probe.connect();
    let lockFree: boolean | null = null;
    rates.onGet = async () => {
      await probe.query('BEGIN');
      try { await probe.query('select 1 from policy_control where id=1 for update nowait'); lockFree = true; } catch { lockFree = false; }
      await probe.query('ROLLBACK');
    };
    try { await submitNew('500.00'); } finally { rates.onGet = null; await probe.end(); }
    expect(lockFree).toBe(true);
  });
  it('INV-TX-1: if the quote cannot be written, no decision and no state change are committed', async () => {
    const t = await teller();
    const d = await env.svc.createDraft(t, values('500.00'));
    await env.pool.query(`insert into request_quote(request_id, revision, quote) values($1, 1, '{}')`, [d.id]); // forces the quote insert to fail
    await expect(env.svc.submit(t, d.id, 'tx-atomic-key-1')).rejects.toThrow();
    expect((await env.pool.query('select count(*)::int c from decision_record where request_id=$1', [d.id])).rows[0].c).toBe(0);
    expect((await env.pool.query('select status from exchange_request where id=$1', [d.id])).rows[0].status).toBe('DRAFT');
    expect((await env.pool.query(`select count(*)::int c from audit_event where target_id=$1 and action='request.submitted'`, [d.id])).rows[0].c).toBe(0);
  });
  it('the audit event holds only a quote hash and a rate id, no amounts or names', async () => {
    const { id } = await submitNew('500.00');
    const a = (await env.pool.query(`select detail from audit_event where target_id=$1 and action='request.submitted'`, [id])).rows[0].detail;
    expect(a.quoteHash).toMatch(/^[0-9a-f]{64}$/); expect(a.rateId).toBe('uexchange.ca:20:2026-10-01 19:03:18');
    expect(JSON.stringify(a)).not.toMatch(/344|1\.4499|Test Member/);
  });
});

describe('the engine never sees rates (FR-70)', () => {
  const strip = (r: any) => ({ outcome: r.outcome, applied: r.applied_outcome, cause: r.fallback_cause, rule: r.deciding_rule_key, matched: r.matched_rules, shadow: r.shadow_results,
    reason: r.reason_code, text: r.reason_text, ctx: r.context_snapshot, ctxHash: r.context_hash, policy: r.policy_hash, ctl: r.control_revision });
  it('the Decision for the same request is identical whatever the provider returns, or when it fails', async () => {
    const variants: (RateSnapshot | null | Error)[] = [snapshot(), snapshot({ buy: '9.9999', sell: '9.9999' }), snapshot({ sell: '0.0001' }), null, new Error('boom')];
    const out = [];
    for (const v of variants) {
      rates.next = v;
      const { id } = await submitNew('700.00');
      out.push(strip((await env.pool.query('select * from decision_record where request_id=$1', [id])).rows[0]));
    }
    for (const o of out.slice(1)) expect(o).toEqual(out[0]);
    expect(JSON.stringify(out[0]!.ctx)).not.toMatch(/rate|quote|1\.4499|memberName|Test Member/i);
    rates.next = snapshot();
  });
});

describe('GET /api/quote service: strict inputs, advisory result', () => {
  it('returns the quote or an unavailable reason', async () => {
    const t = await teller();
    expect(await env.svc.quote(t, '500.00', 'CAD', 'USD')).toMatchObject({ available: true, quote: { give: { amount: '344.85' } } });
    expect(await env.svc.quote(t, '500.00', 'CAD', 'EUR')).toEqual({ available: false, reason: 'UNSUPPORTED_PAIR' });
    rates.next = null;
    expect(await env.svc.quote(t, '500.00', 'CAD', 'USD')).toEqual({ available: false, reason: 'RATE_UNAVAILABLE' });
    rates.next = new Error('x');
    expect(await env.svc.quote(t, '500.00', 'CAD', 'USD')).toEqual({ available: false, reason: 'RATE_UNAVAILABLE' });
    rates.next = snapshot();
  });
  it('rejects bad input without echoing it', async () => {
    const t = await teller();
    for (const [a, s, b] of [['abc', 'CAD', 'USD'], ['-5', 'CAD', 'USD'], ['0', 'CAD', 'USD'], ['1.234', 'CAD', 'USD'], ['5', 'CAD', 'CAD'], ['5', 'XXX', 'USD'], ['5', 'CAD', undefined], [undefined, 'CAD', 'USD'], [['1', '2'], 'CAD', 'USD']] as const) {
      const e = await env.svc.quote(t, a, s, b).catch(x => x);
      expect(e, JSON.stringify([a, s, b])).toBeInstanceOf(AppError); expect(e.code).toBe('VALIDATION');
      expect(JSON.stringify(e.extra)).not.toContain('abc');
    }
  });
  it('is for branch staff only', async () => {
    await expect(env.svc.quote(await env.actor('u-reviewer'), '5.00', 'CAD', 'USD')).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});

describe('submittedBy', () => {
  it('is resolved by join in the list, detail and review queue, for every role that can open a request', async () => {
    const { id } = await submitNew('20000.00');
    const names = async (a: string) => {
      const actor = await env.actor(a);
      const list = (await env.svc.list(actor)).find(x => x.id === id);
      return list?.submittedBy;
    };
    expect(await names('u-teller-tor')).toBe('Teller (Toronto)');
    expect(await names('u-manager-tor')).toBe('Teller (Toronto)');
    expect(await names('u-compliance')).toBe('Teller (Toronto)');
    const reviewer = await env.actor('u-reviewer');
    expect((await env.svc.getRequest(reviewer, id)).request.submittedBy).toBe('Teller (Toronto)');
    expect((await env.svc.reviewQueue(reviewer)).find(x => x.id === id)?.submittedBy).toBe('Teller (Toronto)');
  });
  it('cannot be supplied by a client: it is not a field of the request values', async () => {
    await expect(env.svc.createDraft(await teller(), { ...values('10.00'), submittedBy: 'Someone Else' })).rejects.toMatchObject({ code: 'VALIDATION' });
  });
  it('follows the display name in the database, not a copy', async () => {
    const { id } = await submitNew('100.00');
    await env.pool.query(`update users set display_name='Teller (Toronto) renamed' where id='u-teller-tor'`);
    try { expect((await env.svc.getRequest(await teller(), id)).request.submittedBy).toBe('Teller (Toronto) renamed'); }
    finally { await env.pool.query(`update users set display_name='Teller (Toronto)' where id='u-teller-tor'`); }
  });
});

describe('memberName privacy', () => {
  const NAME = 'Zzyzx Quillfeather';
  it('is required for submit, even for a draft saved before the field existed', async () => {
    const t = await teller();
    const { memberName: _m, ...legacy } = values('300.00') as Record<string, unknown>;
    await expect(env.svc.createDraft(t, legacy)).rejects.toMatchObject({ code: 'VALIDATION' });
    const d = await env.svc.createDraft(t, values('300.00'));
    await env.pool.query(`update request_revision set "values" = "values" - 'memberName' where request_id=$1`, [d.id]);
    await expect(env.svc.submit(t, d.id, 'legacy-draft-key-1')).rejects.toMatchObject({ code: 'VALIDATION' });
  });
  it('is stored trimmed and single-spaced', async () => {
    const d = await env.svc.createDraft(await teller(), values('10.00', { memberName: `  ${NAME.replace(' ', '   ')}  ` }));
    expect(d.values.memberName).toBe(NAME);
  });
  it('validation errors never echo the value', async () => {
    const e = await env.svc.createDraft(await teller(), values('10.00', { memberName: 'Zzyzx 4111 1111 1111 1111' })).catch(x => x);
    expect(e).toBeInstanceOf(AppError); expect(e.code).toBe('VALIDATION');
    const body = JSON.stringify({ message: e.message, extra: e.extra });
    expect(body).not.toContain('Zzyzx'); expect(body).not.toContain('4111');
    expect(e.extra.issues.some((i: { path: string }) => i.path === 'memberName')).toBe(true);
  });
  it('lives only in request_revision.values: no other table, no log line, no response except the request views', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(k => vi.spyOn(console, k).mockImplementation(() => {}));
    try {
      const t = await teller(); const reviewer = await env.actor('u-reviewer');
      const mk = async (amount: string, o: Record<string, unknown> = {}) => { const d = await env.svc.createDraft(t, values(amount, { memberName: NAME, ...o })); return d; };
      // review path: submit, request info, resubmit, approve, complete
      const a = await mk('20000.00');
      const ra = await env.svc.submit(t, a.id, 'privacy-key-0001');
      const m = await env.svc.decide(reviewer, a.id, 'REQUEST_INFO', 'Please confirm the purpose', ra.version);
      const re = await env.svc.resubmit(t, a.id, values('20000.00', { memberName: NAME }), m.version);
      const ap = await env.svc.decide(reviewer, a.id, 'APPROVE', undefined, re.version);
      await env.svc.complete(t, a.id, { handedOver: { amount: '20000.00', currency: 'CAD' }, given: { amount: '13793.10', currency: 'USD' }, rateApplied: '1.45', reference: 'CORE-0001' }, ap.version);
      // auto-decline then escalate, and an auto-approve with a quote
      const b = await mk('100.00', { buyCurrency: 'JPY' });
      const rb = await env.svc.submit(t, b.id, 'privacy-key-0002');
      const eb = await env.svc.escalate(t, b.id, 'Member has a documented need', rb.version);
      await env.svc.decide(reviewer, b.id, 'DECLINE', 'Currency not offered', eb.version);
      const c = await mk('500.00');
      await env.svc.submit(t, c.id, 'privacy-key-0003');
      // a rejected attempt and a quote request
      await env.svc.createDraft(t, values('10.00', { memberName: `${NAME} 123` })).catch(() => {});
      await env.svc.quote(t, '500.00', 'CAD', 'USD');
      await runOutboxRelay(env.pool);

      const tables = (await env.pool.query(`select tablename from pg_tables where schemaname='public'`)).rows.map(x => x.tablename as string);
      const hits: Record<string, number> = {};
      for (const tb of tables) {
        const n = (await env.pool.query(`select count(*)::int c from "${tb}" x where x::text ilike '%quillfeather%'`)).rows[0].c;
        if (n) hits[tb] = n;
      }
      expect(Object.keys(hits)).toEqual(['request_revision']);
      // the sensitive tables were not empty, so the scan means something
      for (const tb of ['audit_event', 'outbox', 'inbox', 'decision_record', 'request_quote', 'request_completion', 'idempotency']) {
        expect((await env.pool.query(`select count(*)::int c from "${tb}"`)).rows[0].c, tb).toBeGreaterThan(0);
      }
      const logged = spies.flatMap(s => s.mock.calls.map(c => JSON.stringify(c))).join('\n');
      expect(logged).not.toMatch(/quillfeather/i);
      // responses that are not request views carry no name either
      expect(JSON.stringify([ra, m, re, ap, rb, eb])).not.toMatch(/quillfeather/i);
      // the notification text and the quote record
      expect((await env.pool.query(`select message from inbox`)).rows.every(r => !/quillfeather/i.test(r.message))).toBe(true);
      expect(JSON.stringify((await env.pool.query('select quote from request_quote')).rows)).not.toMatch(/quillfeather/i);
    } finally { spies.forEach(s => s.mockRestore()); }
  });
  it('is not in the evaluation context: the context has a fixed key set', async () => {
    const { id } = await submitNew('500.00', { memberName: NAME });
    const ctx = (await env.pool.query('select context_snapshot from decision_record where request_id=$1', [id])).rows[0].context_snapshot;
    expect(Object.keys(ctx).sort()).toEqual(['branchDate', 'branchId', 'businessHours', 'buy', 'currencyPair', 'paymentMethod', 'requestType', 'sell']);
  });
  it('is visible in the views of roles that can open the request', async () => {
    const { id } = await submitNew('20000.00', { memberName: NAME });
    const reviewer = await env.actor('u-reviewer');
    expect((await env.svc.getRequest(await teller(), id)).request.values.memberName).toBe(NAME);
    expect((await env.svc.getRequest(reviewer, id)).request.values.memberName).toBe(NAME);
    expect((await env.svc.getRequest(await env.actor('u-manager-tor'), id)).request.values.memberName).toBe(NAME);
    expect((await env.svc.getRequest(await env.actor('u-compliance'), id)).request.values.memberName).toBe(NAME);
    expect((await env.svc.reviewQueue(reviewer)).find(x => x.id === id)?.values.memberName).toBe(NAME);
    expect((await env.svc.list(await teller())).find(x => x.id === id)?.values.memberName).toBe(NAME);
    await expect(env.svc.getRequest(await env.actor('u-teller-ott'), id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
