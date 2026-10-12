import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/prototype/crypto-shim';
import { checkRequest, getConfig, getQuote } from '../src/prototype/local';

describe('prototype SHA-256 shim matches node:crypto', () => {
  it.each(['', 'abc', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000), 'Côté 1 500,00 $ ✓', '{"context":{"sell":{"amount":"500.00"}}}'])('%#', s => {
    expect(sha256Hex(s)).toBe(createHash('sha256').update(s).digest('hex'));
  });
});

describe('prototype runs the real checks in the browser', () => {
  const body = (amount: string) => ({ branchId: 'BR-TOR', tellerId: 'T1', values: { requestType: 'EXCHANGE', sell: { amount, currency: 'CAD' }, buyCurrency: 'USD', paymentMethod: 'CASH', memberName: 'Test Member' } });
  it('uses the shipped rules', async () => {
    expect((await getConfig()).ruleSet.id).toBe('HO-FX-INTERIM');
  });
  it('quotes with the sample rate only (500.00 CAD / 1.4500 = 344.82 USD)', async () => {
    expect(await getQuote('500.00', 'CAD', 'USD')).toMatchObject({ available: true, quote: { give: { amount: '344.82', currency: 'USD' }, feedUpdatedAt: 'sample rate (prototype)' } });
  });
  it('prints PROTO record numbers', async () => {
    const rec = await checkRequest(body('500.00'));
    expect(rec.recordNo).toMatch(/^PROTO-\d{8}-[0-9A-Z]{6}$/);
    expect(['WITHIN_LIMITS', 'HEAD_OFFICE_REVIEW']).toContain(rec.result.kind); // depends on the real clock (business hours)
  });
  it('returns validation issues', async () => {
    await expect(checkRequest(body('0'))).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
