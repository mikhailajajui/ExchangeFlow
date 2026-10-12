import type { Context, Control, EvaluationInput, Guardrail, PolicyVersion, RuleMode, RuleVersion, Outcome, Condition } from '../src';
import { ENGINE_VERSION } from '../src';

export const ctx = (o: Partial<Context> = {}): Context => ({
  requestType: 'EXCHANGE', sell: { amount: '500.00', currency: 'CAD' }, buy: { currency: 'USD' },
  currencyPair: 'CAD/USD', paymentMethod: 'ACCOUNT', branchId: 'BR-1', businessHours: true, branchDate: '2026-10-01', ...o,
});

export const rule = (key: string, outcome: Outcome, conditions: Condition, o: Partial<RuleVersion> = {}): RuleVersion => ({
  ruleVersionId: `rv-${key}`, ruleKey: key, nonProduction: true, appliesTo: { requestType: ['EXCHANGE'] },
  outcome, conditions, reasonCode: outcome === 'AUTO_APPROVE' ? 'WITHIN_APPROVED_LIMIT' : outcome === 'AUTO_DECLINE' ? 'CURRENCY_NOT_SUPPORTED' : 'REQUIRES_HEAD_OFFICE_REVIEW',
  contentHash: 'h-' + key, ...o,
});

export const guard = (o: Partial<Guardrail> = {}): Guardrail => ({
  guardrailVersionId: 'g1', maxAutoApprove: { CAD: '1500', USD: '1100' }, prohibitedCurrencies: [],
  prohibitedRequestTypes: [], requireFacts: [], holdFacts: [], ...o,
});

export const policy = (entries: [RuleVersion, RuleMode?][], g: Guardrail = guard()): PolicyVersion => ({
  policyVersionId: 'pv1', number: 1, policyHash: 'ph1', entries: entries.map(([r, m]) => ({ rule: r, mode: m ?? 'ACTIVE' })), guardrail: g,
});

export const ctl = (o: Partial<Control> = {}): Control => ({ controlRevision: 1, globalPaused: false, pausedRuleIds: [], ...o });

export const input = (p: PolicyVersion | null, c: Context = ctx(), control: Control = ctl(), compliance = {}): EvaluationInput => ({
  context: c, policy: p, control, asOf: '2026-10-01T15:00:00.000Z', engineVersion: ENGINE_VERSION, compliance,
});

export const LIMIT: Condition = { field: 'sell.amount', op: 'lte', value: { CAD: '1000', USD: '750' } };
export const APPROVE = rule('A1', 'AUTO_APPROVE', LIMIT);
export const DECLINE = rule('D1', 'AUTO_DECLINE', { not: { field: 'currencyPair', op: 'in', value: ['CAD/USD', 'USD/CAD'] } });
export const HUMAN = rule('H1', 'HUMAN_REVIEW', { field: 'sell.amount', op: 'gt', value: { CAD: '10000', USD: '7500' } });
