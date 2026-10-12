import { describe, it, expect } from 'vitest';
import { computeQuote } from '@ef/workflow-core';
import { UexchangeRateProvider } from '../src';

// Skipped by default (no network in tests). Run with: EF_LIVE_RATES=1 npx vitest run packages/adapter-rates/test/live.test.ts
describe.skipIf(!process.env.EF_LIVE_RATES)('live uexchange.ca feed', () => {
  it('parses the real response and quotes 500.00 CAD', async () => {
    const errors: string[] = [];
    const s = await new UexchangeRateProvider({ onError: r => errors.push(r) }).get('USD');
    console.log('LIVE SNAPSHOT', JSON.stringify(s), errors);
    expect(s).not.toBeNull();
    const q = computeQuote({ amount: '500.00', currency: 'CAD' }, 'USD', s);
    console.log('LIVE QUOTE', JSON.stringify(q.available ? { give: q.quote.give, unrounded: q.quote.giveUnrounded, rate: q.quote.rate, side: q.quote.side } : q));
    expect(q.available).toBe(true);
  });
});
