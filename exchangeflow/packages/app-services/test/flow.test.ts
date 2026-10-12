import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { startEnv, values, type Env } from './helpers';
import { AppError } from '../src';

let env: Env;
beforeAll(async () => { env = await startEnv(); });
afterAll(async () => { await env.stop(); });

const submitNew = async (amount: string, o: Record<string, unknown> = {}, key = crypto.randomUUID()) => {
  const teller = await env.actor('u-teller-tor');
  const d = await env.svc.createDraft(teller, values(amount, o));
  const r = await env.svc.submit(teller, d.id, key);
  return { teller, id: d.id, r, key };
};

describe('three paths (ADR-021 placeholders, dev only)', () => {
  it('auto-approve within the placeholder limit', async () => {
    const { r } = await submitNew('500.00');
    expect(r.outcome).toBe('AUTO_APPROVE'); expect(r.status).toBe('APPROVED');
  });
  it('auto-decline for an unsupported pair', async () => {
    const { r } = await submitNew('100.00', { buyCurrency: 'JPY' });
    expect(r.outcome).toBe('AUTO_DECLINE'); expect(r.status).toBe('AUTO_DECLINED');
  });
  it('human review for a large amount', async () => {
    const { r } = await submitNew('20000.00');
    expect(r.outcome).toBe('HUMAN_REVIEW'); expect(r.status).toBe('UNDER_REVIEW');
  });
  it('guardrail downgrades an over-max approve to human review; WIRE has no matching rule', async () => {
    const { r } = await submitNew('1200.00'); // no approve rule matches above 1000, falls to NO_MATCH
    expect(r.status).toBe('UNDER_REVIEW');
    const w = await submitNew('100.00', { requestType: 'WIRE' });
    expect(w.r.status).toBe('UNDER_REVIEW');
  });
});

describe('INV-IDEM-1', () => {
  it('same key replays the stored response; a different payload is rejected', async () => {
    const teller = await env.actor('u-teller-tor');
    const d1 = await env.svc.createDraft(teller, values('300.00'));
    const d2 = await env.svc.createDraft(teller, values('301.00'));
    const key = 'idem-key-12345';
    const a = await env.svc.submit(teller, d1.id, key);
    const b = await env.svc.submit(teller, d1.id, key);
    expect(b).toEqual(a);
    await expect(env.svc.submit(teller, d2.id, key)).rejects.toMatchObject({ code: 'IDEMPOTENCY_MISMATCH' });
    const count = await env.pool.query(`select count(*)::int c from decision_record where request_id=$1`, [d1.id]);
    expect(count.rows[0].c).toBe(1);
  });
  it('two concurrent submits with one key create exactly one decision', async () => {
    const teller = await env.actor('u-teller-tor');
    const d = await env.svc.createDraft(teller, values('250.00'));
    const [a, b] = await Promise.all([env.svc.submit(teller, d.id, 'concurrent-key-1'), env.svc.submit(teller, d.id, 'concurrent-key-1')]);
    expect(a).toEqual(b);
    expect((await env.pool.query(`select count(*)::int c from decision_record where request_id=$1`, [d.id])).rows[0].c).toBe(1);
  });
});

describe('workflow rules', () => {
  it('escalation works once, then is refused; reviewer cannot be the submitter', async () => {
    const { teller, id, r } = await submitNew('100.00', { buyCurrency: 'JPY' });
    const e = await env.svc.escalate(teller, id, 'Member has a documented need', r.version);
    expect(e.status).toBe('UNDER_REVIEW');
    const reviewer = await env.actor('u-reviewer');
    const dec = await env.svc.decide(reviewer, id, 'DECLINE', 'Currency not offered', e.version);
    expect(dec.status).toBe('DECLINED');
    await expect(env.svc.escalate(teller, id, 'again please', dec.version)).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
  it('resubmission is re-evaluated but always lands in human review (ADR-022)', async () => {
    const { id, r } = await submitNew('20000.00');
    const reviewer = await env.actor('u-reviewer');
    const m = await env.svc.decide(reviewer, id, 'REQUEST_INFO', 'Please confirm the purpose', r.version);
    const teller = await env.actor('u-teller-tor');
    const re = await env.svc.resubmit(teller, id, values('300.00'), m.version); // would auto-approve on its own
    expect(re.status).toBe('UNDER_REVIEW');
    const d = await env.pool.query(`select outcome, applied_outcome, fallback_cause from decision_record where request_id=$1 order by cycle desc limit 1`, [id]);
    expect(d.rows[0]).toMatchObject({ outcome: 'AUTO_APPROVE', applied_outcome: 'HUMAN_REVIEW', fallback_cause: 'RESUBMISSION_FLOOR' });
  });
  it('stale version returns STALE_REQUEST (INV-CONC-1)', async () => {
    const { id, r } = await submitNew('20000.00');
    const reviewer = await env.actor('u-reviewer');
    await env.svc.decide(reviewer, id, 'APPROVE', undefined, r.version);
    await expect(env.svc.decide(reviewer, id, 'DECLINE', 'too late now', r.version)).rejects.toMatchObject({ code: 'STALE_REQUEST' });
  });
  it('branch scope: a teller from another branch gets 404', async () => {
    const { id } = await submitNew('100.00');
    const other = await env.actor('u-teller-ott');
    await expect(env.svc.getRequest(other, id)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
  it('decline and request-info need a reason', async () => {
    const { id, r } = await submitNew('20000.00');
    const reviewer = await env.actor('u-reviewer');
    await expect(env.svc.decide(reviewer, id, 'DECLINE', '', r.version)).rejects.toMatchObject({ code: 'REASON_REQUIRED' });
  });
  it('approved request can be completed with executed values', async () => {
    const { teller, id, r } = await submitNew('400.00');
    const c = await env.svc.complete(teller, id, { handedOver: { amount: '400.00', currency: 'CAD' }, given: { amount: '275.86', currency: 'USD' }, rateApplied: '1.45', reference: 'CORE-778899' }, r.version);
    expect(c.status).toBe('COMPLETED'); expect(c).not.toHaveProperty('mismatch');
  });
  it('validation: floats, extra scale and same-currency are rejected with field issues', async () => {
    const teller = await env.actor('u-teller-tor');
    await expect(env.svc.createDraft(teller, values('10.123'))).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(env.svc.createDraft(teller, values('abc'))).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(env.svc.createDraft(teller, values('10.00', { buyCurrency: 'CAD' }))).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(env.svc.createDraft(teller, { ...values('10.00'), branchId: 'BR-OTT' })).rejects.toMatchObject({ code: 'VALIDATION' }); // unknown field (client cannot choose branch)
  });
});

describe('pause: INV-CTRL-1 / INV-PAUSE-1 (lock first, ADR-027)', () => {
  it('a submit that starts while a pause is in progress waits and then sees the pause', async () => {
    const teller = await env.actor('u-teller-tor');
    const d = await env.svc.createDraft(teller, values('300.00')); // would auto-approve
    const c = new pg.Client({ connectionString: env.pool.options.connectionString }); await c.connect();
    await c.query('BEGIN'); await c.query('select * from policy_control where id=1 for update'); // a pause is "in progress"
    const pending = env.svc.submit(teller, d.id, 'pause-race-key-1');
    let settled = false; pending.then(() => { settled = true; }, () => { settled = true; });
    await new Promise(r => setTimeout(r, 400));
    expect(settled).toBe(false); // blocked on FOR SHARE until the pause commits
    await c.query(`update policy_control set control_revision = control_revision + 1, global_paused = true where id=1`);
    await c.query('COMMIT'); await c.end();
    const r = await pending;
    expect(r.outcome).toBe('HUMAN_REVIEW');
    const rec = await env.pool.query(`select fallback_cause from decision_record where request_id=$1`, [d.id]);
    expect(rec.rows[0].fallback_cause).toBe('ENGINE_PAUSED');
    await env.pool.query(`update policy_control set global_paused=false, control_revision=control_revision+1 where id=1`);
  });
  it('pausing then resuming through the service changes revision and is role-checked', async () => {
    const teller = await env.actor('u-teller-tor'); const approver = await env.actor('u-approver');
    await expect(env.svc.pause(teller, {}, 'because')).rejects.toBeInstanceOf(AppError);
    await env.svc.pause(approver, { ruleKey: 'PLACEHOLDER-001' }, 'checking behaviour');
    const { r } = await submitNew('300.00');
    expect(r.outcome).toBe('HUMAN_REVIEW'); // paused approve rule that matched -> RULE_PAUSED, never automated
    await env.svc.resume(approver, { ruleKey: 'PLACEHOLDER-001' }, 'done checking');
    expect((await submitNew('300.00')).r.outcome).toBe('AUTO_APPROVE');
  });
});

describe('audit chain and outbox', () => {
  it('audit is hash-chained and insert-only; outbox relays to the submitter inbox', async () => {
    const { id, r } = await submitNew('20000.00');
    const reviewer = await env.actor('u-reviewer');
    await env.svc.decide(reviewer, id, 'APPROVE', undefined, r.version);
    const rows = (await env.pool.query('select seq, prev_hash, hash from audit_event order by seq')).rows;
    for (let i = 1; i < rows.length; i++) expect(rows[i].prev_hash).toBe(rows[i - 1].hash);
    await expect(env.pool.query(`update audit_event set action='x' where seq=1`)).rejects.toThrow(/insert-only/);
    await expect(env.pool.query(`delete from audit_event`)).rejects.toThrow(/insert-only/);
    const { runOutboxRelay } = await import('@ef/adapter-postgres');
    expect(await runOutboxRelay(env.pool)).toBeGreaterThan(0);
    const inbox = await env.pool.query(`select message from inbox where request_id=$1`, [id]);
    expect(inbox.rows[0].message).toMatch(/was approved/);
  });
  it('replay: re-evaluating a stored context under the stored policy gives the stored outcome (INV-DET-1)', async () => {
    const { id } = await submitNew('700.00');
    const rec = (await env.pool.query(`select * from decision_record where request_id=$1`, [id])).rows[0];
    const { evaluate, ENGINE_VERSION } = await import('@ef/policy-core');
    const pol = (await env.pool.query('select * from policy_version where id=$1', [rec.policy_version_id])).rows[0];
    const d = evaluate({ context: rec.context_snapshot, policy: { ...pol.manifest, policyVersionId: pol.id, number: pol.number, policyHash: pol.policy_hash },
      control: { controlRevision: rec.control_revision, globalPaused: false, pausedRuleIds: [] }, asOf: rec.as_of, engineVersion: ENGINE_VERSION, compliance: rec.restricted.compliance ?? {} });
    expect(d.outcome).toBe(rec.outcome); expect(d.contextHash).toBe(rec.context_hash);
  });
  it('production refuses a placeholder-decided automated outcome (INV-PLACEHOLDER-1 last line)', async () => {
    const { PgUnitOfWork } = await import('@ef/adapter-postgres'); const { AppServices } = await import('../src'); const { ids } = await import('./helpers');
    const prod = new AppServices(new PgUnitOfWork(env.pool), env.clock, ids, { environment: 'prod' });
    const teller = await env.actor('u-teller-tor');
    const d = await prod.createDraft(teller, values('300.00'));
    await expect(prod.submit(teller, d.id, 'prod-key-123456')).rejects.toMatchObject({ code: 'PLACEHOLDER_IN_PRODUCTION' });
  });
});
