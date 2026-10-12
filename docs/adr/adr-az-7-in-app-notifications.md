# ADR-AZ-7: In-app notifications

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** azure-architecture-validation AV-15; azure-security-validation F-WS-01 (in `reviews/`)

## Context

FR-50/51 are Should requirements; Web PubSub adds a public endpoint and group-authorization risk.

## Decision

- Polling the in-app inbox in REL-1 to REL-3.
- Web PubSub only on measured need, with server-assigned groups, Entra auth and hint-only payloads.

## Consequences

- No WebSocket infrastructure to secure for now.
