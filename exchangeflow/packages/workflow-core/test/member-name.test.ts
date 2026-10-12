import { describe, it, expect } from 'vitest';
import { RequestValuesSchema } from '../src';

const base = { requestType: 'EXCHANGE', sell: { amount: '10.00', currency: 'CAD' }, buyCurrency: 'USD', paymentMethod: 'CASH' };
const parse = (memberName: unknown) => RequestValuesSchema.safeParse({ ...base, memberName });

describe('memberName', () => {
  it('accepts letters of any script, marks, apostrophe, period, hyphen and spaces', () => {
    for (const n of ["Marie-Ève O'Brien", 'J. R. Smith', 'Zoë Müller', 'Иван Петров', '李小龍', 'Nguyễn Văn An', 'D’Arcy', 'Jo']) expect(parse(n).success, n).toBe(true);
  });
  it('is trimmed and single-spaced', () => {
    const r = parse('  Ada   Lovelace \t ');
    expect(r.success && r.data.memberName).toBe('Ada Lovelace');
  });
  it('is required', () => {
    expect(RequestValuesSchema.safeParse(base).success).toBe(false);
    expect(parse(undefined).success).toBe(false);
  });
  it('boundaries: 2 characters pass, 1 and 81 fail, 80 passes', () => {
    expect(parse('Al').success).toBe(true);
    expect(parse('A').success).toBe(false);
    expect(parse(' A ').success).toBe(false);
    expect(parse('a'.repeat(80)).success).toBe(true);
    expect(parse('a'.repeat(81)).success).toBe(false);
  });
  it('rejects digits (card and SIN numbers), symbols, markup and names with no letter', () => {
    for (const n of ['Ada 4111111111111111', 'Ada Lovelace 1', '123 456 789', 'Ada_Lovelace', 'Ada@x.ca', '<b>Ada</b>', '..', "- '", 'Ada/Lovelace', 'Ada\u0000']) expect(parse(n).success, n).toBe(false);
  });
  it('rejects non-strings', () => {
    for (const n of [null, 5, {}, ['Ada']]) expect(parse(n).success).toBe(false);
  });
  it('validation issues never echo the value', () => {
    const secret = 'Zzyzx 4111111111111111';
    const r = parse(secret);
    expect(r.success).toBe(false);
    if (!r.success) {
      const text = JSON.stringify(r.error.issues.map(i => ({ path: i.path, message: i.message })));
      expect(text).not.toContain('Zzyzx'); expect(text).not.toContain('4111');
    }
  });
});
