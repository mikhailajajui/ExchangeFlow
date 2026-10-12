# ADR-006: Determinism and decision snapshot

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-01 (in `reviews/`)

## Context

Decisions must be reproducible (FR-14, NFR-09), but pause state, time and derived facts also change outcomes.

## Decision

- `evaluate(input)` is pure over {context, policy, control, asOf, engineVersion}.
- The full input and its hashes are stored on every decision record.
- Replay runs in CI over a fixture corpus and nightly in production on a sample.

## Consequences

- The context snapshot is personal data and follows request retention.
- Engine-semantics changes bump `engineVersion`; cross-version replays are reported, not compared.
