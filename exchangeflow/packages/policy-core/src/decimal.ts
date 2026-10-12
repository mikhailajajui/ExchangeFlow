/** Exact decimal comparison on strings; no floating point (ADR-008). */
const RE = /^-?\d+(\.\d+)?$/;

export function isDecimal(s: unknown): s is string {
  return typeof s === 'string' && RE.test(s);
}

function parts(s: string): { neg: boolean; int: string; frac: string } {
  const neg = s.startsWith('-');
  const [i, f = ''] = (neg ? s.slice(1) : s).split('.');
  return { neg, int: i!.replace(/^0+(?=\d)/, ''), frac: f };
}

/** Returns -1, 0 or 1. Throws on malformed input so callers can map it to UNKNOWN. */
export function compareDecimal(a: string, b: string): -1 | 0 | 1 {
  if (!isDecimal(a) || !isDecimal(b)) throw new Error('not a decimal');
  const x = parts(a), y = parts(b);
  const scale = Math.max(x.frac.length, y.frac.length);
  const big = (p: typeof x) => {
    const v = BigInt(p.int + p.frac.padEnd(scale, '0'));
    return p.neg ? -v : v;
  };
  const bx = big(x), by = big(y);
  return bx < by ? -1 : bx > by ? 1 : 0;
}

/** Number of digits after the decimal point. */
export function scaleOf(s: string): number {
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

/** Splits a decimal string into a scaled BigInt: value = n / 10^scale. */
function scaled(s: string): { n: bigint; scale: number } {
  if (!isDecimal(s)) throw new Error('not a decimal');
  const scale = scaleOf(s);
  return { n: BigInt(s.replace('.', '')), scale };
}

function format(n: bigint, scale: number): string {
  const neg = n < 0n;
  const digits = (neg ? -n : n).toString().padStart(scale + 1, '0');
  const body = scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  return neg && n !== 0n ? `-${body}` : body;
}

/** BigInt division rounding toward negative infinity. */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return (a % b !== 0n) && ((a < 0n) !== (b < 0n)) ? q - 1n : q;
}

/** Exact product; the result has scale(a) + scale(b) digits. */
export function mulDecimal(a: string, b: string): string {
  const x = scaled(a), y = scaled(b);
  return format(x.n * y.n, x.scale + y.scale);
}

/** floor(a / b) at exactly `scale` decimal places. Throws on a zero divisor. */
export function divDecimalFloor(a: string, b: string, scale: number): string {
  if (!Number.isInteger(scale) || scale < 0) throw new Error('invalid scale');
  const x = scaled(a), y = scaled(b);
  if (y.n === 0n) throw new Error('division by zero');
  return format(floorDiv(x.n * 10n ** BigInt(y.scale + scale), y.n * 10n ** BigInt(x.scale)), scale);
}

/** Rounds toward negative infinity to exactly `scale` decimal places (pads with zeros when the input is shorter). */
export function floorToScale(s: string, scale: number): string {
  if (!Number.isInteger(scale) || scale < 0) throw new Error('invalid scale');
  const x = scaled(s);
  if (x.scale <= scale) return format(x.n * 10n ** BigInt(scale - x.scale), scale);
  return format(floorDiv(x.n, 10n ** BigInt(x.scale - scale)), scale);
}
