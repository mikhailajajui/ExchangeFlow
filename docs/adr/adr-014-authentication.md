# ADR-014: Authentication

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review §2; azure-architecture-validation AV-05 (in `reviews/`)

## Context

Tokens in the browser are exposed to XSS, and token-held roles go stale.

## Decision

- OIDC authorization code + PKCE against Microsoft Entra ID, with the api as a confidential client (BFF).
- Server-side session in PostgreSQL; `__Host-` HttpOnly, Secure, SameSite=Lax cookie; CSRF token on mutations.
- MFA by Conditional Access; step-up for privileged actions.

## Consequences

- SPA and API share one origin (ADR-020, ADR-AZ-3).
