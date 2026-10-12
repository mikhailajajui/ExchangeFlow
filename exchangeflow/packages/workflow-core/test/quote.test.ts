import { describe, it, expect } from 'vitest';
import { computeQuote, quoteCurrencyFor, type RateSnapshot } from '../src';

const snap = (o: Partial<RateSnapshot> = {}): RateSnapshot => ({
  currency: 'USD', feedId: '20', buy: '1.3900', sell: '1.4499', feedUpdatedAt: '2026-10-01 19:03:18', fetchedAt: '2026-10-02T12:00:00.000Z', stale: false, ...o,
});
const cadToUsd = (amount: string, s: RateSnapshot | null = snap()) => computeQuote({ amount, currency: 'CAD' }, 'USD', s);
const usdToCad = (amount: string, s: RateSnapshot | null = snap()) => computeQuote({ amount, currency: 'USD' }, 'CAD', s);
const ok = (r: ReturnType<typeof computeQuote>) => { if (!r.available) throw new Error(`unavailable: ${r.reason}`); return r.quote; };

// Constants below were computed independently with Python Decimal (prec 50):
//   Decimal('500.00') / Decimal('1.4499')  = 344.85136905993516794...
//   Decimal('100.00') * Decimal('1.3900')  = 139.000000
//   Decimal('1000000000000.00') / Decimal('1.4499') = 689702738119.8703358...
describe('computeQuote vectors', () => {
  it('member sells 500.00 CAD: teller gives USD at the sell rate, floored to the cent', () => {
    const q = ok(cadToUsd('500.00'));
    expect(q.give).toEqual({ amount: '344.85', currency: 'USD' });
    expect(q.giveUnrounded).toBe('344.851369');
    expect(q).toMatchObject({ side: 'SELL_RATE', rate: '1.4499', rounding: 'FLOOR_MINOR_UNIT', sell: { amount: '500.00', currency: 'CAD' } });
  });
  it('member sells 100.00 USD: teller gives CAD at the buy rate', () => {
    const q = ok(usdToCad('100.00'));
    expect(q.give).toEqual({ amount: '139.00', currency: 'CAD' });
    expect(q.giveUnrounded).toBe('139.000000');
    expect(q).toMatchObject({ side: 'BUY_RATE', rate: '1.3900' });
  });
  it('a rate with extra digits is used exactly', () => {
    // Python: Decimal('100.00') * Decimal('1.39129999') = 139.129999 -> 139.12 (a round would say 139.13)
    const q = ok(usdToCad('100.00', snap({ buy: '1.39129999' })));
    expect(q.give.amount).toBe('139.12'); expect(q.giveUnrounded).toBe('139.129999');
  });
  it('floors rather than rounds', () => {
    // Python: Decimal('1.00') / Decimal('1.4499') = 0.68970... -> 0.68 (a round would say 0.69)
    expect(ok(cadToUsd('1.00')).give.amount).toBe('0.68');
    // Python: Decimal('0.01') * Decimal('1.3900') = 0.013900 -> 0.01
    expect(ok(usdToCad('0.01')).give.amount).toBe('0.01');
    // Python: Decimal('0.01') / Decimal('1.4499') = 0.00689... -> 0.00
    expect(ok(cadToUsd('0.01')).give.amount).toBe('0.00');
  });
  it('huge amounts stay exact', () => {
    // Python: Decimal('999999999999999999.99') * Decimal('1.3900') = 1389999999999999999.9861 -> 1389999999999999999.98
    const q = ok(usdToCad('999999999999999999.99'));
    expect(q.give.amount).toBe('1389999999999999999.98'); expect(q.giveUnrounded).toBe('1389999999999999999.986100');
    // Python: Decimal('1000000000000.00') / Decimal('1.4499') = 689702738119.8703358...
    const big = ok(cadToUsd('1000000000000.00'));
    expect(big.give.amount).toBe('689702738119.87');
  });
  it('only USD against CAD is quotable; any other pair is UNSUPPORTED_PAIR', () => {
    expect(computeQuote({ amount: '10.00', currency: 'CAD' }, 'EUR', snap())).toEqual({ available: false, reason: 'UNSUPPORTED_PAIR' });
    expect(computeQuote({ amount: '10.00', currency: 'USD' }, 'EUR', snap())).toEqual({ available: false, reason: 'UNSUPPORTED_PAIR' });
    expect(computeQuote({ amount: '10.00', currency: 'EUR' }, 'GBP', null)).toEqual({ available: false, reason: 'UNSUPPORTED_PAIR' });
    expect(quoteCurrencyFor('CAD', 'USD')).toBe('USD'); expect(quoteCurrencyFor('USD', 'CAD')).toBe('USD'); expect(quoteCurrencyFor('CAD', 'JPY')).toBeNull();
  });
  it('no snapshot, or a snapshot for another currency, is RATE_UNAVAILABLE', () => {
    expect(cadToUsd('10.00', null)).toEqual({ available: false, reason: 'RATE_UNAVAILABLE' });
    expect(cadToUsd('10.00', snap({ currency: 'EUR' }))).toEqual({ available: false, reason: 'RATE_UNAVAILABLE' });
  });
  it('zero, negative and non-decimal rates are rejected', () => {
    for (const bad of ['0', '0.0000', '-1.4499', '1,4499', '1e3', 'abc', '', ' 1.4499']) {
      expect(cadToUsd('10.00', snap({ sell: bad })), `sell ${bad}`).toEqual({ available: false, reason: 'INVALID_RATE' });
      expect(usdToCad('10.00', snap({ buy: bad })), `buy ${bad}`).toEqual({ available: false, reason: 'INVALID_RATE' });
    }
  });
  it('only the rate for the side in use matters', () => {
    expect(cadToUsd('10.00', snap({ buy: 'junk' })).available).toBe(true);
    expect(usdToCad('10.00', snap({ sell: 'junk' })).available).toBe(true);
  });
  it('invalid amounts give no quote instead of a wrong one', () => {
    for (const bad of ['0', '0.00', '-5.00', 'x', '', '1e3']) expect(cadToUsd(bad)).toEqual({ available: false, reason: 'INVALID_AMOUNT' });
  });
  it('the snapshot, including the stale flag, travels with the quote', () => {
    expect(ok(cadToUsd('10.00', snap({ stale: true }))).snapshot).toMatchObject({ stale: true, feedUpdatedAt: '2026-10-01 19:03:18', feedId: '20' });
  });
});
