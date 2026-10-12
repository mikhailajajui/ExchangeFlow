# ADR-022: Resubmission is always human-reviewed

- **Status:** Accepted
- **Date:** 2026-10-01
- **Sources:** architecture-review F-08; qa-review H5; ba-review IC-02 (in `reviews/`)

## Context

Re-evaluating a resubmitted request could auto-decide a case a reviewer was handling. Decided by the product owner on 2026-10-01 (BQ-1).

## Decision

- A resubmission creates a new revision and cycle and is re-evaluated for the record.
- The applied outcome is always HUMAN_REVIEW (RESUBMISSION_FLOOR), back to the same queue and, where possible, the same reviewer.

## Consequences

- Escalation does not re-evaluate; it shows the original decision.
