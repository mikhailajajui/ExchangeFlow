# ADR-009: Time handling

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-12 (in `reviews/`)

## Context

Date-only and zone-less timestamps parse differently; branches may be in different zones.

## Decision

- All instants are UTC `timestamptz`; each branch has an IANA zone.
- Effective dating is a half-open [from, to) interval of instants.
- The workflow injects a clock; derived time facts are frozen into the context.

## Consequences

- The engine never reads the clock.
