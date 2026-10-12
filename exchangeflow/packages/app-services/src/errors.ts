export type ErrorCode =
  | 'NOT_FOUND' | 'FORBIDDEN' | 'STALE_REQUEST' | 'INVALID_TRANSITION' | 'SOD_VIOLATION' | 'IDEMPOTENCY_MISMATCH'
  | 'VALIDATION' | 'REASON_REQUIRED' | 'ALREADY_ESCALATED' | 'UNAUTHENTICATED' | 'PLACEHOLDER_IN_PRODUCTION' | 'IDEMPOTENCY_KEY_REQUIRED' | 'RATE_LIMITED';

const STATUS: Record<ErrorCode, number> = {
  NOT_FOUND: 404, FORBIDDEN: 403, STALE_REQUEST: 409, INVALID_TRANSITION: 409, SOD_VIOLATION: 403, IDEMPOTENCY_MISMATCH: 422,
  VALIDATION: 422, REASON_REQUIRED: 422, ALREADY_ESCALATED: 409, UNAUTHENTICATED: 401, PLACEHOLDER_IN_PRODUCTION: 500, IDEMPOTENCY_KEY_REQUIRED: 400, RATE_LIMITED: 429,
};

/** Stable error codes, rendered as RFC 9457 problem details by the HTTP layer. */
export class AppError extends Error {
  status: number;
  constructor(public code: ErrorCode, message: string, public extra: Record<string, unknown> = {}) {
    super(message); this.status = STATUS[code];
  }
}
