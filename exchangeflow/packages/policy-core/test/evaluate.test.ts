import { describe, it, expect } from 'vitest';
import { evaluate, applyResubmissionFloor, canonicalJson } from '../src';
import { ctx, ctl, guard, input, policy, rule, APPROVE, DECLINE, HUMAN } from './fixtures';

const ev = (p: ReturnType<typeof policy> | null, c = ctx(), control = ctl(), comp = {}) => evaluate(input(p, c, control, comp));

describe('decision table', () => {
  it('DT-01 approve rule matches -> AUTO_APPROVE', () => {
    const d = ev(policy([[APPROVE]]));
    expect(d.outcome).toBe('AUTO_APPROVE'); expect(d.decidingRuleKey).toBe('A1');
  });
  it('DT-02 no rule matches -> HUMAN_REVIEW / NO_MATCH', () => {
    const d = ev(policy([[APPROVE]]), ctx({ sell: { amount: '5000.00', currency: 'CAD' } }));
    expect(d.outcome).toBe('HUMAN_REVIEW'); expect(d.fallbackCause).toBe('NO_MATCH');
  });
  it('DT-03 several same-outcome rules: deciding rule is the lowest ruleKey', () => {
    const d = ev(policy([[rule('A2', 'AUTO_APPROVE', APPROVE.conditions)], [rule('A0', 'AUTO_APPROVE', APPROVE.conditions)]]));
    expect(d.decidingRuleKey).toBe('A0');
  });
  it('DT-06 human-review rule wins; conflict alert still raised (DT-10)', () => {
    const big = ctx({ sell: { amount: '20000.00', currency: 'CAD' } });
    const always = rule('A9', 'AUTO_APPROVE', { field: 'requestType', op: 'exists' });
    const dec = rule('D9', 'AUTO_DECLINE', { field: 'requestType', op: 'exists' });
    const d = ev(policy([[always], [dec], [HUMAN]]), big);
    expect(d.fallbackCause).toBe('RULE_REQUIRES_HUMAN'); expect(d.alerts).toContain('CONFLICT');
  });
  it('DT-07 approve and decline both match -> CONFLICT', () => {
    const always = rule('A9', 'AUTO_APPROVE', { field: 'requestType', op: 'exists' });
    const dec = rule('D9', 'AUTO_DECLINE', { field: 'requestType', op: 'exists' });
    expect(ev(policy([[always], [dec]])).fallbackCause).toBe('CONFLICT');
  });
  it('DT-12 decline rule matches -> AUTO_DECLINE', () => {
    const d = ev(policy([[DECLINE]]), ctx({ currencyPair: 'CAD/JPY', buy: { currency: 'JPY' } }));
    expect(d.outcome).toBe('AUTO_DECLINE'); expect(d.reasonText).toBe('This request cannot be processed automatically.');
  });
  it('INV-3VL-1: decline rule on missing field is UNKNOWN -> MISSING_DATA, never AUTO_DECLINE', () => {
    const d = ev(policy([[DECLINE]]), ctx({ currencyPair: '' }));
    expect(d.outcome).toBe('HUMAN_REVIEW'); expect(d.fallbackCause).toBe('MISSING_DATA');
  });
  it('DT-17 Kleene: a missing field in a branch the result does not depend on is ignored', () => {
    const r = rule('K1', 'AUTO_APPROVE', { any: [{ field: 'paymentMethod', op: 'eq', value: 'ACCOUNT' }, { field: 'branchDate', op: 'eq', value: 'x' }] });
    expect(ev(policy([[r]]), ctx({ branchDate: '' })).outcome).toBe('AUTO_APPROVE');
  });
  it('out-of-scope rule is skipped and cannot produce MISSING_DATA', () => {
    const r = rule('W1', 'AUTO_APPROVE', { field: 'paymentMethod', op: 'eq', value: 'CASH' }, { appliesTo: { requestType: ['WIRE'] } });
    expect(ev(policy([[r], [APPROVE]])).outcome).toBe('AUTO_APPROVE');
  });
  it('currency with no threshold in the map -> UNKNOWN -> MISSING_DATA', () => {
    const d = ev(policy([[APPROVE]]), ctx({ sell: { amount: '10.00', currency: 'EUR' } }));
    expect(d.fallbackCause).toBe('MISSING_DATA');
  });
  it('decimal equivalence at the threshold: "1000" and "1000.00" both pass lte', () => {
    expect(ev(policy([[APPROVE]]), ctx({ sell: { amount: '1000.00', currency: 'CAD' } })).outcome).toBe('AUTO_APPROVE');
    expect(ev(policy([[APPROVE]]), ctx({ sell: { amount: '1000.01', currency: 'CAD' } })).outcome).toBe('HUMAN_REVIEW');
  });
});

describe('shadow, pause, guardrail, errors', () => {
  it('DT-15 shadow rule never changes the applied outcome', () => {
    const sh = rule('S1', 'AUTO_APPROVE', APPROVE.conditions);
    const d = ev(policy([[sh, 'SHADOW']]));
    expect(d.outcome).toBe('HUMAN_REVIEW'); expect(d.shadowResults).toEqual([{ ruleKey: 'S1', wouldBe: 'AUTO_APPROVE' }]);
  });
  it('DT-37 shadow rule on bad data records ERROR/UNKNOWN, applied outcome unchanged', () => {
    const bad = rule('S2', 'AUTO_APPROVE', { field: 'nope', op: 'exists' });
    const d = ev(policy([[APPROVE], [bad, 'SHADOW']]));
    expect(d.outcome).toBe('AUTO_APPROVE'); expect(d.shadowResults[0]!.wouldBe).toBe('ERROR');
  });
  it('DT-26 paused approve rule that matches -> RULE_PAUSED (pause is safe)', () => {
    const d = ev(policy([[APPROVE]]), ctx(), ctl({ pausedRuleIds: ['rv-A1'] }));
    expect(d.fallbackCause).toBe('RULE_PAUSED'); expect(d.outcome).toBe('HUMAN_REVIEW');
  });
  it('P5 pausing a decline rule never turns it into an approve', () => {
    const c = ctx({ currencyPair: 'CAD/JPY', buy: { currency: 'JPY' } });
    const d = ev(policy([[DECLINE]]), c, ctl({ pausedRuleIds: ['rv-D1'] }));
    expect(d.outcome).toBe('HUMAN_REVIEW');
  });
  it('DT-23 global pause -> ENGINE_PAUSED, would-be result recorded', () => {
    const d = ev(policy([[APPROVE]]), ctx(), ctl({ globalPaused: true }));
    expect(d.fallbackCause).toBe('ENGINE_PAUSED'); expect(d.alerts).toContain('WOULD_BE:AUTO_APPROVE');
  });
  it('DT-22 no policy -> ENGINE_ERROR / NO_POLICY', () => {
    const d = ev(null); expect(d.fallbackCause).toBe('ENGINE_ERROR'); expect(d.errorSubCause).toBe('NO_POLICY');
  });
  it('DT-21 malformed rule at runtime -> ENGINE_ERROR / INVALID_POLICY', () => {
    const bad = rule('B1', 'AUTO_APPROVE', { field: 'sell.amount', op: 'gte', value: { CAD: 5 as unknown as string } });
    const d = ev(policy([[bad]])); expect(d.errorSubCause).toBe('INVALID_POLICY'); expect(d.outcome).toBe('HUMAN_REVIEW');
  });
  it('guardrail downgrades an approve that is over the max auto-approve amount', () => {
    const wide = rule('A5', 'AUTO_APPROVE', { field: 'requestType', op: 'exists' });
    const d = ev(policy([[wide]]), ctx({ sell: { amount: '1600.00', currency: 'CAD' } }));
    expect(d.fallbackCause).toBe('GUARDRAIL'); expect(d.restrictedDetail).toBe('OVER_MAX_AUTO_APPROVE');
  });
  it('ADR-025: guardrail also downgrades an AUTO_DECLINE (prohibited currency)', () => {
    const c = ctx({ currencyPair: 'CAD/JPY', buy: { currency: 'JPY' } });
    const d = ev(policy([[DECLINE]], guard({ prohibitedCurrencies: ['JPY'] })), c);
    expect(d.outcome).toBe('HUMAN_REVIEW'); expect(d.fallbackCause).toBe('GUARDRAIL');
  });
  it('ADR-025: required compliance fact UNKNOWN or missing -> human review; TRUE -> automated', () => {
    const p = policy([[APPROVE]], guard({ requireFacts: ['screeningClear'] }));
    expect(ev(p).fallbackCause).toBe('GUARDRAIL');
    expect(ev(p, ctx(), ctl(), { screeningClear: 'UNKNOWN' }).fallbackCause).toBe('GUARDRAIL');
    expect(ev(p, ctx(), ctl(), { screeningClear: 'TRUE' }).outcome).toBe('AUTO_APPROVE');
  });
  it('ADR-025: a hold fact forces human review', () => {
    const p = policy([[APPROVE]], guard({ holdFacts: ['complianceHold'] }));
    expect(ev(p, ctx(), ctl(), { complianceHold: 'TRUE' }).fallbackCause).toBe('GUARDRAIL');
  });
  it('reason text never carries restricted terms', () => {
    const c = ctx({ sell: { amount: '1600.00', currency: 'CAD' } });
    const d = ev(policy([[rule('A5', 'AUTO_APPROVE', { field: 'requestType', op: 'exists' })]], guard({ holdFacts: ['complianceHold'] })), c, ctl(), { complianceHold: 'TRUE' });
    expect(d.reasonText).not.toMatch(/suspic|sanction|pep|fintrac|screen|hold|limit/i);
  });
});

describe('determinism and floor', () => {
  it('INV-DET-1 identical input gives byte-identical canonical output', () => {
    const p = policy([[APPROVE], [DECLINE], [HUMAN]]);
    expect(canonicalJson(ev(p))).toBe(canonicalJson(ev(p)));
  });
  it('P1 rule order does not change the result', () => {
    const a = ev(policy([[APPROVE], [DECLINE], [HUMAN]])), b = ev(policy([[HUMAN], [DECLINE], [APPROVE]]));
    expect(canonicalJson(a)).toBe(canonicalJson(b));
  });
  it('ADR-022 resubmission floor keeps the engine outcome but applies human review', () => {
    const { applied, engineOutcome } = applyResubmissionFloor(ev(policy([[APPROVE]])));
    expect(engineOutcome).toBe('AUTO_APPROVE'); expect(applied.outcome).toBe('HUMAN_REVIEW'); expect(applied.fallbackCause).toBe('RESUBMISSION_FLOOR');
  });
});
