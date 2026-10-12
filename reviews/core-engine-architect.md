# Architect review: `docs/core-engine-plan.md` (v0.1)

**Reviewer:** architect agent. **Date:** 2026-10-01. **Point-in-time snapshot; main docs not edited.**
**Checked against:** `policy-engine-design.md` §3, §4, §5.1, §6.1, §8.1, §9, §11; `PRD.md` NFR-01/04/07/09/10, FR-19; `azure-architecture-proposal.md` §4-6 (L106, L177, L262-313); ADR-002, 006, 010, 012, 016 (all still **Proposed**; only ADR-021/022 are Accepted); `docs/adr/README.md`.
**Method:** document and ADR read-through only. No code exists, so no throwaway script was run. Azure/pg-boss behaviours marked **verify** are from background knowledge, not checked.

## Verdict

The layering, the "PostgreSQL is the only state store" rule and the rejection of Durable Functions are sound. The port set is **not yet sufficient** to enforce its own invariant table. The commit-time pause mechanics are described three different ways. The audit chain is a hidden global serialisation point. Several determinism claims are weaker than stated.

| Severity | Count |
|---|---|
| High | 3 |
| Medium | 9 |
| Low | 4 |

---

## High

### CE-ARCH-01 (High): transaction, lock and evaluation order is contradictory; INV-CTRL-1 cannot be implemented from the plan as written
**Evidence.**
- Plan §3 pseudocode: `uow.run(tx => load request, control (FOR SHARE); result = workflowCore.apply(...))`. Evaluation therefore runs **after** the lock, inside the transaction.
- Plan §3 prose: "read policy pointer and control row, call evaluate, **then** take the commit-time lock and compare" (matches design §5.1 and ADR-016). Evaluation runs **before** the transaction.
- Plan §4: `ControlRepository` is reachable only through `Tx`, and "`UnitOfWork.run` is the only way to touch repositories". The pre-transaction read in the prose is therefore impossible without a second read-only `uow.run`.
- `UnitOfWork.run` allows `isolation: 'repeatable read'` and retries on serialization failure. `Clock.now()` and `evaluate` sit inside the retried closure.

**Problems.**
1. Two incompatible algorithms. The lock-first form is simpler and strictly safer: it needs no "re-evaluate once, then ENGINE_PAUSED" branch, because the revision cannot change after the share lock. Its cost is holding `FOR SHARE` for up to the 200 ms hard budget (ADR-017), which delays a pause by at most that long. This is a deviation from the wording of ADR-016 and design §5.1, so it must be a named deviation.
2. Under REPEATABLE READ the snapshot is taken at the first statement. `FOR SHARE` on a row updated after the snapshot raises a serialization error, not a fresh read. Retry would hide the pause race instead of resolving it. INV-CTRL-1 only holds under READ COMMITTED with the lock as an early statement.
3. A retry re-runs the closure, so `asOf` changes. The stored `asOf` must be the attempt that committed. The plan never states this. It also never states that the retry budget and the "re-evaluate once" budget are separate.
4. `policy_control` also holds `current_policy_version_id` (design §6.1). Lock-first pins policy and control together. Evaluate-then-lock pins control only, and design §9 says "uses the version pinned at read". The plan should say which.

**Fix.** Adopt lock-first for `submit` and `resubmit`, as follows.
- `uow.run` at READ COMMITTED, with `lockShared()` as the first statement.
- Evaluate with the locked row. Drop the re-evaluate branch, but keep the `ENGINE_PAUSED` fallback only for lock timeout.
- Set `lock_timeout` (`SET LOCAL`) on pause and resume.
- Forbid `isolation: 'repeatable read'` for commands that evaluate.
- Define `asOf` as the clock read inside the committed attempt.
- Record the deviation from ADR-016 in ADR-023, flagged for sign-off.

Or keep evaluate-then-lock and add `ControlRepository.read()` through a read-only `uow.run`, a `reevaluated: boolean` on the decision record, and an explicit retry counter. Lock-first is recommended.

### CE-ARCH-02 (High): audit hash chain is a global serialisation point, and the `audit_writer` role conflicts with "same transaction"
**Evidence.**
- Plan §4 `AuditChain.append`: hash = H(prevHash || canonical(event)), "in the caller's transaction". Plan §5 INV-AUD-1.
- Design §6.1 `AUDIT_EVENT { bigint seq PK, prev_hash, hash }`. ADR-012.
- Azure proposal L106: "Separate roles: app, `audit_writer`, migrator, reporting".

**Problems.**
1. A single linear chain means every command transaction reads and extends the head. If `seq` is a Postgres sequence, rolled-back transactions leave gaps and commit order differs from `seq` order, so the chain breaks or `verify` raises false alarms. If the head is a locked row, all commands serialise on it for the rest of the transaction. At credit-union volumes this is tolerable, but only if the lock is taken last.
2. No lock order is defined. Control (`FOR SHARE`), velocity subject lock (design §9, SEC-15), request row and audit head are all taken in the same transaction. Pause takes control `FOR UPDATE`, then audit head. Two submits for the same subject also race on the velocity lock. A deadlock is possible unless the order is fixed.
3. INV-AUD-1 says the "application role has no UPDATE/DELETE on audit tables". The Azure proposal gives audit writes to a different role, `audit_writer`. One connection under one role cannot write both inside one transaction without `SET LOCAL ROLE` or a `SECURITY DEFINER` function. Neither is in the plan, and the choice changes the adapter contract.

**Fix.**
- Keep one chain. Make the head a single row (`audit_head(seq, hash)`), updated by a `SECURITY DEFINER` function owned by `audit_writer`. The function computes `seq = head.seq + 1`, so no gaps and no sequence.
- Add **INV-LOCK-ORDER** (new): control, then velocity subject (ordered by key), then request rows, then audit head last. Add it to INV-TX-1's conformance test.
- State the throughput ceiling and the escape hatch (per-day chain segments, signed anchors) in ADR-012's follow-up.

### CE-ARCH-03 (High): the port set does not cover several invariants and mechanics the plan claims to enforce
**Evidence.** Plan §4 `Tx` and §5; design §6.1, §9, §10.3, §11.

| Gap | Effect |
|---|---|
| `VelocityRepository`, `UserDirectory` are named in `Tx` but never defined | FR-19 and the per-subject lock (SEC-15) have no signature. The velocity counter is the only place a **per-subject lock** appears. Parallel-submit test (design §11) has no S-xx scenario. |
| No session store port. `adapter-http` "session, CSRF" with sessions "in PostgreSQL" (§6.2) | Session reads and writes are not in `Tx`. Revocation, idle timeout and role-change effect on live sessions are unspecified. |
| No rule, approval, guardrail, signoff or control-event repositories (only `PolicyRepository.publish(manifest, signoffs)`) | Governance invariants (two-person activation, author != approver, resume approver) are in the design (§7, §11) but have no repository. |
| No `system` actor. `ActorRef` is a person. `expireApprovals` and `lapseEscalations` are commands that need an actor. | Audit attribution (NFR-09) and SoD for sweeps are undefined. |
| INV-PLACEHOLDER-1 start-up check needs "any ACTIVE `nonProduction` rule" | No query on `PolicyRepository`. |
| INV-PAUSE-1 production self-check ("automated outcomes with a later pause") | No reporting or read model port. The check needs commit ordering, but `decision_record.at`/`as_of` are not commit times. `now()` inside a transaction is transaction start. Use `control_revision` ordering plus a stored `committed_control_revision`, not timestamps. |
| Replay sample and nightly reconciliation (NFR-04, NFR-09) | No `DecisionRepository.sample()` or reconciliation query. |
| Retention purge (NFR-10) | No port. See REG-ARCH-09. |
| `AnchorWriter` is defined but absent from §2.2 and `AppConfig.keys` | Anchor job cannot be wired from the plan. |

**Fix.** Add a "port coverage matrix" (invariant to port method to adapter) as §4.1, and define the missing interfaces. Treat a missing row as a failed review of the plan.

---

## Medium

### CE-ARCH-04 (Medium): `Outbox` mixes a transactional writer with a non-transactional relay
**Evidence.** Plan §4 `Outbox` has `enqueue` (needs `Tx`) and `claimBatch`/`markDelivered`/`markFailed`/`lagSeconds`; `Tx.outbox: Outbox`. §4 rule "outbox writer accepts only a `Tx`".
**Problems.** `claimBatch` described as `FOR UPDATE SKIP LOCKED` implies holding a transaction open during delivery. If it commits before sending, the claim must be a column (`leased_until`), not a row lock. Neither is specified. The consumer in this system is the Postgres inbox (ADR-AZ-7), so delivery and `markDelivered` can share one transaction, which is simpler.
**Fix.** Split `OutboxWriter` (on `Tx`) from `OutboxRelay` (own connection, own short transactions, `leased_until` with crash recovery, `UNIQUE(dedupeKey)`). Specify columns. Use the same-transaction delivery for in-app notifications.

### CE-ARCH-05 (Medium): pure `policy-core` has a wall-clock budget
**Evidence.** Plan §2 table: `policy-core` must not import `Date`. Design §4.4 and ADR-017: "cooperative deadline between rules, 50 ms soft, 200 ms hard (`ENGINE_ERROR` / `TIMEOUT`)". Design §8.1: `evaluate(input)` has one argument.
**Problems.** A timeout depends on machine speed, JIT warm-up and host. A Functions cold start will time out more than a warm container. The same input gives different outcomes on different hosts, so INV-DET-1 and the cross-host equivalence check cannot hold for `TIMEOUT`. Replay of a stored `TIMEOUT` decision is non-reproducible.
**Fix.** Either give the evaluator a deterministic step budget (node count already has static limits) and keep the wall-clock watchdog **outside** `evaluate` (the caller aborts and records `ENGINE_ERROR/TIMEOUT`), or inject `deadline: () => boolean`. Exclude `TIMEOUT` from replay diffs and equivalence. Record which mechanism fired.

### CE-ARCH-06 (Medium): "same Node major and lockfile" does not give identical branch-local dates
**Evidence.** Plan §5 INV-DET-1 and §6.2 "Node and dependency parity"; design §4.1 (branch-local date, business-hours flag from IANA zone).
**Problem.** Context building uses the time-zone database. Node bundles ICU/tzdata per release. A container image, a Functions managed runtime and a Premium bundle can differ in tzdata at the same Node major, giving a different date or business-hours flag around a rule change. `context_hash` then differs.
**Fix.** Pin one tz library with a bundled tzdb in the lockfile (not host `Intl`), record `tzdbVersion` in `context`, and add a DST-boundary vector to the conformance suite. Put the context builder in `workflow-core` with the tz data as an input, so it is covered by replay.

### CE-ARCH-07 (Medium): PgBouncer transaction-mode claims are asserted, not met, by the stack
**Evidence.** Plan §4 port rules; §6.1 pooling row; §7.2 PgBouncer container; Azure proposal L106 (built-in PgBouncer, transaction mode); ADR-002 (pg-boss).
**Problems (all marked verify unless obvious).**
1. **pg-boss** uses its own connection and, in its maintenance and schema-migration paths, uses advisory locks and possibly session features. Route pg-boss, the migrator and `withLease` maintenance through the **direct** port (5432), not the pooled port (6432). The plan only constrains the ports, not the library.
2. **Prepared statements.** The plan bans reuse across calls. The driver or ORM chosen in E2 must be configured to avoid named prepared statements, unless the managed PgBouncer version supports protocol-level prepared statements in transaction mode. Check the version; add a conformance probe.
3. **Per-transaction settings.** `AppConfig.db.statementTimeoutMs` must be applied with `SET LOCAL` or at role level. A session-level `SET` leaks to the next client on the same server connection. The same applies to `lock_timeout` (CE-ARCH-01) and `SET LOCAL ROLE` (CE-ARCH-02).
4. **Advisory locks** are not banned outright. `pg_advisory_xact_lock` is transaction-scoped and safe. Say so, because the velocity lock (SEC-15) would otherwise be forced into a row lock.
5. **Entra token authentication** to Postgres with token expiry (about one hour) needs password refresh on pool connections. Whether PgBouncer on Flexible Server accepts Entra tokens for both hops is unconfirmed.
6. **Test fidelity.** A Testcontainers PgBouncer proves syntax, not Azure's PgBouncer version or limits. Keep a smoke job against the real test environment.

**Fix.** Add a "pooling rules" table to §4 (what is allowed, with the connection endpoint per component) and a conformance probe `S-14`: run S-02/S-05 with a pool of one server connection.

### CE-ARCH-08 (Medium): Functions relay and lease design can break INV-OUT-1
**Evidence.** Plan §6.1, §6.2 "Outbox relay on Functions"; `JobScheduler.withLease(name, ttlMs, fn)`.
**Problems.**
1. The relay is `SKIP LOCKED`-safe by design, so a lease on top is redundant for correctness. With a lease, a crash leaves the relay stopped until `ttlMs` expires. For a 10 s target the TTL must be below about 5 s, but `withLease` has no renew or heartbeat call, so a long loop cannot keep a short lease.
2. A 55 s loop inside a 1-minute timer holds one instance for the whole minute, and a missed or late timer ("past due") leaves a gap. NCRONTAB supports a seconds field, so a 5 s timer is possible on plans that allow it. The plan states a one-minute minimum for Consumption-class plans without a source (**verify**).
3. Timer triggers are singleton by default through a storage lease. That needs a storage account for the host, which is a second store of **coordination** state. The plan's rule "no host adds a second store of request state" still holds, but §1 should say host-internal storage is allowed if it holds no request state.

**Fix.** Use `SKIP LOCKED` plus `leased_until` per row for the relay on every host, with no `withLease`. Reserve `withLease` for sweeps, and add `renew()` if a lease must outlive its TTL. Keep the spike (P-new-1) but make the 10 s relay cadence and max-instance cap explicit pass criteria.

### CE-ARCH-09 (Medium): sweeps and system commands are under-specified
**Evidence.** Plan §6.3 table; `findDueForExpiry(asOf, limit): Promise<Uuid[]>` "SKIP LOCKED"; design §3 (expiry, escalation window), §6.1 (`EXCHANGE_REQUEST` has no deadline columns); BQ-3, BQ-5 (TBD).
**Problems.**
1. Returning IDs from a `SKIP LOCKED` select outside a transaction releases the locks at statement end, so two sweepers can pick the same ID. The state guard (`expectedVersion`) makes this safe, but the "SKIP LOCKED" claim is misleading and double-fire shows up as 409s.
2. The deadline columns (`approval_expires_at`, `escalation_window_ends_at`) are not in the data model. Computing them at transition time freezes the window under the policy in force; computing at sweep time makes a later window change retroactive. Business-day windows also need the branch calendar.
3. The decision to drop Durable rests on sweep granularity ("1 minute is far finer than hours or days"). That holds only if the windows are not minutes (BQ-3/BQ-5 are unanswered).

**Fix.** Process one request per transaction (`SELECT ... FOR UPDATE SKIP LOCKED` inside it). Add the deadline columns to the data model, set at transition time. Make "window >= 1 hour" an assumption in ADR-024, to be re-checked when BQ-3/BQ-5 are answered.

### CE-ARCH-10 (Medium): authorization is outside the transaction
**Evidence.** Plan §3 (`authorize(...)` before `uow.run`); §4 `Authorizer` (not on `Tx`; reads DB "on every call").
**Problem.** Per-object separation of duties needs the loaded request (submitter ID), which is only available inside the transaction. Authorizing on a separate connection leaves a window in which a role or branch scope was revoked.
**Fix.** Put `Authorizer` reads on `Tx` for state-changing commands (role and scope read under the same snapshot as the request), keep a pre-check for cheap rejection. Document the residual window for read-only queries.

### CE-ARCH-11 (Medium): HMAC for the pseudonymous key via Key Vault sits on the submit path
**Evidence.** Plan §4 `KeySigner.hmac` "pseudonymous customer key (SEC-14)"; NFR-01 (2 s p95); FR-19.
**Problems.** One remote Key Vault call per submit adds latency and a hard dependency to the commit path. The plan's own note that signing "is not transactional" is true but not the issue. Key rotation changes every pseudonym, which breaks velocity windows (and regulatory look-backs, see REG-ARCH-06). Also, whether the Key Vault tier in use supports HMAC keys is unconfirmed (**verify**).
**Fix.** Fetch a versioned HMAC secret at start-up, compute locally, and store `keyVersion` beside the pseudonym. Support lookup under the current and previous version during rotation. Keep `sign` for anchors remote.

### CE-ARCH-12 (Medium): HTTP layer duplicates NestJS and may weaken the authorisation pipeline
**Evidence.** Plan §2 `adapter-http` ("framework-neutral request pipeline: session, CSRF, problem+json, authz") and §6.2 ("Nest controllers and Functions triggers translate to and from it"); ADR-001/CLAUDE.md settle NestJS.
**Problem.** If guards, pipes and filters are replaced by a neutral pipeline, NestJS is a router only. Two translation layers (Nest, Functions) must keep identical cookie, CSRF and error behaviour, for a host that is "not recommended". Any security feature added in Nest idiom is silently absent on Functions.
**Fix.** Keep the neutral pipeline, but add the cross-host conformance group for security behaviour (cookie flags, CSRF failure, 401/403 shape, problem+json codes) and state that Nest hosts call it from a single global guard. Defer Functions HTTP to the spike.

---

## Low

### CE-ARCH-13 (Low): process gaps against `CLAUDE.md` conventions
ADR-023 and ADR-024 exist only as text in the plan. `CLAUDE.md` requires a file in `docs/adr/` and a row in `docs/adr/README.md`. Also, the plan treats ADR-006/010/012/016 as binding, but all are **Proposed**; only ADR-021/022 are Accepted. Say so, and list which Proposed ADRs the plan depends on (ADR-016 is amended by CE-ARCH-01). **Fix:** create both ADR files; list dependencies.

### CE-ARCH-14 (Low): conformance harness exposes test hooks in the artifact under test
`HostDriver.setClock` ("disabled in prod builds"), `crashAfter(failpoint)` and fixed-clock modes must exist in the artifact the suite runs against (§6.2 "runs against each artifact"). A build flag is weak protection. Also S-05 needs a **barrier** (`holdAt(failpoint)`, release on signal) to force a pause between evaluation and commit; `crashAfter` cannot do that, and 1,000 random iterations will not reliably hit the window. **Fix:** a separate test composition root that refuses to start when `environment=prod`, a build check that the production artifact contains no test entry points, and a `holdAt`/`release` pair in `HostDriver`. Add an `IdGenerator` counter mode so cross-host equivalence is comparable.

### CE-ARCH-15 (Low): dependency table is self-inconsistent
§1 rule 1 says "hosts to adapters to application services"; §2 says adapters may not import `app-services` internals, yet the §2.1 diagram has `adapter-http` calling `app-services`. `adapter-http` is really a host-side package. **Fix:** rename or move it to the host layer, and state which `app-services` exports are public.

### CE-ARCH-16 (Low): scope and cost of the structure for a small team
Eight packages, ten ports, three host directories and a conformance matrix, for one shipping host in REL-1. R24 acknowledges this. **Fix:** start with `policy-core`, `workflow-core`, `app-services`+`ports` (one package), `adapter-postgres`, `conformance`, `hosts/aca`. Split further only when a second host is real. Keep dependency-cruiser rules from day one.

---

## What is sound

- Rejecting Durable Functions (§6.3, ADR-024) is sound on the evidence in Azure proposal L295: the task hub is a second store, PII risk, replay-determinism constraints. Sweeps with `expectedVersion` cover timers. The conditions are in CE-ARCH-09.
- Lock-based pause mechanics are correct in principle: many `FOR SHARE`, one `FOR UPDATE`, revision increment. Under READ COMMITTED a share lock re-reads the committed row, so a pause that committed first is seen.
- Idempotency via a unique key inside the submit transaction is correct. Non-submit commands rely on `expectedVersion`, so a retry after commit-then-timeout returns 409 `STALE_REQUEST`, not the stored response. State that in INV-IDEM-1 so the Functions note ("handlers must be idempotent by design") is not read as covering all commands.
- Host-neutral invariants table (§5) is the right artefact. Its gaps are in port coverage, not intent.

## Decisions the product owner must make

1. **Pause mechanics.** Approve lock-first evaluation for `submit`/`resubmit` (a named deviation from ADR-016/design §5.1), or keep evaluate-then-lock with the extra machinery (CE-ARCH-01).
2. **Audit chain.** Accept one global chain with a head row and a stated throughput ceiling, or require segmentation now (CE-ARCH-02). Confirm the `audit_writer` mechanism (`SECURITY DEFINER` function).
3. **Time budget semantics.** Accept a deterministic step budget (or an out-of-engine watchdog) and that `TIMEOUT` is excluded from replay equality (CE-ARCH-05).
4. **Functions option.** Approve ADR-024 (no Durable) and confirm whether non-deployed hosts gate pull requests or run nightly; fund or decline the Functions spike with the 10 s relay and cold-start pass criteria (CE-ARCH-08).
5. **Expiry and escalation windows.** Answer BQ-3 and BQ-5, because ADR-024's soundness assumes windows of an hour or more (CE-ARCH-09).
6. **HTTP stack.** Confirm NestJS stays the HTTP framework on VM and Container Apps, with the neutral pipeline limited to what Functions needs (CE-ARCH-12).
7. **Package scope.** Approve the reduced REL-1 package set (CE-ARCH-16).
