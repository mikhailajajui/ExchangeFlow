# ADR-020: Frontend stack

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review §2 (in `reviews/`)

## Context

An authenticated desktop tool needs no SSR or SEO.

## Decision

- React + Vite SPA served by the backend; TanStack Query; shared Zod contracts; accessible component kit.
- axe accessibility checks in E2E.

## Consequences

- One origin keeps cookies, CSRF and CSP simple.
