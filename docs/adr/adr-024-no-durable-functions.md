# ADR-024: No Durable Functions; PostgreSQL is the only request-state store

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** `docs/core-engine-plan.md` §6.3; `reviews/core-engine-architect.md` CE-ARCH-09

## Context

Option 3 in the Azure proposal used Durable Functions for "wait for reviewer or time out". PostgreSQL already holds request state, deadlines and the outbox.

## Decision

- Expiry and escalation-window lapse are indexed sweeps over deadline columns, run by a timer or job under a row lease and through workflow commands.
- A reviewer decision is an ordinary command; there is no orchestrator to notify.
- Durable Functions is not used. No second state store (task hub) exists.

## Consequences

- No orchestration payloads outside PostgreSQL (smaller PII surface); no replay-determinism constraints on orchestrator code; less lock-in.
- Sweep granularity (about 1 minute) must be finer than the business windows. This assumes windows of an hour or more; confirm with BQ-3 and BQ-5.
- Narrows `azure-architecture-proposal.md` §6.
