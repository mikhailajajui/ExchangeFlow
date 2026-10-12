# ADR-023: Hosting-agnostic core with ports and thin host adapters

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** `docs/core-engine-plan.md` v0.2; `reviews/core-engine-architect.md`, `core-engine-qa.md`, `core-engine-manager.md`; ADR-001, ADR-019, ADR-AZ-1

## Context

The Azure proposal compares VMs, Container Apps and Functions. The product owner (2026-10-01) wants one core that runs unchanged on all three, with the full multi-host layout built for REL-1.

## Decision

- Monorepo with `policy-core`, `workflow-core`, `ports`, `app-services`, `adapter-postgres`, `adapter-azure`, `adapter-http`, `conformance` and one host package per option (`vm`, `aca`, `functions`).
- Dependencies point inward; a host adds only protocol translation, process lifecycle, scheduling triggers and platform telemetry. No business logic in a host.
- PostgreSQL is the only store of request state, queue and outbox. No port exposes a session-level PostgreSQL feature, so every host is valid behind PgBouncer in transaction mode.
- A conformance suite runs the same scenarios and decision-table vectors against the shipped artifact of every host.
- Test-only hooks (clock, failpoints, job triggers) are compiled out of production artifacts and unreachable over HTTP.
- ADR-001 (modular monolith) and ADR-019 (hosting) stand; Container Apps remains the recommended host (ADR-AZ-1).

## Consequences

- Option 1 and Option 3 are feasible without core changes, at the cost of building and testing three host adapters.
- The delivery review estimates this adds roughly 9 to 15 person-weeks and widens REL-1; the product owner accepted the full layout knowingly. Revisit if REL-1 slips.
- Acceptance criteria for this ADR: conformance suite green on the Container Apps host; one other host passes the HTTP-path subset.
