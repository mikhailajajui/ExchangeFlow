import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startEnv, values, type Env } from './helpers';

let env: Env;
beforeAll(async () => { env = await startEnv(); });
afterAll(async () => { await env.stop(); });

const BANNED = /GUARDRAIL|COMPLIANCE|sanction|\bPEP\b|FINTRAC|screening|suspicion/i;
const submitNew = async (amount: string, o: Record<string, unknown> = {}) => {
  const teller = await env.actor('u-teller-tor');
  const d = await env.svc.createDraft(teller, values(amount, o));
  const r = await env.svc.submit(teller, d.id, crypto.randomUUID());
  return { teller, id: d.id, r };
};
const forceCause = (id: string, cause: string) => env.pool.query(`update decision_record set fallback_cause=$2 where request_id=$1`, [id, cause]);

describe('completion does not report a mismatch (UI-BA 4)', () => {
  it('the response has no mismatch flag; the audit detail records booleans only', async () => {
    const { teller, id, r } = await submitNew('400.00');
    const c = await env.svc.complete(teller, id, { handedOver: { amount: '399.00', currency: 'CAD' }, given: { amount: '275.86', currency: 'USD' }, rateApplied: '1.45', reference: 'CORE-1234' }, r.version);
    expect(c).toEqual({ id, status: 'COMPLETED', version: r.version + 1 });
    const a = (await env.pool.query(`select detail from audit_event where target_id=$1 and action='request.completed'`, [id])).rows[0];
    expect(a.detail.handedOverDiffers).toBe(true);
    expect(a.detail.reference).toBe('CORE-1234');
    expect(JSON.stringify(c)).not.toMatch(/mismatch|flag/i);
  });
  it('invalid input: a missing transaction reference is a VALIDATION error', async () => {
    const { teller, id, r } = await submitNew('400.00');
    await expect(env.svc.complete(teller, id, { handedOver: { amount: '400.00', currency: 'CAD' }, given: { amount: '275.86', currency: 'USD' }, rateApplied: '1.45', reference: '' }, r.version)).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});

describe('neutral causes by role (UI-SEC-01, ADR-026)', () => {
  it('tellers get no cause; reviewers get one of four values; GUARDRAIL collapses for everyone except COMPLIANCE', async () => {
    const { teller, id } = await submitNew('20000.00');
    const reviewer = await env.actor('u-reviewer'), manager = await env.actor('u-manager-tor'), compliance = await env.actor('u-compliance');
    const causeOf = async (a: typeof teller) => (await env.svc.getRequest(a, id)).request.latest?.cause;
    const table: [string, string | undefined, string | undefined, string | undefined, string | undefined][] = [
      // cause, teller, reviewer, manager and approver, compliance
      ['GUARDRAIL', undefined, 'NEEDS_REVIEW', 'NEEDS_REVIEW', 'GUARDRAIL'],
      ['RULE_REQUIRES_HUMAN', undefined, 'NEEDS_REVIEW', 'RULE_REQUIRES_HUMAN', 'RULE_REQUIRES_HUMAN'],
      ['NO_MATCH', undefined, 'NEEDS_REVIEW', 'NO_MATCH', 'NO_MATCH'],
      ['MISSING_DATA', undefined, 'NEEDS_REVIEW', 'MISSING_DATA', 'MISSING_DATA'],
      ['CONFLICT', undefined, 'NEEDS_REVIEW', 'CONFLICT', 'CONFLICT'],
      ['RULE_PAUSED', undefined, 'NEEDS_REVIEW', 'RULE_PAUSED', 'RULE_PAUSED'],
      ['RESUBMISSION_FLOOR', undefined, 'RESUBMISSION_FLOOR', 'RESUBMISSION_FLOOR', 'RESUBMISSION_FLOOR'],
      ['ENGINE_PAUSED', undefined, 'ENGINE_PAUSED', 'ENGINE_PAUSED', 'ENGINE_PAUSED'],
      ['ENGINE_ERROR', undefined, 'ENGINE_ERROR', 'ENGINE_ERROR', 'ENGINE_ERROR'],
    ];
    for (const [cause, t, rv, mg, co] of table) {
      await forceCause(id, cause);
      expect(await causeOf(teller), cause).toBe(t);
      expect(await causeOf(reviewer), cause).toBe(rv);
      expect(await causeOf(manager), cause).toBe(mg);
      expect(await causeOf(compliance), cause).toBe(co);
    }
    await forceCause(id, 'GUARDRAIL');
    const q = (await env.svc.reviewQueue(reviewer)).find(x => x.id === id)!;
    expect(q.cause).toBe('NEEDS_REVIEW'); expect(q.latest?.cause).toBe('NEEDS_REVIEW');
    const det = await env.svc.getRequest(reviewer, id);
    expect(det.decisions[0]!.cause).toBe('NEEDS_REVIEW');
  });
});

describe('no response body contains restricted words (UI-SEC-01)', () => {
  it('list, detail, queue and engine status stay clean for every non-compliance role, even when a guardrail fired', async () => {
    const approver = await env.actor('u-approver');
    await env.svc.pause(approver, { ruleKey: 'PLACEHOLDER-001' }, 'contract test');
    const paused = await submitNew('300.00');
    await env.svc.resume(approver, { ruleKey: 'PLACEHOLDER-001' }, 'contract test done');
    const big = await submitNew('20000.00');
    await forceCause(big.id, 'GUARDRAIL');
    const declined = await submitNew('100.00', { buyCurrency: 'JPY' });
    await submitNew('500.00');
    const reviewer = await env.actor('u-reviewer');
    const m = await env.svc.decide(reviewer, paused.id, 'REQUEST_INFO', 'Please confirm the purpose', paused.r.version);
    await env.svc.resubmit(paused.teller, paused.id, values('300.00'), m.version);
    await env.svc.escalate(declined.teller, declined.id, 'Member has a documented need', declined.r.version);
    const ids = [paused.id, big.id, declined.id];
    for (const u of ['u-teller-tor', 'u-reviewer', 'u-manager-tor', 'u-approver']) {
      const a = await env.actor(u);
      const bodies: unknown[] = [await env.svc.list(a), await env.svc.engineStatus(a)];
      if (a.roles.includes('REVIEWER')) bodies.push(await env.svc.reviewQueue(a));
      if (u !== 'u-approver') for (const id of ids) bodies.push(await env.svc.getRequest(a, id)); // the policy approver has no request-detail access
      for (const b of bodies) expect(JSON.stringify(b), u).not.toMatch(BANNED);
    }
  });
});

describe('audit and policy-hash visibility (UI-SEC-05)', () => {
  it('seq and hash only for COMPLIANCE and MANAGER; others get a per-request entry number', async () => {
    const { teller, id } = await submitNew('20000.00');
    const reviewer = await env.actor('u-reviewer'), manager = await env.actor('u-manager-tor'), compliance = await env.actor('u-compliance');
    for (const a of [teller, reviewer]) {
      const h = (await env.svc.getRequest(a, id)).history;
      expect(h.map(x => x.n)).toEqual([1, 2]);
      for (const x of h) { expect(x).not.toHaveProperty('seq'); expect(x).not.toHaveProperty('hash'); }
    }
    for (const a of [manager, compliance]) {
      const h = (await env.svc.getRequest(a, id)).history;
      for (const x of h) { expect(typeof x.seq).toBe('number'); expect(x.hash).toMatch(/^[0-9a-f]{12}$/); }
    }
  });
  it('the engine policy hash is returned only to POLICY_APPROVER, MANAGER and COMPLIANCE', async () => {
    for (const u of ['u-approver', 'u-manager-tor', 'u-compliance']) expect((await env.svc.engineStatus(await env.actor(u))).policy?.hash, u).toMatch(/^[0-9a-f]{12}$/);
    for (const u of ['u-reviewer', 'u-teller-tor']) expect((await env.svc.engineStatus(await env.actor(u))).policy?.hash, u).toBeUndefined();
  });
});

describe('shadow results gate (FR-21)', () => {
  it('a reviewer gets no shadow field until they have decided that cycle; the teller never does', async () => {
    const { teller, id, r } = await submitNew('20000.00');
    const reviewer = await env.actor('u-reviewer');
    expect((await env.svc.getRequest(reviewer, id)).decisions[0]!.shadow).toBeUndefined();
    await env.svc.decide(reviewer, id, 'APPROVE', undefined, r.version);
    expect((await env.svc.getRequest(reviewer, id)).decisions[0]!.shadow).toBeDefined();
    expect((await env.svc.getRequest(teller, id)).decisions[0]!.shadow).toBeUndefined();
  });
});

describe('member note check (UI-BA 12)', () => {
  const create = async (note: string) => env.svc.createDraft(await env.actor('u-teller-tor'), values('10.00', { note }));
  it.each(['card 4111 1111 1111 1111 expires soon', '4111-1111-1111-1111', '4111111111111', '1234567890123456789', '123-456-789', '123 456 789', 'sin 123456789 please'])(
    'rejects %s with a VALIDATION issue on the note field', async note => {
      await expect(create(note)).rejects.toMatchObject({ code: 'VALIDATION', extra: { issues: [{ path: 'note' }] } });
    });
  it('accepts ordinary notes, short numbers, dates and 10-digit phone-like numbers', async () => {
    for (const note of ['Member planning a trip abroad', 'Ref 12345', 'Travel on 2026-10-01', 'Call 416 555 1234', '12345678', '12345678901']) {
      await expect(create(note), note).resolves.toBeDefined();
    }
  });
  it('boundary: 12 digits pass, 13 digits fail; 20 digits in one run still fail', async () => {
    await expect(create('123456789012')).resolves.toBeDefined();
    await expect(create('1234567890123')).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(create('12345678901234567890')).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
