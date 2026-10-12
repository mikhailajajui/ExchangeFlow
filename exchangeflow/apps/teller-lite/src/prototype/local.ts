/**
 * Prototype mode (GitHub Pages): the same validation, rules compiler and decision engine as the desk server, run in
 * the browser. The rate is a fixed sample, nothing is sent anywhere, and record numbers start with PROTO- so a printout
 * cannot pass for a real record.
 */
import { computeQuote, minorUnitsOf, type RateSnapshot } from '@ef/workflow-core';
import { isDecimal, scaleOf } from '@ef/policy-core';
import rulesJson from '../../rules/branch-rules.json';
import type { DeskConfig, DeskRecord, QuoteView } from '../shared';
import { checkRequest as check, deskConfig, DeskValidationError, quoteCurrencyFor, quoteView } from '../server/desk';
import { parseRulesFile } from '../server/rules';

const rules = parseRulesFile(rulesJson);

/** A fixed sample, labelled as such on the page and the record; not a live or quoted rate. */
export const SAMPLE_RATE: RateSnapshot = {
  currency: 'USD', feedId: 'sample', buy: '1.3500', sell: '1.4500',
  feedUpdatedAt: 'sample rate (prototype)', fetchedAt: '2026-10-12T00:00:00.000Z', stale: false,
};

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function protoRecordNo(at: Date): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `PROTO-${at.toISOString().slice(0, 10).replace(/-/g, '')}-${[...bytes].map(b => CROCKFORD[b % 32]).join('')}`;
}

export type LocalError = { status: number; code: string; issues?: { path: string; message: string }[] };

export async function getConfig(): Promise<DeskConfig> { return deskConfig(rules); }

export async function getQuote(sellAmount: string, sellCurrency: string, buyCurrency: string): Promise<{ available: true; quote: QuoteView } | { available: false; reason: string }> {
  const scale = minorUnitsOf(sellCurrency);
  if (!rules.currencies.includes(sellCurrency) || !rules.currencies.includes(buyCurrency) || scale === undefined) return { available: false, reason: 'UNSUPPORTED_PAIR' };
  if (!isDecimal(sellAmount) || sellAmount.startsWith('-') || scaleOf(sellAmount) > scale) return { available: false, reason: 'INVALID_AMOUNT' };
  const snap = quoteCurrencyFor(sellCurrency, buyCurrency) ? SAMPLE_RATE : null;
  const view = quoteView(computeQuote({ amount: sellAmount, currency: sellCurrency }, buyCurrency, snap));
  return view ? { available: true, quote: view } : { available: false, reason: 'NO_ESTIMATE' };
}

export async function checkRequest(body: unknown): Promise<DeskRecord> {
  const at = new Date();
  try {
    return check(body, rules, at.toISOString(), protoRecordNo(at), SAMPLE_RATE);
  } catch (e) {
    if (e instanceof DeskValidationError) throw { status: 422, code: 'VALIDATION', issues: e.issues } satisfies LocalError;
    throw e;
  }
}
