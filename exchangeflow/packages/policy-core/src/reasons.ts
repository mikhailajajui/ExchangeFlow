/**
 * Closed set of approved, generic reason texts (SEC-16, ADR-026). No customer fields, no limits,
 * and nothing about suspicion, sanctions, PEP status or the regulator.
 */
export const REASONS: Record<string, string> = {
  WITHIN_APPROVED_LIMIT: 'Approved automatically under current policy.',
  CURRENCY_NOT_SUPPORTED: 'This request cannot be processed automatically.',
  REQUIRES_HEAD_OFFICE_REVIEW: 'This request needs head-office review.',
  ENGINE_PAUSED: 'This request needs head-office review.',
  ENGINE_ERROR: 'This request needs head-office review.',
  GUARDRAIL: 'This request needs head-office review.',
  RULE_PAUSED: 'This request needs head-office review.',
  MISSING_DATA: 'This request needs head-office review.',
  CONFLICT: 'This request needs head-office review.',
  NO_MATCH: 'This request needs head-office review.',
  RESUBMISSION_FLOOR: 'This resubmitted request needs head-office review.',
};
export const reasonText = (code: string): string =>
  REASONS[code] ?? 'This request needs head-office review.';
