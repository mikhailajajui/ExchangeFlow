# exchangeflow: code guide for Claude

The local build of ExchangeFlow (a pnpm workspace). Product context, decisions and conventions are in the root `../CLAUDE.md`; read that first. This file is about the code. It is a **walking skeleton for local development, not production**: dev sign-in, synthetic data and placeholder rules.

## Run, test, verify

```bash
pnpm install
pnpm dev                      # database 54320 + API 3001 (EF_ENV=dev) + web 5173
pnpm test                     # vitest: engine tests + integration tests on a throwaway PostgreSQL
npx tsc --noEmit -p <path>    # typecheck one package: apps/web, apps/api, packages/*
pnpm --filter @ef/web build   # production build of the SPA
pnpm check:prod-bundle        # build, then fail if the bundle contains the dev sign-in
pnpm db:reset                 # delete .data (stop dev first)
```

Definition of done for any change: `pnpm test` passes, every touched package typechecks, the web build and `check:prod-bundle` pass, and (for UI) you looked at it in a real browser or say that you could not. The live-feed test is skipped by default; run it with `EF_LIVE_RATES=1 npx vitest run packages/adapter-rates/test/live.test.ts`.

## Layout and dependency rule

Dependencies point inward only: apps and adapters → `app-services` → `workflow-core` → `policy-core`. `ports` holds interfaces only.

| Package | Role | Rules |
|---|---|---|
| `packages/policy-core` | Pure `evaluate`, three-valued logic, precedence, guardrail, decimal arithmetic, canonical JSON and hashing, approved reason texts | No I/O, no clock, no randomness. Nothing imports upward |
| `packages/workflow-core` | Transition table (data), request schema (zod), context builder, `computeQuote`, completion schema | Pure given its inputs |
| `packages/ports` | Interfaces: `UnitOfWork`, repositories, `Clock`, `IdGenerator`, `Outbox`, `AuditChain`, `RateProvider` | Types only |
| `packages/app-services` | Use cases in `AppServices`; `AppError` with stable codes | Only place business rules live; one transaction per command |
| `packages/adapter-postgres` | Pool, migrations, `PgUnitOfWork`, repositories, audit append function, outbox relay, sessions, inbox, seed | Migrations are additive files `NNN_name.sql` |
| `packages/adapter-rates` | `RateProvider` for the uexchange.ca feed | Host allow-list, https only, 5 s timeout, size cap, zod parse, 60 s cache with stale-if-error |
| `apps/api` | NestJS: controllers, session and CSRF middleware, security headers, problem filter | Thin. Constructor injection uses explicit `@Inject(token)` because tsx does not emit decorator metadata |
| `apps/web` | React + Vite SPA: pages, `api.ts`, shared UI, tokens | Tokens from `src/tokens.css`; no inline `style=` |
| `apps/teller-lite` | Interim branch desk (ADR-029): `node:http` server + one-page React app; rules in `rules/branch-rules.json` compiled by `src/server/rules.ts` | Stateless; loopback only; validates with `RequestValuesSchema` before any rate fetch; see its `README.md` |

## Invariants the code must keep (tests exist for each)

- **One transaction:** decision record, request state, audit event, outbox and quote or completion rows commit together (INV-TX-1). Network I/O (the rate fetch) happens **before** the transaction opens, never while the control lock is held.
- **Lock first, then evaluate:** `submit` and `resubmit` take the control row `FOR SHARE` at the start, at READ COMMITTED; pause and resume take it `FOR UPDATE`. Lock order: control row, request row, audit head (INV-LOCK-ORDER, ADR-027). A pause therefore waits for in-flight submits and later submits see it (INV-PAUSE-1).
- **Idempotent submit:** `Idempotency-Key` header; same key and payload replays the stored response; different payload is 422 `IDEMPOTENCY_MISMATCH`.
- **Optimistic concurrency:** every command may carry `expectedVersion`; a mismatch is 409 `STALE_REQUEST`. Unique `(request_id, cycle)` on decisions and reviews is the backstop.
- **Determinism and replay:** a stored input re-evaluated gives the stored outcome and context hash (INV-DET-1). The engine never reads a clock, rates or the environment.
- **Missing data is UNKNOWN, never an automated outcome** (INV-3VL-1). The guardrail only downgrades to human review and applies to approve and decline alike.
- **Resubmission floor:** a resubmission is evaluated for the record but applied as human review (ADR-022).
- **Placeholder guard:** a `nonProduction` rule cannot decide in `prod` (commit-time check, start-up refusal, no seed in prod).
- **Audit:** insert-only, hash-chained through `audit_append()` with one head row; rows hold IDs, codes and hashes only.
- **Branch scope and SoD:** out-of-scope requests return 404; a reviewer cannot decide a request they submitted; policy approvers cannot open requests.
- **Rates never reach rules:** the evaluation context contains no rate, and a test proves the decision is identical when the rate provider changes or fails.

## Privacy and information-leak rules

- `memberName` exists only in `request_revision.values`. It must not appear in the evaluation context, decision snapshot, audit detail, outbox payloads, inbox text, logs, validation error bodies, quote or completion rows, URLs or page titles. A test scans every table.
- The API gives tellers **no routing cause**. Reviewers see only RESUBMISSION_FLOOR, ENGINE_PAUSED, ENGINE_ERROR or the neutral NEEDS_REVIEW (every other cause, including GUARDRAIL, collapses into it). Raw codes are never rendered. Contract tests assert that no response contains GUARDRAIL, COMPLIANCE, sanction, PEP, FINTRAC, screening or suspicion.
- Audit sequence numbers and hashes are returned only to COMPLIANCE and MANAGER; others get per-request entry numbers.
- Completion success text is neutral; the API never returns a mismatch flag to the teller. Differences between the quote and what was given are shown as plain figures ("Quoted at submit: 139.00 CAD. Differs from the quote.").
- The note field is checked server-side for card-like and SIN-like digit sequences.
- Fonts are self-hosted via `@fontsource`; the CSP is `default-src 'self'` with `font-src 'self'`; no third-party request at runtime.

## Domain facts

- **States:** DRAFT, UNDER_REVIEW, MORE_INFO_NEEDED, APPROVED, AUTO_DECLINED, DECLINED, COMPLETED, CANCELLED. EXPIRED exists in the design but is not built (gated by BQ-3).
- **Cycle:** one evaluation or escalation; increments on submit, resubmit and escalate. Escalating an auto-decline does not re-evaluate and works once.
- **Request values:** requestType (EXCHANGE or WIRE placeholders), sell `{amount, currency}` as decimal string, buyCurrency, paymentMethod, memberName (required), memberRef (optional pseudonymous), note (optional). The real field list is `[TBD-Stakeholder]`.
- **Seed policy (DEV ONLY):** PLACEHOLDER-001 auto-approve up to 1,000 CAD (and per-currency equivalents) on supported pairs; PLACEHOLDER-002 auto-decline unsupported pairs; PLACEHOLDER-003 human review over 10,000 CAD; PLACEHOLDER-004 shadow. Guardrail max auto-approve 1,500 CAD; WIRE prohibited. **These numbers are demo values, not business or regulatory thresholds.**
- **Quote:** `computeQuote` (workflow-core) with exact BigInt decimal arithmetic, floor to the minor unit, unrounded value kept to 6 decimals, `rounding: FLOOR_MINOR_UNIT`. Stored in `request_quote` at submit and resubmit. If the feed fails, submit still succeeds with no quote.
- **Completion:** the teller records handed-over amount, amount given, rate applied and reference; stored in `request_completion`, visible to every role that can open the request.
- **Dev users:** `u-teller-tor`, `u-teller-ott`, `u-reviewer`, `u-approver`, `u-manager-tor`, `u-compliance`.

## API summary (`/api`)

`GET /health` · `GET /dev/users`, `POST /session`, `GET /session/me`, `DELETE /session` (dev only) · `GET|POST /requests`, `GET|PUT /requests/:id`, `POST /requests/:id/{submit,resubmit,escalate,cancel,complete}` · `GET /review/queue`, `POST /review/:id/decision` · `GET /engine`, `POST /engine/{pause,resume}` · `GET /inbox`, `POST /inbox/read` · `GET /quote?sellAmount=&sellCurrency=&buyCurrency=` (rate-limited, 30 per minute per session).
Errors are RFC 9457 problem details with a stable `code`: UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, VALIDATION (with `issues`), STALE_REQUEST, INVALID_TRANSITION, SOD_VIOLATION, IDEMPOTENCY_MISMATCH, IDEMPOTENCY_KEY_REQUIRED, REASON_REQUIRED, ALREADY_ESCALATED, RATE_LIMITED, PLACEHOLDER_IN_PRODUCTION. Mutations need a session cookie, the `x-csrf-token` header equal to the CSRF cookie, and a same-origin request.

## Database tables

`branches`, `users`, `sessions`, `exchange_request`, `request_revision`, `policy_version`, `policy_control` (single row), `control_event`, `decision_record` (with a `restricted` column that general queries never select), `review_decision`, `idempotency`, `audit_head`, `audit_event` (trigger blocks update, delete and truncate), `outbox`, `inbox`, `request_quote`, `request_completion`, `schema_migrations`.

## Environment

`EF_ENV` is `dev`, `test` or `prod`; unset means **prod** (no dev sign-in, secure `__Host-` cookies); any other value refuses to start. `pnpm dev` sets `dev`. `DATABASE_URL` or `EF_DB_PORT` locate the database; `PORT` the API; `EF_RATE_URL` the feed (host must be `uexchange.ca`). The API serves `apps/web/dist` when it exists.

## UI rules

Follow `../docs/ui-design/ui-design.md` and `src/tokens.css` (a verbatim copy of `../docs/ui-design/tokens.css`). Concept: "the slip and the ledger": ledger rows for lists, slips for forms and receipts, status as shape plus word plus colour, amounts in right-aligned tabular mono, the stamp on the outcome docket as the one bold moment. Alterna palette: navy ink, warm-grey paper, orange as accent only (wordmark "Flow", active-nav underline), never as a status colour; orange text only where it passes 4.5:1 (`../docs/ui-design/contrast.py` must report 0 unexpected failures). Interface font Inter, figures IBM Plex Mono, stamp Barlow Condensed. Keyboard focus is visible (3px), dialogs trap focus and return it, Approve has a confirm step, auto-refresh (15 s) can be paused, motion respects `prefers-reduced-motion`. The teller action after an auto-decline is "Escalate".

## Pitfalls

- Saving a web file triggers hot reload and clears form state mid-test.
- Do not add tests that need the network; use the injected `fetch` for the rate adapter.
- Do not widen what a role can see without updating the role-matrix test and the privacy scan.
- If you add a column or table that could hold personal data, extend the privacy scan test.
- Change the engine only with a decision-table vector; change a state or transition only through the transition table and its row-by-row test.
- Do not edit `docs/`, `reviews/` or the root documents from a code task unless asked; record decisions in the decision log (`../reviews/ba-review.md` §4).
