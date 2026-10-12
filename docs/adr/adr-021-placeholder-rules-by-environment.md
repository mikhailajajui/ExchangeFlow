# ADR-021: Placeholder rules by environment

- **Status:** Accepted
- **Date:** 2026-10-01
- **Sources:** architecture-review F-15; qa-review H4; ba-review IC-01; security-review SEC-23 (in `reviews/`)

## Context

The REL-1 demo must show all three paths before real criteria exist, but placeholders must never automate in production. Decided by the product owner on 2026-10-01.

## Decision

- Rules flagged `nonProduction` may be active automated rules only where env ≠ prod and data is synthetic.
- In production: publish rejects them; the app refuses to start with a non-production flag; images contain no seed files; a self-check raises Sev-1 on any such decision.

## Consequences

- FR-17 updated; REL-1 demo shows auto-approve, auto-decline and escalation in test.
