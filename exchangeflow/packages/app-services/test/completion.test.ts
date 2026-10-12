import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startEnv, values, type Env } from './helpers';
import { runOutboxRelay, PgUnitOfWork } from '@ef/adapter-postgres';
import { AppServices } from '../src';
import type { RateProvider, RateSnapshot, UnitOfWork } from '@ef/ports';

const snap: RateSnapshot = { currency: 'USD', feedId: '20', buy: '1.3900', sell: '1.4499', feedUpdatedAt: '2026-10-01 19:03:18', fetchedAt: '2026-10-02T12:00:00.000Z', stale: false };
const rates: RateProvider = { get: async c => (c === 'USD' ? snap : null) };

let env: Env;
beforeAll(async () => {
  env = await startEnv('dev', rates);
  await env.pool.query(`insert into users(id, display_name, roles, branch_id) values ('u-manager-ott','Manager (Ottawa)','{MANAGER}','BR-OTT')`);
});
afterAll(async () => { await env.stop(); });

const BANNED = /GUARDRAIL|COMPLIANCE|sanction|\bPEP\b|FINTRAC|screening|suspicion|mismatch|flagged|\bflag\b/i;
const NAME = 'Zzyzx Quillfeather';
const body = (o: Record<string, unknown> = {}) => ({ handedOver: { amount: '500.00', currency: 'CAD' }, given: { amount: '344.85', currency: 'USD' }, rateApplied: '1.4499', reference: 'CORE-1', ...o });
const approved = async (amount = '500.00') => {
  const teller = await env.actor('u-teller-tor');
  const d = await env.svc.createDraft(teller, values(amount, { memberName: NAME }));
  const r = await env.svc.submit(teller, d.id, crypto.randomUUID());
  expect(r.status).toBe('APPROVED');
  return { teller, id: d.id, version: r.version };
};
const rejects = (p: Promise<unknown>, path: string) => p.then(() => { throw new Error('should reject'); }, e => {
  expect(e.code).toBe('VALIDATION'); expect(e.extra.issues.map((i: { path: string }) => i.path)).toContain(path);
  expect(JSON.stringify(e.extra)).not.toMatch(/quillfeather/i);
});

describe('completion recording', () => {
  it('stores what was given and the rate, with the quote copy and the completing user', async () => {
    const { teller, id, version } = await approved();
    await env.svc.complete(teller, id, body(), version);
    const row = (await env.pool.query('select * from request_completion where request_id=$1', [id])).rows[0];
    expect(row).toMatchObject({ handed_over: { amount: '500.00', currency: 'CAD' }, given: { amount: '344.85', currency: 'USD' }, rate_applied: '1.4499', rate_side: 'SELL_RATE', reference: 'CORE-1', quoted_give: { amount: '344.85', currency: 'USD' }, completed_by: 'u-teller-tor', revision: 1 });
  });
  it('audit detail holds the reference and booleans only', async () => {
    const { teller, id, version } = await approved();
    await env.svc.complete(teller, id, body({ handedOver: { amount: '499.00', currency: 'CAD' }, given: { amount: '344.00', currency: 'USD' }, rateApplied: '1.45' }), version);
    const a = (await env.pool.query(`select detail from audit_event where target_id=$1 and action='request.completed'`, [id])).rows[0];
    expect(a.detail).toEqual({ reference: 'CORE-1', handedOverDiffers: true, givenDiffersFromQuote: true, rateDiffersFromQuote: true });
  });
  it('matching the quote gives false booleans and differsFromQuote false', async () => {
    const { teller, id, version } = await approved();
    await env.svc.complete(teller, id, body(), version);
    const a = (await env.pool.query(`select detail from audit_event where target_id=$1 and action='request.completed'`, [id])).rows[0];
    expect(a.detail).toEqual({ reference: 'CORE-1', handedOverDiffers: false, givenDiffersFromQuote: false, rateDiffersFromQuote: false });
    expect((await env.svc.getRequest(teller, id)).completion?.differsFromQuote).toBe(false);
  });
  it('a completed request cannot be completed again', async () => {
    const { teller, id, version } = await approved();
    const c = await env.svc.complete(teller, id, body(), version);
    await expect(env.svc.complete(teller, id, body(), c.version)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
  it('the response carries no flag wording', async () => {
    const { teller, id, version } = await approved();
    const c = await env.svc.complete(teller, id, body({ given: { amount: '300.00', currency: 'USD' } }), version);
    expect(JSON.stringify(c)).not.toMatch(BANNED);
  });
});

describe('completion validation', () => {
  it('rejects the wrong currency on either side', async () => {
    const { teller, id, version } = await approved();
    await rejects(env.svc.complete(teller, id, body({ given: { amount: '344.85', currency: 'EUR' } }), version), 'given.currency');
    await rejects(env.svc.complete(teller, id, body({ handedOver: { amount: '500.00', currency: 'USD' } }), version), 'handedOver.currency');
  });
  it('rejects too many decimals, JPY scale, zero, negative and non-decimal amounts', async () => {
    const { teller, id, version } = await approved();
    await rejects(env.svc.complete(teller, id, body({ given: { amount: '344.855', currency: 'USD' } }), version), 'given.amount');
    await rejects(env.svc.complete(teller, id, body({ handedOver: { amount: '-5.00', currency: 'CAD' } }), version), 'handedOver.amount');
    await rejects(env.svc.complete(teller, id, body({ given: { amount: '0.00', currency: 'USD' } }), version), 'given.amount');
    await rejects(env.svc.complete(teller, id, body({ given: { amount: '1e3', currency: 'USD' } }), version), 'given.amount');
    await rejects(env.svc.complete(teller, id, body({ given: { amount: '10.5', currency: 'XXX' } }), version), 'given.currency');
  });
  it('rejects bad rates and bad references', async () => {
    const { teller, id, version } = await approved();
    await rejects(env.svc.complete(teller, id, body({ rateApplied: '1.4499999' }), version), 'rateApplied');
    await rejects(env.svc.complete(teller, id, body({ rateApplied: '0' }), version), 'rateApplied');
    await rejects(env.svc.complete(teller, id, body({ rateApplied: '-1.4' }), version), 'rateApplied');
    await rejects(env.svc.complete(teller, id, body({ reference: 'ab' }), version), 'reference');
    await rejects(env.svc.complete(teller, id, body({ reference: 'has space' }), version), 'reference');
    await rejects(env.svc.complete(teller, id, body({ reference: 'x'.repeat(41) }), version), 'reference');
  });
  it('rejects the old executed shape and unknown keys', async () => {
    const { teller, id, version } = await approved();
    await expect(env.svc.complete(teller, id, { executed: { amount: '500.00', currency: 'CAD', reference: 'CORE-1' } }, version)).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(env.svc.complete(teller, id, { ...body(), extra: 1 }, version)).rejects.toMatchObject({ code: 'VALIDATION' });
  });
  it('nothing is stored after a rejection', async () => {
    const { teller, id, version } = await approved();
    await env.svc.complete(teller, id, body({ reference: 'no' }), version).catch(() => {});
    expect((await env.pool.query('select count(*)::int c from request_completion where request_id=$1', [id])).rows[0].c).toBe(0);
    expect((await env.svc.getRequest(teller, id)).request.status).toBe('APPROVED');
  });
});

describe('INV-TX-1 atomicity', () => {
  it('a failure after the transition and the completion insert rolls both back', async () => {
    const real = new PgUnitOfWork(env.pool);
    const failing: UnitOfWork = { run: fn => real.run(tx => fn({ ...tx, audit: { ...tx.audit, append: e => (e.action === 'request.completed' ? Promise.reject(new Error('boom')) : tx.audit.append(e)) } })) };
    const svc = new AppServices(failing, env.clock, { uuid: () => crypto.randomUUID() }, { environment: 'dev' }, rates);
    const { teller, id, version } = await approved();
    await expect(svc.complete(teller, id, body(), version)).rejects.toThrow('boom');
    expect((await env.pool.query('select count(*)::int c from request_completion where request_id=$1', [id])).rows[0].c).toBe(0);
    expect((await env.svc.getRequest(teller, id)).request.status).toBe('APPROVED');
  });
});

describe('role visibility matrix', () => {
  it('every role that can open the request sees identical quote, completion and give; others get 404', async () => {
    const { teller, id, version } = await approved();
    await env.svc.complete(teller, id, body({ given: { amount: '344.00', currency: 'USD' }, rateApplied: '1.4500' }), version);
    const viewers: [string, boolean][] = [['u-teller-tor', true], ['u-teller-ott', false], ['u-reviewer', true], ['u-manager-tor', true], ['u-manager-ott', false], ['u-compliance', true], ['u-approver', false]];
    const seen: Record<string, unknown>[] = [];
    for (const [uid, canOpen] of viewers) {
      const actor = await env.actor(uid);
      if (!canOpen) { await expect(env.svc.getRequest(actor, id), uid).rejects.toMatchObject({ code: 'NOT_FOUND' }); continue; }
      const d = await env.svc.getRequest(actor, id);
      seen.push({ quote: d.quote, completion: d.completion, give: d.request.give });
    }
    expect(seen).toHaveLength(4);
    for (const x of seen) expect(x).toEqual(seen[0]);
    expect(seen[0]!.completion).toMatchObject({
      handedOver: { amount: '500.00', currency: 'CAD' }, given: { amount: '344.00', currency: 'USD' }, rateApplied: '1.4500', rateSide: 'SELL_RATE', reference: 'CORE-1',
      completedBy: 'Teller (Toronto)', quotedGive: { amount: '344.85', currency: 'USD' }, differsFromQuote: true,
    });
    expect(seen[0]!.give).toEqual({ amount: '344.00', currency: 'USD', rate: '1.4500', source: 'COMPLETED' });
    expect((seen[0]!.quote as { give: unknown }).give).toEqual({ amount: '344.85', currency: 'USD' });
  });
  it('list and review queue carry give: quoted before completion, completed after', async () => {
    const t = await env.actor('u-teller-tor'), reviewer = await env.actor('u-reviewer');
    const d = await env.svc.createDraft(t, values('20000.00'));
    const r = await env.svc.submit(t, d.id, crypto.randomUUID());
    const quoted = { amount: '13794.00', currency: 'USD', rate: '1.4499', source: 'QUOTED' };
    expect((await env.svc.reviewQueue(reviewer)).find(x => x.id === d.id)?.give).toMatchObject({ source: 'QUOTED', currency: 'USD' });
    expect((await env.svc.list(t)).find(x => x.id === d.id)?.give).toMatchObject({ source: 'QUOTED', rate: quoted.rate });
    const ap = await env.svc.decide(reviewer, d.id, 'APPROVE', undefined, r.version);
    await env.svc.complete(t, d.id, body({ handedOver: { amount: '20000.00', currency: 'CAD' }, given: { amount: '13700.00', currency: 'USD' } }), ap.version);
    for (const a of ['u-teller-tor', 'u-manager-tor', 'u-compliance', 'u-reviewer']) {
      expect((await env.svc.list(await env.actor(a))).find(x => x.id === d.id)?.give, a).toEqual({ amount: '13700.00', currency: 'USD', rate: '1.4499', source: 'COMPLETED' });
    }
  });
  it('without a quote give is null and the completion has no quoted copy', async () => {
    const teller = await env.actor('u-teller-tor');
    const dr = await env.svc.createDraft(teller, values('500.00', { buyCurrency: 'EUR' }));
    const r = await env.svc.submit(teller, dr.id, crypto.randomUUID());
    expect((await env.svc.list(teller)).find(x => x.id === dr.id)?.give).toBeNull();
    if (r.status !== 'APPROVED') return;
    await env.svc.complete(teller, dr.id, body({ given: { amount: '300.00', currency: 'EUR' } }), r.version);
    const c = (await env.svc.getRequest(teller, dr.id)).completion;
    expect(c?.quotedGive).toBeNull(); expect(c?.differsFromQuote).toBe(false);
  });
  it('no response contains banned words', async () => {
    const { teller, id, version } = await approved();
    const c = await env.svc.complete(teller, id, body({ given: { amount: '300.00', currency: 'USD' } }), version);
    const out = [c];
    for (const u of ['u-teller-tor', 'u-reviewer', 'u-manager-tor']) {
      const a = await env.actor(u);
      const d = await env.svc.getRequest(a, id);
      out.push({ completion: d.completion, give: d.request.give } as never);
    }
    expect(JSON.stringify(out)).not.toMatch(BANNED);
  });
});

describe('member name privacy with completions', () => {
  it('the name is absent from completion, audit, outbox, inbox and decision snapshot', async () => {
    const { teller, id, version } = await approved();
    await env.svc.complete(teller, id, body(), version);
    await runOutboxRelay(env.pool);
    for (const tb of ['request_completion', 'audit_event', 'outbox', 'inbox', 'decision_record', 'request_quote']) {
      const n = (await env.pool.query(`select count(*)::int c from "${tb}" x where x::text ilike '%quillfeather%'`)).rows[0].c;
      expect(n, tb).toBe(0);
    }
    const tables = (await env.pool.query(`select tablename from pg_tables where schemaname='public'`)).rows.map(x => x.tablename as string);
    const hits: string[] = [];
    for (const tb of tables) if ((await env.pool.query(`select count(*)::int c from "${tb}" x where x::text ilike '%quillfeather%'`)).rows[0].c) hits.push(tb);
    expect(hits).toEqual(['request_revision']);
  });
});
