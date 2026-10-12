# ADR-003: Rule expression format

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review D1; security-review SEC-05, SEC-29 (in `reviews/`)

## Context

Rules must be pure, decimal-safe, order-independent and bounded in cost. json-rules-engine allows async facts and uses floats; DMN brings a JVM and skills cost.

## Decision

- In-house typed JSON AST (`rule-schema/v1`) with a pure evaluator.
- Operators: all, any, not, exists, eq, neq, lt, lte, gt, gte, in, between.
- Rule-level `appliesTo` scope; schema forbids identity fields, regex and coercion.

## Consequences

- About 300–500 lines to own and property-test.
- The AST can later be rendered as a decision table if the business wants DMN-style authoring.
