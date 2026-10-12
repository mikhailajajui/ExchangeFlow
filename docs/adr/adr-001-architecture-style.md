# ADR-001: Architecture style

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review §2, §5 (in `reviews/`)

## Context

A small team (2–4) must deliver a workflow product with strong transactional guarantees. Microservices would add operational load without a demonstrated need.

## Decision

- TypeScript modular monolith, one deployable image.
- Module boundaries (requests, workflow, policy engine, policy admin, identity, audit, notifications) enforced with dependency-cruiser.
- The policy engine is a dependency-free package behind a port.

## Consequences

- One transaction can cover decision, state, audit and outbox.
- Modules can be split later behind their ports if scale demands it.
