import { z } from 'zod';
import { ENGINE_VERSION, evaluate, type Decision } from '@ef/policy-core';
import { buildContext, computeQuote, quoteCurrencyFor, RequestValuesSchema, type RateSnapshot } from '@ef/workflow-core';
import type { DeskConfig, DeskRecord, QuoteView, ResultKind } from '../shared';
import { compilePolicy, type RulesFile } from './rules';

/** What the teller sends. The request part is the main app's own schema, so validation is identical. */
export const DeskInputSchema = z.object({
  branchId: z.string().max(20),
  tellerId: z.string().transform(s => s.trim()).pipe(z.string().regex(/^[A-Za-z0-9_-]{2,20}$/, 'Enter your staff ID: 2 to 20 letters or digits.')),
  values: z.unknown(),
}).strict();

export class DeskValidationError extends Error {
  constructor(public issues: { path: string; message: string }[]) { super('validation'); }
}

const RESULT: Record<Decision['outcome'], { kind: ResultKind; label: string; nextStep: string }> = {
  AUTO_APPROVE: {
    kind: 'WITHIN_LIMITS', label: 'Within branch limits',
    nextStep: 'You may complete the exchange in the banking system. Then email this record to head office for confirmation and keep a copy for the branch file.',
  },
  HUMAN_REVIEW: {
    kind: 'HEAD_OFFICE_REVIEW', label: 'Head-office review needed',
    nextStep: 'Do not complete the exchange yet. Email this record to head office and wait for their confirmation before you go ahead.',
  },
  AUTO_DECLINE: {
    kind: 'NOT_AT_BRANCH', label: 'Cannot be done at the branch',
    nextStep: 'Do not complete the exchange. To escalate, email this record to head office and ask them to review it.',
  },
};

export function deskConfig(r: RulesFile): DeskConfig {
  return {
    ruleSet: { id: r.ruleSetId, version: r.version, status: r.status, approvedBy: r.approvedBy, approvedOn: r.approvedOn },
    confirmationEmail: r.confirmationEmail,
    branches: r.branches.map(b => ({ id: b.id, name: b.name })),
    currencies: r.currencies,
    paymentMethods: r.paymentMethods,
  };
}

/** No estimate when the amount rounds down to nothing (for example 0.01 CAD). */
export const quoteView = (q: ReturnType<typeof computeQuote>): QuoteView | null => q.available && !/^0+(\.0+)?$/.test(q.quote.give.amount)
  ? { give: q.quote.give, rate: q.quote.rate, side: q.quote.side, feedUpdatedAt: q.quote.snapshot.feedUpdatedAt, fetchedAt: q.quote.snapshot.fetchedAt, stale: q.quote.snapshot.stale }
  : null;

/** Validate the form against the main request schema plus the head-office lists. Returns the parsed parts or throws DeskValidationError. */
export function validateDesk(body: unknown, r: RulesFile) {
  const issues: { path: string; message: string }[] = [];
  const outer = DeskInputSchema.safeParse(body);
  if (!outer.success) throw new DeskValidationError(outer.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })));
  const branch = r.branches.find(b => b.id === outer.data.branchId);
  if (!branch) issues.push({ path: 'branchId', message: 'Choose your branch.' });
  const v = RequestValuesSchema.safeParse(outer.data.values);
  if (!v.success) {
    // Messages only: the schema's messages never echo what was typed, so the member name cannot leak into an error body.
    for (const i of v.error.issues) issues.push({ path: i.path.join('.'), message: i.message });
  } else {
    if (v.data.requestType !== 'EXCHANGE') issues.push({ path: 'requestType', message: 'Only currency exchange is available here.' });
    if (!r.currencies.includes(v.data.sell.currency)) issues.push({ path: 'sell.currency', message: 'Choose a currency from the list.' });
    if (!r.currencies.includes(v.data.buyCurrency)) issues.push({ path: 'buyCurrency', message: 'Choose a currency from the list.' });
    if (!(r.paymentMethods as string[]).includes(v.data.paymentMethod)) issues.push({ path: 'paymentMethod', message: 'Choose a payment method from the list.' });
  }
  if (issues.length || !branch || !v.success) throw new DeskValidationError(issues);
  return { branch, tellerId: outer.data.tellerId, values: v.data };
}

/**
 * Check one request and build the printable record. Pure apart from its inputs: the clock (`asOf`), the record number
 * and the rate snapshot are passed in. The member name goes into the record only; it never enters the engine context.
 */
export function checkRequest(body: unknown, r: RulesFile, asOf: string, recordNo: string, rate: RateSnapshot | null): DeskRecord {
  const { branch, tellerId, values } = validateDesk(body, r);
  const policy = compilePolicy(r);
  const built = buildContext(values, { branchId: branch.id, timezone: branch.timezone }, asOf);
  // A head-office holiday counts as outside business hours (branch-local date).
  const context = r.holidays.includes(built.branchDate) ? { ...built, businessHours: false } : built;
  const decision = evaluate({ context, policy, control: { controlRevision: 1, globalPaused: false, pausedRuleIds: [] }, asOf, engineVersion: ENGINE_VERSION, compliance: {} });
  const res = RESULT[decision.outcome];
  return {
    recordNo, createdAt: asOf,
    branchLocalTime: new Intl.DateTimeFormat('en-CA', { timeZone: branch.timezone, dateStyle: 'long', timeStyle: 'short' }).format(new Date(asOf)),
    branch: { id: branch.id, name: branch.name, timezone: branch.timezone },
    tellerId,
    member: { name: values.memberName, ...(values.memberRef ? { ref: values.memberRef } : {}) },
    request: { sell: values.sell, buyCurrency: values.buyCurrency, paymentMethod: values.paymentMethod, ...(values.note ? { note: values.note } : {}) },
    quote: quoteView(computeQuote(values.sell, values.buyCurrency, rate)),
    // Only an approved reason text, and none for "within limits" (no "Approved…" wording on a desk record, DESK-BA-02).
    // The deciding rule and routing cause are never shown (copy rules).
    result: { ...res, reasonText: decision.outcome === 'AUTO_APPROVE' ? '' : decision.reasonText },
    ruleSet: { id: r.ruleSetId, version: r.version, status: r.status, approvedBy: r.approvedBy, approvedOn: r.approvedOn, policyHash: policy.policyHash ?? '' },
    engine: { version: decision.engineVersion, contextHash: decision.contextHash },
    confirmationEmail: r.confirmationEmail,
  };
}

export { quoteCurrencyFor };
