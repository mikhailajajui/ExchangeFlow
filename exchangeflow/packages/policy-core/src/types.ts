export type Outcome = 'AUTO_APPROVE' | 'AUTO_DECLINE' | 'HUMAN_REVIEW';
export type Tri = 'TRUE' | 'FALSE' | 'UNKNOWN';
export type RuleMode = 'ACTIVE' | 'SHADOW';

export type FallbackCause =
  | 'ENGINE_PAUSED' | 'ENGINE_ERROR' | 'GUARDRAIL' | 'RULE_REQUIRES_HUMAN' | 'RULE_PAUSED'
  | 'MISSING_DATA' | 'CONFLICT' | 'NO_MATCH' | 'RESUBMISSION_FLOOR';
export type ErrorSubCause = 'TIMEOUT' | 'NO_POLICY' | 'INVALID_POLICY' | 'EXCEPTION';

/** Money is a decimal string plus an ISO 4217 currency, never a float (ADR-008). */
export interface Money { amount: string; currency: string }

export interface Context {
  requestType: string;
  sell: Money;
  buy: { currency: string; amount?: string };
  currencyPair: string;
  paymentMethod: string;
  branchId: string;
  businessHours: boolean;
  branchDate: string;
}

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { field: string; op: 'exists' }
  | { field: string; op: 'eq' | 'neq' | 'lt' | 'lte' | 'gt' | 'gte' | 'in' | 'between'; value: unknown };

export interface RuleVersion {
  ruleVersionId: string;
  ruleKey: string;
  nonProduction: boolean;
  appliesTo: { requestType?: string[] };
  outcome: Outcome;
  conditions: Condition;
  reasonCode: string;
  contentHash: string;
}

export interface PolicyVersion {
  policyVersionId: string;
  number: number;
  policyHash: string;
  entries: { rule: RuleVersion; mode: RuleMode }[];
  guardrail: Guardrail;
}

/** Compliance-owned. Applies to every automated outcome and can only downgrade (ADR-025). */
export interface Guardrail {
  guardrailVersionId: string;
  maxAutoApprove: Record<string, string>;
  prohibitedCurrencies: string[];
  prohibitedRequestTypes: string[];
  /** Facts that must be TRUE for any automated outcome. Missing or UNKNOWN downgrades. */
  requireFacts: string[];
  /** Facts that force human review when TRUE (for example a compliance hold). */
  holdFacts: string[];
}

export interface Control {
  controlRevision: number;
  globalPaused: boolean;
  pausedRuleIds: string[];
}

export interface EvaluationInput {
  context: Context;
  policy: PolicyVersion | null;
  control: Control;
  asOf: string;
  engineVersion: string;
  /** Restricted part (ADR-026): tri-state compliance facts, readable only by the guardrail. */
  compliance: Record<string, Tri>;
}

export interface ShadowResult { ruleKey: string; wouldBe: Outcome | 'UNKNOWN' | 'ERROR' }

export interface Decision {
  outcome: Outcome;
  fallbackCause?: FallbackCause;
  errorSubCause?: ErrorSubCause;
  /** Detail only for the restricted store; general readers see `fallbackCause` GUARDRAIL. */
  restrictedDetail?: string;
  decidingRuleKey?: string;
  matchedRules: string[];
  unknownRules: string[];
  pausedMatches: string[];
  shadowResults: ShadowResult[];
  alerts: string[];
  reasonCode: string;
  reasonText: string;
  policyVersionId: string | null;
  policyHash: string | null;
  controlRevision: number;
  asOf: string;
  engineVersion: string;
  contextHash: string;
}
