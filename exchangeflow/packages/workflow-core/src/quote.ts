import { divDecimalFloor, floorToScale, isDecimal, mulDecimal } from '@ef/policy-core';
import { minorUnitsOf } from './request';

/** Currency to uexchange.ca feed id. Only USD is configured; add entries to quote more currencies. */
export const RATE_FEED_IDS: Readonly<Record<string, string>> = { USD: '20' };
export const BASE_CURRENCY = 'CAD';
/** Own keys only, so "constructor" or "__proto__" never has a feed id. */
export const feedIdOf = (currency: string): string | undefined => Object.hasOwn(RATE_FEED_IDS, currency) ? RATE_FEED_IDS[currency] : undefined;

/** Indicative rate from the feed. `buy` and `sell` are CAD per 1 unit of `currency`, from the institution's view. Never used by the engine (FR-70). */
export interface RateSnapshot {
  currency: string; feedId: string; buy: string; sell: string;
  /** The feed's own `last_update` string, not converted to another time zone. */
  feedUpdatedAt: string;
  /** Our clock, UTC ISO. */
  fetchedAt: string;
  stale: boolean;
}

export interface Quote {
  /** What the teller gives the member. */
  give: { amount: string; currency: string };
  /** The exact value floored to 6 decimals. */
  giveUnrounded: string;
  rounding: 'FLOOR_MINOR_UNIT';
  /** SELL_RATE: member sells CAD, the institution sells the foreign currency. BUY_RATE: member sells the foreign currency. */
  side: 'SELL_RATE' | 'BUY_RATE';
  rate: string;
  sell: { amount: string; currency: string };
  snapshot: RateSnapshot;
}
export type QuoteUnavailableReason = 'UNSUPPORTED_PAIR' | 'RATE_UNAVAILABLE' | 'INVALID_RATE' | 'INVALID_AMOUNT';
export type QuoteResult = { available: true; quote: Quote } | { available: false; reason: QuoteUnavailableReason };

/** The currency whose rate is needed for this pair, or null when the pair is not quotable (one side must be CAD and the other configured). */
export function quoteCurrencyFor(sellCurrency: string, buyCurrency: string): string | null {
  if (sellCurrency === BASE_CURRENCY && feedIdOf(buyCurrency) !== undefined) return buyCurrency;
  if (buyCurrency === BASE_CURRENCY && feedIdOf(sellCurrency) !== undefined) return sellCurrency;
  return null;
}

const positive = (s: unknown): s is string => isDecimal(s) && !s.startsWith('-') && !/^0+(\.0*)?$/.test(s);

/** Exact decimal arithmetic, result floored to the minor unit of the currency the teller gives. Never throws on bad data; it reports why there is no quote. */
export function computeQuote(sell: { amount: string; currency: string }, buyCurrency: string, snapshot: RateSnapshot | null): QuoteResult {
  const foreign = quoteCurrencyFor(sell.currency, buyCurrency);
  if (!foreign) return { available: false, reason: 'UNSUPPORTED_PAIR' };
  if (!snapshot || snapshot.currency !== foreign) return { available: false, reason: 'RATE_UNAVAILABLE' };
  if (!positive(sell.amount)) return { available: false, reason: 'INVALID_AMOUNT' };
  const memberSellsBase = sell.currency === BASE_CURRENCY;
  const rate = memberSellsBase ? snapshot.sell : snapshot.buy;
  if (!positive(rate)) return { available: false, reason: 'INVALID_RATE' };
  const scale = minorUnitsOf(buyCurrency);
  if (scale === undefined) return { available: false, reason: 'UNSUPPORTED_PAIR' };
  const exact = memberSellsBase ? null : mulDecimal(sell.amount, rate);
  const amount = memberSellsBase ? divDecimalFloor(sell.amount, rate, scale) : floorToScale(exact!, scale);
  const giveUnrounded = memberSellsBase ? divDecimalFloor(sell.amount, rate, 6) : floorToScale(exact!, 6);
  return {
    available: true,
    quote: {
      give: { amount, currency: buyCurrency }, giveUnrounded, rounding: 'FLOOR_MINOR_UNIT',
      side: memberSellsBase ? 'SELL_RATE' : 'BUY_RATE', rate, sell: { amount: sell.amount, currency: sell.currency }, snapshot,
    },
  };
}
