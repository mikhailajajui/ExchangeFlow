export interface Issue { path: string; message: string }
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public issues: Issue[] = [], public extra: Record<string, unknown> = {}) { super(message); }
}

// The production cookie carries the __Host- prefix; the local one does not.
const csrf = () => document.cookie.split('; ').find(c => c.startsWith('ef_csrf=') || c.startsWith('__Host-ef_csrf='))?.split('=')[1] ?? '';

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {}): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
  let res: Response;
  try {
    res = await fetch('/api' + path, {
      method, credentials: 'same-origin',
      headers: { ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' ? { 'x-csrf-token': csrf() } : {}), ...opts.headers },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: opts.signal,
    });
  } catch { throw new ApiError(0, 'NETWORK', 'Network error'); }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let data: { code?: string; detail?: string; title?: string; issues?: Issue[] } | undefined;
  try { data = text ? JSON.parse(text) : undefined; } catch { data = undefined; }
  if (!res.ok) throw new ApiError(res.status, data?.code ?? 'ERROR', data?.detail ?? data?.title ?? 'Request failed', data?.issues ?? [], data ?? {});
  return data as T;
}

// ---------- types mirrored from the API ----------
export type Status = 'DRAFT' | 'UNDER_REVIEW' | 'MORE_INFO_NEEDED' | 'APPROVED' | 'AUTO_DECLINED' | 'DECLINED' | 'COMPLETED' | 'CANCELLED';
export interface Values { requestType: string; sell: { amount: string; currency: string }; buyCurrency: string; paymentMethod: string; memberName: string; memberRef?: string; note?: string }
export interface RateSnapshot { currency: string; feedId: string; buy: string; sell: string; feedUpdatedAt: string; fetchedAt: string; stale: boolean }
export interface Quote {
  give: { amount: string; currency: string }; giveUnrounded: string; rounding: 'FLOOR_MINOR_UNIT'; side: 'SELL_RATE' | 'BUY_RATE'; rate: string;
  sell: { amount: string; currency: string }; snapshot: RateSnapshot;
}
export type QuoteReply = { unavailable: false; quote: Quote } | { unavailable: true; reason: string }
export interface Actor { id: string; displayName: string; roles: string[]; branchId: string | null }
export interface RequestView {
  id: string; shortId: string; status: Status; version: number; cycle: number; branchId: string; submitterId: string; submittedBy: string; values: Values;
  createdAt: string; updatedAt: string; escalated: boolean; allowedActions: string[];
  latest: { appliedOutcome: string; reasonText: string; cause?: string } | null;
  /** What the member gets: the completed figure, else the stored quote, else null. */
  give: Give | null;
}
export interface Give { amount: string; currency: string; rate: string; source: 'COMPLETED' | 'QUOTED' }
export interface Completion {
  handedOver: { amount: string; currency: string }; given: { amount: string; currency: string }; rateApplied: string; rateSide: string; reference: string;
  completedBy: string; completedAt: string; quotedGive: { amount: string; currency: string } | null; differsFromQuote: boolean;
}
export interface Detail {
  request: RequestView;
  /** The quote stored for the current revision, or null. */
  quote: Quote | null;
  /** Present once the request is completed; the same for every role that can open the request. */
  completion: Completion | null;
  decisions: { cycle: number; asOf: string; appliedOutcome: string; reasonText: string; cause?: string; shadow?: { ruleKey: string; wouldBe: string }[]; alerts?: string[] }[];
  reviews: { cycle: number; decisionType: string; reason: string | null; at: string }[];
  /** `seq` and `hash` are present only for COMPLIANCE and MANAGER. */
  history: { n: number; at: string; actor: string; action: string; seq?: number; hash?: string }[];
}
