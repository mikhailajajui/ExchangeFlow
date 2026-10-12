# ADR-017: Evaluation time budget

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review D6 (in `reviews/`)

## Context

A wall-clock timeout cannot interrupt synchronous work in Node.

## Decision

- Static complexity limits enforced at publish (rules ≤ 500, depth ≤ 8, nodes per rule ≤ 200, `in` ≤ 1,000).
- Cooperative deadline between rules: 50 ms soft, 200 ms hard (ENGINE_ERROR / TIMEOUT).

## Consequences

- Values to confirm by load test.
- At least 1 vCPU per api replica.
