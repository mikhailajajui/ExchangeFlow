# ADR-008: Money representation

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-09 (in `reviews/`)

## Context

String and float comparisons of amounts give wrong answers (checked in Node 22).

## Decision

- Decimal strings on the wire, `numeric(20,6)` in the database, decimal.js in code; never floats.
- Every amount carries an ISO 4217 currency; scale validated against minor units.
- Thresholds are per-currency maps until a rate source exists (BQ-2).

## Consequences

- Cross-currency comparisons without a map evaluate to UNKNOWN.
