import type { Control, Decision, PolicyVersion, Outcome } from '@ef/policy-core';
import type { RequestStatus, RequestValues, Role, Command, Quote, RateSnapshot } from '@ef/workflow-core';

export type Uuid = string;
export type InstantUtc = string;

export interface Clock { now(): InstantUtc }
export interface IdGenerator { uuid(): Uuid }

export interface Actor { id: string; displayName: string; roles: Role[]; branchId: string | null; kind: 'user' | 'system' }
export interface Branch { branchId: string; name: string; timezone: string }

export interface ExchangeRequest {
  id: Uuid; status: RequestStatus; version: number; cycle: number; submitterId: string; branchId: string;
  escalated: boolean; createdAt: InstantUtc; updatedAt: InstantUtc; currentRevision: number;
  /** Display name of the submitter, resolved by join on read; never supplied by a client. */
  submitterName?: string;
}
export interface RequestRevision { requestId: Uuid; revision: number; values: RequestValues; valuesHash: string; createdAt: InstantUtc }

export interface DecisionRecord {
  id: Uuid; requestId: Uuid; cycle: number; seq?: number; requestRevision: number;
  policyVersionId: string | null; policyHash: string | null; controlRevision: number;
  contextSnapshot: unknown; contextHash: string; asOf: InstantUtc; engineVersion: string;
  outcome: Outcome; appliedOutcome: Outcome; fallbackCause: string | null; decidingRuleKey: string | null;
  matchedRules: string[]; shadowResults: unknown; alerts: string[]; reasonCode: string; reasonText: string;
  /** Restricted part, never returned to general roles (ADR-026). */
  restricted: { compliance: Record<string, string>; restrictedDetail: string | null };
  createdAt: InstantUtc;
}
export interface ReviewDecision { id: Uuid; requestId: Uuid; cycle: number; decisionRecordId: Uuid | null; decisionType: 'APPROVE' | 'DECLINE' | 'REQUEST_INFO'; reviewerId: string; reason: string | null; at: InstantUtc }

export interface AuditEventInput { actorId: string; actorRoles: Role[]; action: string; targetType: string; targetId: string; correlationId: string; detail?: Record<string, unknown> }
export interface AuditEventView { seq: number; at: InstantUtc; actorId: string; actorName: string; action: string; hash: string; detail: Record<string, unknown> }

export interface OutboxMessage { type: string; payload: Record<string, unknown>; dedupeKey: string }

export interface RequestRepository {
  get(id: Uuid, forUpdate?: boolean): Promise<ExchangeRequest | null>;
  insert(req: ExchangeRequest, rev: RequestRevision): Promise<void>;
  /** Optimistic: WHERE id AND version = expected. Throws StaleRequestError on zero rows (INV-CONC-1). */
  update(req: ExchangeRequest, expectedVersion: number): Promise<ExchangeRequest>;
  addRevision(rev: RequestRevision): Promise<void>;
  getRevision(requestId: Uuid, revision: number): Promise<RequestRevision | null>;
  list(filter: { branchId?: string; statuses?: RequestStatus[]; submitterId?: string }): Promise<(ExchangeRequest & { values: RequestValues })[]>;
}
export interface ControlRepository {
  /** SELECT ... FOR SHARE at the start of the unit of work (INV-CTRL-1, ADR-027). */
  lockShared(): Promise<Control & { currentPolicyVersionId: string | null }>;
  /** SELECT ... FOR UPDATE; pause and resume only. */
  lockExclusive(): Promise<Control & { currentPolicyVersionId: string | null }>;
  write(next: Control, actorId: string, action: string, reason: string): Promise<void>;
  read(): Promise<Control & { currentPolicyVersionId: string | null }>;
}
export interface PolicyRepository {
  getById(id: string): Promise<PolicyVersion | null>;
}
export interface DecisionRepository {
  insert(rec: DecisionRecord): Promise<void>;
  insertReview(rec: ReviewDecision): Promise<void>;
  forRequest(requestId: Uuid): Promise<DecisionRecord[]>;
  reviewsFor(requestId: Uuid): Promise<ReviewDecision[]>;
}
export interface IdempotencyRepository {
  begin(submitterId: string, key: string, payloadHash: string): Promise<{ kind: 'new' } | { kind: 'replay'; response: unknown } | { kind: 'mismatch' }>;
  complete(submitterId: string, key: string, response: unknown): Promise<void>;
}
export interface UserDirectory {
  get(id: string): Promise<Actor | null>;
  branch(id: string): Promise<Branch | null>;
}
export interface QuoteRepository {
  /** One quote per request revision, written in the same transaction as the decision (INV-TX-1). */
  put(requestId: Uuid, revision: number, quote: Quote): Promise<void>;
  get(requestId: Uuid, revision: number): Promise<{ quote: Quote; createdAt: InstantUtc } | null>;
  /** The quotes for the current revision of each request, keyed by request id. For list views. */
  forRequests(items: { requestId: Uuid; revision: number }[]): Promise<Map<Uuid, Quote>>;
}
export interface Money { amount: string; currency: string }
/** What the teller actually did at completion. No member name. */
export interface CompletionRecord {
  requestId: Uuid; revision: number; handedOver: Money; given: Money; rateApplied: string; rateSide: string; reference: string;
  quotedGive: Money | null; completedBy: string; completedAt: InstantUtc;
  /** Display name of completedBy, resolved by join on read. */
  completedByName?: string;
}
export interface CompletionRepository {
  /** One completion per request, written in the same transaction as the COMPLETE transition (INV-TX-1). */
  put(rec: CompletionRecord): Promise<void>;
  get(requestId: Uuid): Promise<CompletionRecord | null>;
  forRequests(requestIds: Uuid[]): Promise<Map<Uuid, CompletionRecord>>;
}
/** Indicative rates for display only. Never an input to the decision engine (FR-70). Returns null when no usable rate exists. */
export interface RateProvider { get(currency: string): Promise<RateSnapshot | null> }
export interface Outbox { enqueue(msg: OutboxMessage): Promise<void> }
export interface AuditChain {
  append(e: AuditEventInput): Promise<{ seq: number; hash: string }>;
  forTarget(targetId: string): Promise<AuditEventView[]>;
}

export interface Tx {
  readonly requests: RequestRepository; readonly control: ControlRepository; readonly policy: PolicyRepository;
  readonly decisions: DecisionRepository; readonly idempotency: IdempotencyRepository; readonly users: UserDirectory;
  readonly outbox: Outbox; readonly audit: AuditChain; readonly quotes: QuoteRepository; readonly completions: CompletionRepository;
}
export interface UnitOfWork {
  /** The only way to touch repositories: one database transaction (INV-TX-1). */
  run<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

export class StaleRequestError extends Error { constructor(public current: ExchangeRequest | null) { super('stale'); } }
export type { Command, Quote, RateSnapshot };
