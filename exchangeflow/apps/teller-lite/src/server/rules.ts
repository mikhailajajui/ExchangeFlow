import { z } from 'zod';
import { hashOf, type Condition, type PolicyVersion, type RuleVersion } from '@ef/policy-core';
import { minorUnitsOf, PAYMENT_METHODS } from '@ef/workflow-core';

/** The head-office rules file (rules/branch-rules.json). Readable by a person; compiled into an engine policy below. */
const decimal = z.string().regex(/^\d{1,12}(\.\d{1,6})?$/, 'must be a decimal string such as "1000.00"');
/** Canonical IANA name only: "america/toronto" is refused so the record prints the zone as written by IANA. */
const isTimeZone = (tz: string) => { try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).resolvedOptions().timeZone === tz; } catch { return false; } };
const isRealDate = (s: string) => { const d = new Date(`${s}T00:00:00Z`); return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; };
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a date such as 2026-12-25').refine(isRealDate, 'is not a real date');
const unique = <T>(xs: T[]) => new Set(xs).size === xs.length;

export const RulesFileSchema = z.object({
  ruleSetId: z.string().regex(/^[A-Za-z0-9_.-]{1,40}$/),
  version: z.string().regex(/^[A-Za-z0-9_.-]{1,40}$/),
  status: z.enum(['TRIAL', 'APPROVED']),
  approvedBy: z.string().max(80),
  approvedOn: z.union([z.literal(''), date]),
  confirmationEmail: z.string().regex(/^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,190}\.[A-Za-z]{2,}$/, 'must be one plain email address'),
  branches: z.array(z.object({
    id: z.string().regex(/^[A-Za-z0-9_-]{1,20}$/),
    name: z.string().min(1).max(60),
    timezone: z.string().refine(isTimeZone, 'must be an IANA time zone written exactly, such as America/Toronto'),
  }).strict()).min(1),
  currencies: z.array(z.string()).min(2).refine(unique, 'must not repeat a currency'),
  supportedPairs: z.array(z.string().regex(/^[A-Z]{3}\/[A-Z]{3}$/)).min(1, 'must list at least one pair').refine(unique, 'must not repeat a pair'),
  paymentMethods: z.array(z.enum(PAYMENT_METHODS)).min(1).refine(unique, 'must not repeat a payment method'),
  /** Per currency of the amount the member gives. At or below: within branch limits. Above: cannot be done at the branch. */
  branchLimit: z.record(z.string(), decimal),
  businessHoursOnly: z.boolean(),
  /** Branch-local dates on which every request needs head-office review. */
  holidays: z.array(date).refine(unique, 'must not repeat a date'),
}).strict().superRefine((r, ctx) => {
  const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  if (r.status === 'APPROVED' && (!r.approvedBy.trim() || !r.approvedOn)) add(['approvedBy'], 'approvedBy and approvedOn are required when status is APPROVED');
  const ids = r.branches.map(b => b.id);
  if (!unique(ids)) add(['branches'], 'branch ids must be unique');
  r.currencies.forEach((c, i) => {
    const scale = minorUnitsOf(c);
    if (scale === undefined) { add(['currencies', i], `${c} is not a supported currency`); return; }
    const v = Object.hasOwn(r.branchLimit, c) ? r.branchLimit[c] : undefined;
    if (v === undefined) add(['branchLimit', c], `missing a value for ${c}`);
    else if ((v.split('.')[1]?.length ?? 0) > scale) add(['branchLimit', c], `at most ${scale} decimal places for ${c}`);
  });
  for (const k of Object.keys(r.branchLimit)) if (!r.currencies.includes(k)) add(['branchLimit', k], `${k} is not in the currencies list, so this limit would never be used`);
  r.supportedPairs.forEach((p, i) => {
    const [a, b] = p.split('/');
    if (a === b || !r.currencies.includes(a!) || !r.currencies.includes(b!)) add(['supportedPairs', i], `${p} must use two different currencies from the currencies list`);
  });
});
export type RulesFile = z.infer<typeof RulesFileSchema>;

export class RulesFileError extends Error {
  constructor(public issues: string[]) { super(`rules file is not valid: ${issues.join('; ')}`); }
}

/** Keys starting with "#" are notes for people (JSON has no comments); they are removed before the checks. */
export function stripNotes(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([k]) => !k.startsWith('#')));
}

/** Parse and check a rules file. Throws RulesFileError with readable issues for head office. */
export function parseRulesFile(raw: unknown): RulesFile {
  const r = RulesFileSchema.safeParse(stripNotes(raw));
  if (!r.success) throw new RulesFileError(r.error.issues.map(i => `${i.path.join('.') || '(file)'}: ${i.message}`));
  return r.data;
}

function rule(key: string, outcome: RuleVersion['outcome'], conditions: Condition, reasonCode: string, nonProduction: boolean): RuleVersion {
  const base = { ruleKey: key, nonProduction, appliesTo: { requestType: ['EXCHANGE'] }, outcome, conditions, reasonCode };
  return { ruleVersionId: `${key}@${hashOf(base).slice(0, 12)}`, contentHash: hashOf(base), ...base };
}

/**
 * Compile the rules file into an engine policy. The engine's fixed precedence decides between rules: the
 * outside-hours review rule beats a decline, and a decline beats an approve. The guardrail repeats the branch limit,
 * so an automated approval can never exceed it even if a rule is wrong. Payment methods are enforced by validation.
 * TRIAL rules are flagged nonProduction; the desk acts on them under ADR-029 (scoped deviation from ADR-021).
 */
export function compilePolicy(r: RulesFile): PolicyVersion {
  const trial = r.status !== 'APPROVED';
  const pair: Condition = { field: 'currencyPair', op: 'in', value: r.supportedPairs };
  const entries: PolicyVersion['entries'] = [
    // CURRENCY_NOT_SUPPORTED carries the approved generic text "This request cannot be processed automatically."
    { mode: 'ACTIVE', rule: rule('HO-OVER-BRANCH-LIMIT', 'AUTO_DECLINE', { field: 'sell.amount', op: 'gt', value: r.branchLimit }, 'CURRENCY_NOT_SUPPORTED', trial) },
    { mode: 'ACTIVE', rule: rule('HO-PAIR-NOT-SUPPORTED', 'AUTO_DECLINE', { not: pair }, 'CURRENCY_NOT_SUPPORTED', trial) },
    { mode: 'ACTIVE', rule: rule('HO-WITHIN-BRANCH-LIMIT', 'AUTO_APPROVE', { all: [{ field: 'sell.amount', op: 'lte', value: r.branchLimit }, pair] }, 'WITHIN_APPROVED_LIMIT', trial) },
  ];
  if (r.businessHoursOnly) {
    entries.push({ mode: 'ACTIVE', rule: rule('HO-OUTSIDE-HOURS', 'HUMAN_REVIEW', { field: 'businessHours', op: 'eq', value: false }, 'REQUIRES_HEAD_OFFICE_REVIEW', trial) });
  }
  const guardrail = {
    guardrailVersionId: `gr-${r.version}`, maxAutoApprove: r.branchLimit,
    prohibitedCurrencies: [], prohibitedRequestTypes: ['WIRE'], requireFacts: [], holdFacts: [],
  };
  const body = { entries, guardrail };
  return { policyVersionId: `${r.ruleSetId}@${r.version}`, number: 1, policyHash: hashOf(body), ...body };
}
