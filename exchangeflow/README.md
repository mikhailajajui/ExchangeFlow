# ExchangeFlow: local walking skeleton

A runnable local build of the design in `../policy-engine-design.md`, `../PRD.md` and `../docs/core-engine-plan.md`. No cloud, no Docker.

**Not production.** Dev sign-in, synthetic data and placeholder rules (`nonProduction`, ADR-021). Every number in the seed is a demo value, not a business or regulatory threshold.

## Run it

```bash
cd exchangeflow
pnpm install
pnpm dev          # PostgreSQL 16 (embedded) + API on :3001 + web on :5173
```

Open http://localhost:5173 and pick a dev user:

| User | Use it to |
|---|---|
| Teller (Toronto / Ottawa) | create, submit, escalate, resubmit, cancel and complete requests (own branch only) |
| Head-office reviewer | decide the review queue (approve, decline, ask for information) |
| Policy approver / Manager / Compliance | open **Decision engine**, pause or resume the engine or one rule |

Try the one-click scenarios on **New request**: small exchange (auto-approve), unsupported pair (auto-decline), large amount (human review), wire (human review).

`pnpm dev` sets `EF_ENV=dev`. An unset `EF_ENV` means production (no dev sign-in, secure cookies, `__Host-` names), and any value other than `dev`, `test` or `prod` refuses to start.

Other commands: `pnpm test` (engine tests and integration tests against a real throwaway PostgreSQL), `pnpm db:reset` (delete local data; stop `pnpm dev` first).

Ports: database 54320 (`EF_DB_PORT`), API 3001 (`PORT`), web 5173. The database is real PostgreSQL 16 binaries from npm, data in `.data/pg`.

## What is built

| Layer | Package | Notes |
|---|---|---|
| Decision engine | `packages/policy-core` | Pure `evaluate`: three-valued logic, rule scope, precedence table, shadow isolation, pause, guardrail over **all** automated outcomes with tri-state compliance facts (ADR-025), deterministic step budget, canonical hashing |
| Workflow domain | `packages/workflow-core` | Transition table as data, request validation (decimal strings, minor units), server-side context builder |
| Ports | `packages/ports` | Unit of work, repositories, outbox, audit |
| Use cases | `packages/app-services` | Lock-first evaluation (control row `FOR SHARE`, ADR-027), one transaction for decision, state, audit and outbox, idempotent submit, resubmission floor (ADR-022), per-object separation of duties, branch scope (404 out of scope), pause and resume |
| Database | `packages/adapter-postgres` | Schema, hash-chained insert-only audit with a head row, outbox relay (`SKIP LOCKED`) into an in-app inbox, sessions, seed |
| API | `apps/api` | NestJS, server-side session cookie, CSRF double-submit, RFC 9457 problems with stable codes |
| Rates | `packages/adapter-rates` | `RateProvider` adapter for the uexchange.ca feed: allow-listed host, strict parsing, cache and stale-if-error. Display only |
| UI | `apps/web` | Teller: list, new/edit/resubmit form, request detail with history, escalate, cancel, complete. Reviewer queue and decision. Engine panel. Notification bell |

## Not built yet (on purpose)

- Restricted compliance channel (ADR-026): referral, restricted store, compliance role screens. The schema keeps a `restricted` column and the guardrail already reads compliance facts, but no source feeds them locally.
- Entra ID sign-in (dev picker instead), policy administration and shadow reports, velocity limits, expiry and escalation-window sweeps (gated by BQ-3/4/5), Functions and VM hosts, Azure.
- French reason text, real field list (`[TBD-Stakeholder]`, DL-N11, DL-N16), real rules and thresholds.

## Honest limits

- The audit hash is computed in PostgreSQL; there is no external anchor yet.
- The local relay is a timer in the API process, not a separate worker.
- Test coverage: engine decision table, idempotency (including concurrent duplicates), escalation once, resubmission floor, stale version, branch scope, pause waiting on the control lock, audit immutability, replay equality, production refusal of placeholder decisions. No browser tests yet.

## Rate feed and "give the member" quote

The teller sees what to hand the member, from the public uexchange.ca feed (`GET https://uexchange.ca/get-currency-rate`, entry `id` 20 is USD; the feed ignores the `id` query parameter, so the adapter picks the entry from the list). The feed is a third party's data and its terms of use are unconfirmed (Q10), so the figure is **indicative**, never Alterna's own rate.

- Member sells CAD, buys USD: gives `CAD amount / sell_value`. Member sells USD, buys CAD: gives `USD amount x buy_value`. Any other pair has no quote (`UNSUPPORTED_PAIR`). Only USD is configured, in the `RATE_FEED_IDS` map.
- Exact decimal arithmetic (BigInt, no floats), result rounded **down** to the cent. The unrounded value (6 decimals) and `FLOOR_MINOR_UNIT` are stored with it. The feed's `round_up` field is not used.
- Server side only. HTTPS only; the host must be exactly `uexchange.ca`. `EF_RATE_URL` overrides the URL, but the API refuses to start if its host is not on the allow-list. 5 s timeout, 2 MB cap, strict schema (positive decimal strings, `is_visible` = `y`), no redirect to another host. Cache 60 s; if the feed fails, a snapshot up to 10 minutes old is used and flagged `stale`.
- The service fetches the rate **before** opening the database transaction, then stores the quote in the same transaction as the decision (`request_quote`, one row per revision). If the rate is unavailable the submit still succeeds with no quote. The audit event holds a quote hash and a rate id only.
- `GET /api/quote?sellAmount=&sellCurrency=&buyCurrency=` feeds the live estimate on the form (staff only, 30 requests a minute per session, then `RATE_LIMITED`). The estimate is advisory; the stored quote comes from the server at submit.
- **The decision engine never sees rates** (FR-70). They are not in the evaluation context, and a test shows the Decision is identical whatever the provider returns or when it fails.
- The stored quote is not refreshed. For an approved request older than 15 minutes the detail page warns that the rate may have changed.

Optional live check (needs network, skipped by default): `EF_LIVE_RATES=1 npx vitest run packages/adapter-rates/test/live.test.ts`.

## Completion record and who can see what

`POST /api/requests/:id/complete` takes `{ handedOver, given, rateApplied, reference, expectedVersion }` and stores one `request_completion` row (migration 003) in the same transaction as the transition and the audit event: amount handed over (request sell currency), amount given (request buy currency), rate applied (CAD per 1 foreign unit, up to 6 decimals), rate side, reference (3 to 40 of letters, digits, `-`, `_`), a copy of the quote's give, who and when. Validation is strict (decimal strings, positive, minor-unit scale, supported currencies). The response and the UI never say anything is flagged. The audit detail holds the reference and three booleans (`handedOverDiffers`, `givenDiffersFromQuote`, `rateDiffersFromQuote`), no names or amounts.

Every role that can open a request (same-branch staff and manager, reviewers, compliance) gets the same `quote`, `completion` (with `differsFromQuote`) and `give` values; other-branch staff and policy approvers still get 404. List and review-queue rows carry `give` (`COMPLETED` figure, else `QUOTED`, else null) for the "Member gets" column. A test checks this role matrix.

## Member name and privacy

By product-owner decision the member name is stored (an override of the references-only default DL-N11, for the name only). It is required, 2 to 80 characters, letters of any script, marks, spaces, apostrophe, period and hyphen, **no digits** (so a card or SIN number cannot be typed), trimmed and single-spaced.

It lives only in `request_revision.values`. It is not in the evaluation context or decision snapshot, audit rows, outbox payloads, inbox messages, notification text, logs, API error bodies (validation issues carry the field path and a fixed message, never the value) or the quote record. A test runs full flows and scans every table for the name. It is shown in the request detail, the teller list and the reviewer queue, to roles that can open the request, and not in the notification bell, page titles or URLs. "Submitted by" is resolved from the session user by a join, never taken from the client.
