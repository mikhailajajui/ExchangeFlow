import type { DeskConfig, DeskRecord, Problem, QuoteView } from '../shared';

export class DeskError extends Error {
  constructor(public status: number, public problem: Problem) { super(problem.code); }
}

/** True only in the GitHub Pages prototype build (vite --mode prototype); the check then runs in the browser. */
export const PROTOTYPE = import.meta.env.MODE === 'prototype';
// "@desk-local" is the in-browser backend in the prototype build and a stub otherwise (vite.config.ts).
const local = PROTOTYPE ? import('@desk-local') : null;

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try { res = await fetch(path, { credentials: 'same-origin', ...init }); } catch { throw new DeskError(0, { code: 'NETWORK', title: 'network' }); }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new DeskError(res.status, { code: body.code ?? 'UNKNOWN', title: body.title ?? '', issues: body.issues });
  return body as T;
}

async function viaLocal<T>(run: (m: typeof import('../prototype/local')) => Promise<T>): Promise<T> {
  const m = await local!;
  try { return await run(m); } catch (e) {
    const le = e as { status?: number; code?: string; issues?: Problem['issues'] };
    if (le && le.code === 'VALIDATION') throw new DeskError(422, { code: 'VALIDATION', title: '', issues: le.issues });
    throw new DeskError(500, { code: 'UNKNOWN', title: '' });
  }
}

type QuoteResult = { available: true; quote: QuoteView } | { available: false; reason: string };

export const getConfig = (): Promise<DeskConfig> => PROTOTYPE ? viaLocal(m => m.getConfig()) : call<DeskConfig>('/api/config');
export const getQuote = (sellAmount: string, sellCurrency: string, buyCurrency: string): Promise<QuoteResult> => PROTOTYPE
  ? viaLocal(m => m.getQuote(sellAmount, sellCurrency, buyCurrency))
  : call<QuoteResult>(`/api/quote?${new URLSearchParams({ sellAmount, sellCurrency, buyCurrency })}`);
export const checkRequest = (body: unknown): Promise<DeskRecord> => PROTOTYPE
  ? viaLocal(m => m.checkRequest(body))
  : call<DeskRecord>('/api/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
