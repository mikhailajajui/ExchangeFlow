import { z } from 'zod';
import { compareDecimal, isDecimal, scaleOf } from '@ef/policy-core';
import { minorUnitsOf } from './request';

const moneyIn = z.object({ amount: z.string(), currency: z.string() }).strict();

/** Strict body of the completion command. Currency agreement with the request is checked by the service, which knows the request. */
export const CompletionInputSchema = z.object({
  handedOver: moneyIn,
  given: moneyIn,
  rateApplied: z.string(),
  reference: z.string().regex(/^[A-Za-z0-9_-]{3,40}$/, '3 to 40 letters, digits, - and _'),
}).strict().superRefine((v, ctx) => {
  const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
  for (const key of ['handedOver', 'given'] as const) {
    const m = v[key];
    const scale = minorUnitsOf(m.currency);
    if (scale === undefined) add([key, 'currency'], 'unsupported currency');
    if (!isDecimal(m.amount) || m.amount.startsWith('-')) add([key, 'amount'], 'amount must be a positive decimal string');
    else {
      if (/^0+(\.0+)?$/.test(m.amount)) add([key, 'amount'], 'amount must be greater than zero');
      if (scale !== undefined && scaleOf(m.amount) > scale) add([key, 'amount'], `at most ${scale} decimal places for ${m.currency}`);
    }
  }
  if (!isDecimal(v.rateApplied) || v.rateApplied.startsWith('-')) add(['rateApplied'], 'rate must be a positive decimal string');
  else {
    if (/^0+(\.0+)?$/.test(v.rateApplied)) add(['rateApplied'], 'rate must be greater than zero');
    if (scaleOf(v.rateApplied) > 6) add(['rateApplied'], 'at most 6 decimal places');
  }
});
export type CompletionInput = z.infer<typeof CompletionInputSchema>;

/** Exact decimal equality; never throws on malformed input (it counts as different). */
export function sameDecimal(a: string, b: string): boolean {
  try { return compareDecimal(a, b) === 0; } catch { return false; }
}
