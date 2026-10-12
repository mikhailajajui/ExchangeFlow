export type RequestStatus =
  | 'DRAFT' | 'UNDER_REVIEW' | 'MORE_INFO_NEEDED' | 'APPROVED' | 'AUTO_DECLINED'
  | 'DECLINED' | 'COMPLETED' | 'CANCELLED';
// EXPIRED exists in the design but is gated by BQ-3 (approval validity) and is not built yet.

export const TERMINAL: RequestStatus[] = ['DECLINED', 'COMPLETED', 'CANCELLED'];

export type Command =
  | 'SUBMIT' | 'ESCALATE' | 'REVIEW_APPROVE' | 'REVIEW_DECLINE' | 'REVIEW_REQUEST_INFO'
  | 'RESUBMIT' | 'COMPLETE' | 'CANCEL';

export type Role = 'STAFF' | 'REVIEWER' | 'POLICY_APPROVER' | 'COMPLIANCE' | 'MANAGER' | 'ADMIN';

export interface TransitionRow {
  from: RequestStatus;
  command: Command;
  /** 'BY_OUTCOME' means the engine outcome picks the target (submit). */
  to: RequestStatus | 'BY_OUTCOME';
  guard?: 'NOT_ESCALATED_BEFORE';
  allowedRoles: Role[];
  reasonRequired: boolean;
}

/** The transition table is data and is tested one row at a time (ADR-018). */
export const TRANSITIONS: TransitionRow[] = [
  { from: 'DRAFT', command: 'SUBMIT', to: 'BY_OUTCOME', allowedRoles: ['STAFF'], reasonRequired: false },
  { from: 'AUTO_DECLINED', command: 'ESCALATE', to: 'UNDER_REVIEW', guard: 'NOT_ESCALATED_BEFORE', allowedRoles: ['STAFF'], reasonRequired: true },
  { from: 'UNDER_REVIEW', command: 'REVIEW_APPROVE', to: 'APPROVED', allowedRoles: ['REVIEWER'], reasonRequired: false },
  { from: 'UNDER_REVIEW', command: 'REVIEW_DECLINE', to: 'DECLINED', allowedRoles: ['REVIEWER'], reasonRequired: true },
  { from: 'UNDER_REVIEW', command: 'REVIEW_REQUEST_INFO', to: 'MORE_INFO_NEEDED', allowedRoles: ['REVIEWER'], reasonRequired: true },
  { from: 'MORE_INFO_NEEDED', command: 'RESUBMIT', to: 'UNDER_REVIEW', allowedRoles: ['STAFF'], reasonRequired: false },
  { from: 'APPROVED', command: 'COMPLETE', to: 'COMPLETED', allowedRoles: ['STAFF'], reasonRequired: false },
  { from: 'DRAFT', command: 'CANCEL', to: 'CANCELLED', allowedRoles: ['STAFF'], reasonRequired: true },
  { from: 'UNDER_REVIEW', command: 'CANCEL', to: 'CANCELLED', allowedRoles: ['STAFF', 'REVIEWER'], reasonRequired: true },
  { from: 'MORE_INFO_NEEDED', command: 'CANCEL', to: 'CANCELLED', allowedRoles: ['STAFF', 'REVIEWER'], reasonRequired: true },
  { from: 'APPROVED', command: 'CANCEL', to: 'CANCELLED', allowedRoles: ['STAFF', 'REVIEWER'], reasonRequired: true },
];

export class DomainError extends Error {
  constructor(public code: 'INVALID_TRANSITION' | 'FORBIDDEN' | 'REASON_REQUIRED' | 'ALREADY_ESCALATED' | 'VALIDATION', message: string) { super(message); }
}

export interface TransitionInput {
  from: RequestStatus;
  command: Command;
  roles: Role[];
  reason?: string;
  engineOutcome?: 'AUTO_APPROVE' | 'AUTO_DECLINE' | 'HUMAN_REVIEW';
  escalatedBefore?: boolean;
}

export function transition(i: TransitionInput): RequestStatus {
  const row = TRANSITIONS.find(r => r.from === i.from && r.command === i.command);
  if (!row) throw new DomainError('INVALID_TRANSITION', `${i.command} is not allowed from ${i.from}`);
  if (!row.allowedRoles.some(r => i.roles.includes(r))) throw new DomainError('FORBIDDEN', `role not allowed to ${i.command}`);
  if (row.reasonRequired && !(i.reason && i.reason.trim().length >= 3)) throw new DomainError('REASON_REQUIRED', 'a reason is required');
  if (row.guard === 'NOT_ESCALATED_BEFORE' && i.escalatedBefore) throw new DomainError('ALREADY_ESCALATED', 'an auto-decline can be escalated only once');
  if (row.to !== 'BY_OUTCOME') return row.to;
  switch (i.engineOutcome) {
    case 'AUTO_APPROVE': return 'APPROVED';
    case 'AUTO_DECLINE': return 'AUTO_DECLINED';
    case 'HUMAN_REVIEW': return 'UNDER_REVIEW';
  }
  throw new DomainError('VALIDATION', 'submit needs an engine outcome');
}
