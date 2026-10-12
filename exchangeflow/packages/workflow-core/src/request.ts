import { z } from 'zod';
import { isDecimal, scaleOf, type Context } from '@ef/policy-core';

/** Minor-unit scale per ISO 4217 currency; unknown currencies are rejected (FR-02). */
export const MINOR_UNITS: Readonly<Record<string, number>> = { CAD: 2, USD: 2, EUR: 2, GBP: 2, JPY: 0, CHF: 2, AUD: 2, MXN: 2 };
/** Own keys only, so "constructor" or "__proto__" is never mistaken for a currency. */
export const minorUnitsOf = (currency: string): number | undefined => Object.hasOwn(MINOR_UNITS, currency) ? MINOR_UNITS[currency] : undefined;
// Placeholder field list: the real list is [TBD-Stakeholder] (E3b, DL-N05, DL-N11, DL-N16).
export const REQUEST_TYPES = ['EXCHANGE', 'WIRE'] as const;
export const PAYMENT_METHODS = ['CASH', 'ACCOUNT', 'OTHER'] as const;

const money = z.object({ amount: z.string(), currency: z.string() }).strict();

/** 13 to 19 digits (card number) or exactly 9 digits (SIN pattern), with or without single spaces or dashes between digits. */
export function looksLikeCardOrSin(text: string): boolean {
  return /(?:\d[ -]?){12,18}\d/.test(text) || /(?<!\d)(?:\d[ -]?){8}\d(?!\d)/.test(text);
}

/** Trimmed and single-spaced before validation. Letters of any script, marks, space, apostrophe, period and hyphen; no digits, so a card or SIN number cannot be typed here. */
export const MEMBER_NAME_MESSAGE = 'Enter the name as it appears on the ID, 2 to 80 letters. Do not enter numbers.';
const memberName = z.string().transform(s => s.trim().replace(/\s+/g, ' ')).pipe(
  z.string().min(2, MEMBER_NAME_MESSAGE).max(80, MEMBER_NAME_MESSAGE)
    .regex(/^[\p{L}\p{M}' .\u2019-]+$/u, MEMBER_NAME_MESSAGE).regex(/\p{L}/u, MEMBER_NAME_MESSAGE));

export const RequestValuesSchema = z.object({
  requestType: z.enum(REQUEST_TYPES),
  sell: money,
  buyCurrency: z.string(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  /** Stored by product-owner decision (overrides the references-only default DL-N11 for the name only). Lives only in request_revision.values: never in the context, audit, outbox, inbox, logs, errors or quote. */
  memberName,
  /** Pseudonymous reference to the member in the existing system. Never a name or ID number. */
  memberRef: z.string().max(40).regex(/^[A-Za-z0-9_-]*$/, 'letters, digits, - and _ only').optional(),
  note: z.string().max(200).optional(),
}).strict().superRefine((v, ctx) => {
  const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  if (v.note && looksLikeCardOrSin(v.note)) add(['note'], 'Do not include card or ID numbers. Remove the digits and try again.');
  const scale = minorUnitsOf(v.sell.currency);
  if (scale === undefined) add(['sell', 'currency'], 'unsupported currency');
  if (!isDecimal(v.sell.amount) || v.sell.amount.startsWith('-')) add(['sell', 'amount'], 'amount must be a positive decimal string');
  else {
    if (/^0+(\.0+)?$/.test(v.sell.amount)) add(['sell', 'amount'], 'amount must be greater than zero');
    if (scale !== undefined && scaleOf(v.sell.amount) > scale) add(['sell', 'amount'], `at most ${scale} decimal places for ${v.sell.currency}`);
  }
  if (minorUnitsOf(v.buyCurrency) === undefined) add(['buyCurrency'], 'unsupported currency');
  if (v.buyCurrency === v.sell.currency) add(['buyCurrency'], 'buy and sell currencies must differ');
});
export type RequestValues = z.infer<typeof RequestValuesSchema>;

export interface BranchInfo { branchId: string; timezone: string }

/** Business hours placeholder (Mon to Fri, 09:00 to 17:00 branch time). Hours are [TBD-Stakeholder]. */
export function businessHoursAt(asOf: string, timezone: string): { open: boolean; branchDate: string } {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, weekday: 'short', hour: '2-digit', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date(asOf));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const hour = Number(get('hour'));
  const weekday = get('weekday');
  return { open: !['Sat', 'Sun'].includes(weekday) && hour >= 9 && hour < 17, branchDate: `${get('year')}-${get('month')}-${get('day')}` };
}

/** Built server-side only, from the validated body, the session's branch and the injected clock (SEC-28). */
export function buildContext(v: RequestValues, branch: BranchInfo, asOf: string): Context {
  const bh = businessHoursAt(asOf, branch.timezone);
  return {
    requestType: v.requestType,
    sell: { amount: v.sell.amount, currency: v.sell.currency },
    buy: { currency: v.buyCurrency },
    currencyPair: `${v.sell.currency}/${v.buyCurrency}`,
    paymentMethod: v.paymentMethod,
    branchId: branch.branchId,
    businessHours: bh.open,
    branchDate: bh.branchDate,
  };
}
