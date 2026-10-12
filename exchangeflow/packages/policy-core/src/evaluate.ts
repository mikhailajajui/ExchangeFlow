import { compareDecimal, isDecimal } from './decimal';
import { hashOf } from './canonical';
import { reasonText } from './reasons';
import type {
  Condition, Context, Decision, EvaluationInput, FallbackCause, Guardrail, Outcome,
  PolicyVersion, RuleMode, RuleVersion, ShadowResult, Tri, ErrorSubCause,
} from './types';

export const ENGINE_VERSION = '0.1.0';
/** Deterministic step budget instead of wall-clock time (replay-safe). A TIMEOUT is excluded from replay equality. */
const MAX_STEPS = 200_000;

class Budget { steps = 0; tick() { if (++this.steps > MAX_STEPS) throw new TimeoutError(); } }
class TimeoutError extends Error {}
class InvalidPolicyError extends Error {}

// ---------- field access ----------
function getField(ctx: Context, path: string): unknown {
  switch (path) {
    case 'requestType': return ctx.requestType;
    case 'sell.amount': return ctx.sell?.amount;
    case 'sell.currency': return ctx.sell?.currency;
    case 'buy.currency': return ctx.buy?.currency;
    case 'buy.amount': return ctx.buy?.amount;
    case 'currencyPair': return ctx.currencyPair;
    case 'paymentMethod': return ctx.paymentMethod;
    case 'branchId': return ctx.branchId;
    case 'businessHours': return ctx.businessHours;
    case 'branchDate': return ctx.branchDate;
    default: throw new InvalidPolicyError(`unknown field ${path}`);
  }
}
const isAmountField = (p: string) => p === 'sell.amount' || p === 'buy.amount';

// ---------- three-valued logic ----------
const tri = (b: boolean): Tri => (b ? 'TRUE' : 'FALSE');
const not3 = (t: Tri): Tri => (t === 'TRUE' ? 'FALSE' : t === 'FALSE' ? 'TRUE' : 'UNKNOWN');
function all3(ts: Tri[]): Tri {
  if (ts.includes('FALSE')) return 'FALSE';
  return ts.includes('UNKNOWN') ? 'UNKNOWN' : 'TRUE';
}
function any3(ts: Tri[]): Tri {
  if (ts.includes('TRUE')) return 'TRUE';
  return ts.includes('UNKNOWN') ? 'UNKNOWN' : 'FALSE';
}

function compare(op: string, a: number): boolean {
  switch (op) {
    case 'eq': return a === 0;
    case 'neq': return a !== 0;
    case 'lt': return a < 0;
    case 'lte': return a <= 0;
    case 'gt': return a > 0;
    case 'gte': return a >= 0;
  }
  throw new InvalidPolicyError(`bad operator ${op}`);
}

/** Per-currency threshold map (BQ-2): the threshold for the request's own currency, else undefined. */
function thresholdFor(value: unknown, currency: string | undefined): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value) && currency) {
    return (value as Record<string, unknown>)[currency];
  }
  return undefined;
}

function evalLeaf(c: { field: string; op: string; value?: unknown }, ctx: Context): Tri {
  const raw = getField(ctx, c.field);
  if (c.op === 'exists') return tri(raw !== undefined && raw !== null && raw !== '');
  if (raw === undefined || raw === null || raw === '') return 'UNKNOWN';

  if (isAmountField(c.field)) {
    if (!isDecimal(raw)) return 'UNKNOWN';
    const ccy = c.field === 'sell.amount' ? ctx.sell?.currency : ctx.buy?.currency;
    const th = thresholdFor(c.value, ccy);
    if (th === undefined) return 'UNKNOWN'; // currency mismatch or no threshold for this currency
    try {
      if (c.op === 'between') {
        if (!Array.isArray(th) || th.length !== 2) throw new InvalidPolicyError('between needs [lo,hi]');
        return tri(compareDecimal(raw, String(th[0])) >= 0 && compareDecimal(raw, String(th[1])) <= 0);
      }
      if (typeof th !== 'string') throw new InvalidPolicyError('amount threshold must be a decimal string');
      return tri(compare(c.op, compareDecimal(raw, th)));
    } catch (e) {
      if (e instanceof InvalidPolicyError) throw e;
      return 'UNKNOWN';
    }
  }

  switch (c.op) {
    case 'in': {
      if (!Array.isArray(c.value)) throw new InvalidPolicyError('in needs a list');
      return tri(c.value.includes(raw));
    }
    case 'eq': return tri(raw === c.value);
    case 'neq': return tri(raw !== c.value);
    default: throw new InvalidPolicyError(`operator ${c.op} not valid for ${c.field}`);
  }
}

function evalCond(c: Condition, ctx: Context, b: Budget, depth = 0): Tri {
  b.tick();
  if (depth > 8) throw new InvalidPolicyError('AST too deep');
  if ('all' in c) return all3(c.all.map(x => evalCond(x, ctx, b, depth + 1)));
  if ('any' in c) return any3(c.any.map(x => evalCond(x, ctx, b, depth + 1)));
  if ('not' in c) return not3(evalCond(c.not, ctx, b, depth + 1));
  return evalLeaf(c, ctx);
}

const inScope = (r: RuleVersion, ctx: Context): boolean =>
  !r.appliesTo.requestType || r.appliesTo.requestType.includes(ctx.requestType);

// ---------- guardrail (ADR-025): applies to every automated outcome, only downgrades ----------
function guardrailRejects(g: Guardrail, ctx: Context, compliance: Record<string, Tri>): string | null {
  if (g.prohibitedRequestTypes.includes(ctx.requestType)) return 'PROHIBITED_REQUEST_TYPE';
  if (g.prohibitedCurrencies.includes(ctx.sell.currency) || g.prohibitedCurrencies.includes(ctx.buy.currency)) {
    return 'PROHIBITED_CURRENCY';
  }
  for (const f of g.holdFacts) if (compliance[f] === 'TRUE') return `HOLD:${f}`;
  for (const f of g.requireFacts) if ((compliance[f] ?? 'UNKNOWN') !== 'TRUE') return `FACT_NOT_CLEAR:${f}`;
  return null;
}
function exceedsMaxAutoApprove(g: Guardrail, ctx: Context): boolean {
  const max = g.maxAutoApprove[ctx.sell.currency];
  if (max === undefined) return true; // no limit configured for this currency: not safe to auto-approve
  try { return compareDecimal(ctx.sell.amount, max) > 0; } catch { return true; }
}

function validatePolicy(p: PolicyVersion): void {
  if (!Array.isArray(p.entries) || !p.guardrail) throw new InvalidPolicyError('malformed policy');
  for (const e of p.entries) {
    if (!e.rule || !e.rule.conditions || !['AUTO_APPROVE', 'AUTO_DECLINE', 'HUMAN_REVIEW'].includes(e.rule.outcome)) {
      throw new InvalidPolicyError('malformed rule');
    }
  }
}

function shell(input: EvaluationInput): Pick<Decision,
  'policyVersionId' | 'policyHash' | 'controlRevision' | 'asOf' | 'engineVersion' | 'contextHash'> {
  return {
    policyVersionId: input.policy?.policyVersionId ?? null,
    policyHash: input.policy?.policyHash ?? null,
    controlRevision: input.control.controlRevision,
    asOf: input.asOf,
    engineVersion: input.engineVersion,
    contextHash: hashOf({ context: input.context, compliance: input.compliance }),
  };
}

function human(input: EvaluationInput, cause: FallbackCause, extra: Partial<Decision> = {}): Decision {
  return {
    outcome: 'HUMAN_REVIEW', fallbackCause: cause,
    matchedRules: [], unknownRules: [], pausedMatches: [], shadowResults: [], alerts: [],
    reasonCode: cause === 'RULE_REQUIRES_HUMAN' ? 'REQUIRES_HEAD_OFFICE_REVIEW' : cause,
    reasonText: reasonText(cause === 'RULE_REQUIRES_HUMAN' ? 'REQUIRES_HEAD_OFFICE_REVIEW' : cause),
    ...shell(input), ...extra,
  };
}

/** evaluate(input) -> Decision. Pure, total and deterministic. Any exception becomes HUMAN_REVIEW / ENGINE_ERROR. */
export function evaluate(input: EvaluationInput): Decision {
  try {
    return evaluateInner(input);
  } catch (e) {
    const sub: ErrorSubCause = e instanceof TimeoutError ? 'TIMEOUT' : e instanceof InvalidPolicyError ? 'INVALID_POLICY' : 'EXCEPTION';
    return human(input, 'ENGINE_ERROR', { errorSubCause: sub });
  }
}

function evaluateInner(input: EvaluationInput): Decision {
  const { context: ctx, policy, control } = input;
  const base = (): Decision => ({
    outcome: 'HUMAN_REVIEW', matchedRules: [], unknownRules: [], pausedMatches: [], shadowResults: [], alerts: [],
    reasonCode: 'NO_MATCH', reasonText: reasonText('NO_MATCH'), ...shell(input),
  });

  // Row 2: no policy / invalid policy.
  if (!policy) {
    return finish(input, human(input, control.globalPaused ? 'ENGINE_PAUSED' : 'ENGINE_ERROR',
      control.globalPaused ? {} : { errorSubCause: 'NO_POLICY' }));
  }
  validatePolicy(policy);
  const budget = new Budget();
  const d = base();

  const paused = new Set(control.pausedRuleIds);
  const scoped = policy.entries.filter(e => inScope(e.rule, ctx));

  // Shadow pass, isolated: nothing here can reach the applied outcome.
  for (const e of scoped.filter(x => x.mode === 'SHADOW')) {
    let wouldBe: ShadowResult['wouldBe'];
    try {
      const t = evalCond(e.rule.conditions, ctx, budget);
      wouldBe = t === 'TRUE' ? e.rule.outcome : t === 'UNKNOWN' ? 'UNKNOWN' : 'UNKNOWN';
      if (t === 'FALSE') continue;
    } catch { wouldBe = 'ERROR'; }
    d.shadowResults.push({ ruleKey: e.rule.ruleKey, wouldBe });
  }

  // Active (and paused) pass.
  const active = scoped.filter(x => x.mode === 'ACTIVE');
  const results = active.map(e => ({ e, t: evalCond(e.rule.conditions, ctx, budget), paused: paused.has(e.rule.ruleVersionId) || paused.has(e.rule.ruleKey) }));

  const live = results.filter(r => !r.paused);
  const pausedHit = results.filter(r => r.paused && r.t !== 'FALSE');
  const trueOf = (o: Outcome) => live.filter(r => r.t === 'TRUE' && r.e.rule.outcome === o).map(r => r.e.rule);
  const approve = trueOf('AUTO_APPROVE'), decline = trueOf('AUTO_DECLINE'), humanRules = trueOf('HUMAN_REVIEW');
  const unknown = live.filter(r => r.t === 'UNKNOWN');

  d.matchedRules = live.filter(r => r.t === 'TRUE').map(r => r.e.rule.ruleKey).sort();
  d.unknownRules = unknown.map(r => r.e.rule.ruleKey).sort();
  d.pausedMatches = pausedHit.map(r => r.e.rule.ruleKey).sort();
  d.shadowResults.sort((a, b) => a.ruleKey.localeCompare(b.ruleKey));
  if (approve.length && decline.length) d.alerts.push('CONFLICT'); // raised even when another row decides

  const lowest = (rs: RuleVersion[]) => rs.map(r => r.ruleKey).sort()[0];
  const setHuman = (cause: FallbackCause, rule?: string) => {
    d.outcome = 'HUMAN_REVIEW'; d.fallbackCause = cause; d.decidingRuleKey = rule;
    d.reasonCode = cause === 'RULE_REQUIRES_HUMAN' ? 'REQUIRES_HEAD_OFFICE_REVIEW' : cause;
    d.reasonText = reasonText(d.reasonCode);
  };

  if (humanRules.length) setHuman('RULE_REQUIRES_HUMAN', lowest(humanRules));          // row 3
  else if (pausedHit.length) setHuman('RULE_PAUSED');                                   // row 4
  else if (unknown.length) setHuman('MISSING_DATA');                                    // row 5
  else if (approve.length && decline.length) setHuman('CONFLICT');                      // row 6
  else if (decline.length) {                                                            // row 7
    d.outcome = 'AUTO_DECLINE'; d.decidingRuleKey = lowest(decline);
    const r = decline.find(x => x.ruleKey === d.decidingRuleKey)!;
    d.reasonCode = r.reasonCode; d.reasonText = reasonText(r.reasonCode);
  } else if (approve.length) {                                                          // row 8
    d.outcome = 'AUTO_APPROVE'; d.decidingRuleKey = lowest(approve);
    const r = approve.find(x => x.ruleKey === d.decidingRuleKey)!;
    d.reasonCode = r.reasonCode; d.reasonText = reasonText(r.reasonCode);
  } else setHuman('NO_MATCH');                                                          // row 10

  // Row 9: guardrail applies to every automated outcome and can only downgrade.
  if (d.outcome !== 'HUMAN_REVIEW') {
    const why = guardrailRejects(policy.guardrail, ctx, input.compliance)
      ?? (d.outcome === 'AUTO_APPROVE' && exceedsMaxAutoApprove(policy.guardrail, ctx) ? 'OVER_MAX_AUTO_APPROVE' : null);
    if (why) { setHuman('GUARDRAIL'); d.restrictedDetail = why; }
  }
  return finish(input, d);
}

/** Row 1: global pause overrides everything, but would-be and shadow results are kept. */
function finish(input: EvaluationInput, d: Decision): Decision {
  if (input.control.globalPaused && d.fallbackCause !== 'ENGINE_PAUSED') {
    const was = d.outcome;
    d.outcome = 'HUMAN_REVIEW'; d.fallbackCause = 'ENGINE_PAUSED'; d.errorSubCause = undefined;
    d.reasonCode = 'ENGINE_PAUSED'; d.reasonText = reasonText('ENGINE_PAUSED');
    d.alerts.push(`WOULD_BE:${was}`);
  }
  return d;
}

export function isAutomated(o: Outcome): boolean { return o !== 'HUMAN_REVIEW'; }

/** Resubmission floor (ADR-022): re-evaluated for the record, but always applied as human review. */
export function applyResubmissionFloor(d: Decision): { applied: Decision; engineOutcome: Outcome } {
  if (d.outcome === 'HUMAN_REVIEW') return { applied: d, engineOutcome: d.outcome };
  return {
    engineOutcome: d.outcome,
    applied: { ...d, outcome: 'HUMAN_REVIEW', fallbackCause: 'RESUBMISSION_FLOOR', reasonCode: 'RESUBMISSION_FLOOR', reasonText: reasonText('RESUBMISSION_FLOOR') },
  };
}

export type { RuleMode };
