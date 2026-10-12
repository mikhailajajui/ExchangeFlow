import { createHash } from 'node:crypto';

/** Canonical JSON: sorted keys, no whitespace. Used for hashes and replay equality (ADR-006). */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  const o = v as Record<string, unknown>;
  return '{' + Object.keys(o).filter(k => o[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalJson(o[k])).join(',') + '}';
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export const hashOf = (v: unknown): string => sha256(canonicalJson(v));
