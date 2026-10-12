/** Types shared by the server and the page. No runtime imports, so the browser bundle stays free of Node code. */
export type ResultKind = 'WITHIN_LIMITS' | 'HEAD_OFFICE_REVIEW' | 'NOT_AT_BRANCH';

export interface DeskConfig {
  ruleSet: { id: string; version: string; status: 'TRIAL' | 'APPROVED'; approvedBy: string; approvedOn: string };
  confirmationEmail: string;
  branches: { id: string; name: string }[];
  currencies: string[];
  paymentMethods: string[];
}

export interface QuoteView {
  give: { amount: string; currency: string };
  rate: string;
  side: 'SELL_RATE' | 'BUY_RATE';
  feedUpdatedAt: string;
  fetchedAt: string;
  stale: boolean;
}

export interface DeskRecord {
  recordNo: string;
  createdAt: string;
  branchLocalTime: string;
  branch: { id: string; name: string; timezone: string };
  tellerId: string;
  member: { name: string; ref?: string };
  request: { sell: { amount: string; currency: string }; buyCurrency: string; paymentMethod: string; note?: string };
  quote: QuoteView | null;
  /** reasonText is empty for WITHIN_LIMITS (no "Approved…" wording on a desk record). */
  result: { kind: ResultKind; label: string; reasonText: string; nextStep: string };
  ruleSet: { id: string; version: string; status: 'TRIAL' | 'APPROVED'; approvedBy: string; approvedOn: string; policyHash: string };
  engine: { version: string; contextHash: string };
  confirmationEmail: string;
}

export interface Problem { code: string; title: string; issues?: { path: string; message: string }[] }
