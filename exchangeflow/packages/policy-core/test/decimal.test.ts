import { describe, it, expect } from 'vitest';
import { mulDecimal, divDecimalFloor, floorToScale } from '../src';

describe('exact decimal arithmetic (no floats)', () => {
  it('mulDecimal is exact and keeps all digits', () => {
    expect(mulDecimal('100.00', '1.3900')).toBe('139.000000');
    expect(mulDecimal('0.1', '0.2')).toBe('0.02');
    expect(mulDecimal('3', '4')).toBe('12');
    expect(mulDecimal('0.001', '0.001')).toBe('0.000001');
    expect(mulDecimal('-1.5', '2')).toBe('-3.0');
    expect(mulDecimal('0', '5.50')).toBe('0.00');
  });
  it('mulDecimal and divDecimalFloor are exact for huge values', () => {
    expect(mulDecimal('99999999999999999999.99', '99999999999999999999.99')).toBe('9999999999999999999998000000000000000000.0001'); // independent Python Decimal
    expect(divDecimalFloor('99999999999999999999999999.99', '1', 2)).toBe('99999999999999999999999999.99');
  });
  it('divDecimalFloor floors, never rounds', () => {
    expect(divDecimalFloor('500.00', '1.4499', 2)).toBe('344.85');
    expect(divDecimalFloor('500.00', '1.4499', 6)).toBe('344.851369');
    expect(divDecimalFloor('2', '3', 2)).toBe('0.66');   // 0.666..., a round would give 0.67
    expect(divDecimalFloor('1', '3', 0)).toBe('0');
    expect(divDecimalFloor('10', '4', 0)).toBe('2');
    expect(divDecimalFloor('-2', '3', 2)).toBe('-0.67'); // floor is toward negative infinity
  });
  it('floorToScale floors, pads and handles negatives', () => {
    expect(floorToScale('139.000000', 2)).toBe('139.00');
    expect(floorToScale('1.999', 2)).toBe('1.99');
    expect(floorToScale('1.9', 3)).toBe('1.900');
    expect(floorToScale('7', 2)).toBe('7.00');
    expect(floorToScale('0.009', 2)).toBe('0.00');
    expect(floorToScale('-0.001', 2)).toBe('-0.01');
    expect(floorToScale('12.5', 0)).toBe('12');
  });
  it('rejects non-decimals, a zero divisor and a bad scale', () => {
    expect(() => mulDecimal('1e3', '2')).toThrow();
    expect(() => mulDecimal('', '2')).toThrow();
    expect(() => divDecimalFloor('1', '0.000', 2)).toThrow(/zero/);
    expect(() => divDecimalFloor('1', 'abc', 2)).toThrow();
    expect(() => divDecimalFloor('1', '2', -1)).toThrow();
    expect(() => floorToScale('NaN', 2)).toThrow();
    expect(() => floorToScale('1.5', 1.5)).toThrow();
  });
});
