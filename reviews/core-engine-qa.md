# QA review: `docs/core-engine-plan.md` (v0.1)

Reviewer: QA. Date: 2026-10-01. Scope: conformance suite (§7), invariants (§5), host feasibility (§6), CI (§7.3), backlog (§9). Question asked: "is the result right?", so each finding asks whether a test could actually fail for the right reason.

Verdict: the structure is sound (scenarios, driver, equivalence, replay). It is not yet a testable plan. Five High findings below must be fixed before the suite is estimated.

## Invariant-to-test coverage

| INV | Mapped test | QA status |
|---|---|---|
| INV-TX-1 | S-02 + nightly reconciliation | Partial: failpoints not enumerated; reconciliation is detection, not a test (CE-QA-03) |
| INV-CTRL-1 | S-05 | Partial: race is statistical; "changed twice" branch has no test (CE-QA-01) |
| INV-PAUSE-1 | S-05 + self-check | Statement and self-check ill-defined (CE-QA-02) |
| INV-IDEM-1 | S-03 | Partial: expected response of the concurrent duplicate undefined (CE-QA-07) |
| INV-CONC-1 | S-06 | Partial: only reviewer decisions; no backstop-constraint test (CE-QA-08) |
| INV-DET-1 | Replay gate | No named scenario; "same engineVersion" vs replay under a new build contradict (CE-QA-09) |
| INV-3VL-1 | DT-15..17 | Partial: ill-typed field not covered (CE-QA-09) |
| INV-OUT-1 | S-08 | Not testable on Functions as designed (CE-QA-05) |
| INV-PLACEHOLDER-1 | S-09 | Mostly covered; Functions warm-up race (CE-QA-10) |
| INV-AUD-1 | S-10 | Partial: "no PII" has no canary test (CE-QA-08) |
| INV-LOG-1 | S-11 | Sinks not enumerated (CE-QA-11) |
| (none) | S-04, S-07, S-12, S-13 | Scenarios without invariant IDs (CE-QA-12) |
| (none) | velocity counters under parallel submit | Listed in design §11 Concurrency, absent from S-01..S-13 (CE-QA-12) |

## Findings

**CE-QA-01 [High] Pause race (S-05) is probabilistic and misses the second-change path.**
Evidence: §5 INV-CTRL-1, §7.1 S-05, §7.3 (1,000 nightly, 100 on PR). Design §11 and DT-40 were a GAP.
Problem: a 100-iteration race on a PR gives no guarantee that the window between evaluate and the `FOR SHARE` lock was ever hit. `HostDriver` has only `crashAfter`; there is no way to pause the submit at a named point. The rule "re-read and re-evaluate once; if it changes again store `ENGINE_PAUSED`" has no test at all.
Fix: add failpoint kind `barrier(name)` (block until released) at `after-evaluate` and `before-commit-lock`. Make deterministic tests: (a) pause committed in the window, expect re-evaluation then `ENGINE_PAUSED`/`RULE_PAUSED` as per DT-40; (b) pause then resume then pause in the window, expect the second-change fallback; (c) resume in the window (no automated outcome stored from a stale paused view is acceptable, but assert stored control_revision equals locked one). Keep the 1,000-iteration stress as a supplement. Also assert zero automated decisions whose commit order follows the pause commit, using DB commit order (see CE-QA-02).

**CE-QA-02 [High] INV-PAUSE-1 and its production self-check are not testable as written.**
Evidence: §5 INV-PAUSE-1; design L269.
Problem: "no automated outcome commits after a pause commits" does not say whether it is global or per rule (a per-rule pause only affects requests that rule matches). The self-check "automated outcomes with a later control_revision pause" is backwards: a decision stores the revision it evaluated under, so a violating decision has an OLDER revision than the pause but commits later. No commit-order column is named.
Fix: restate per rule and global; define the oracle as `decision.committed_at (or xmin order) > pause.committed_at AND decision.control_revision < pause.revision AND outcome automated AND (global pause OR deciding rule paused)`. Name the column that carries commit order; add a test that seeds a violating row and the check flags it.

**CE-QA-03 [High] Fault injection (S-02, S-03, S-08) lacks named failpoints and cannot be done the same way on Functions.**
Evidence: §7 `crashAfter(failpoint)`, S-02 "at each write", S-03 "commit-then-crash".
Problem: no failpoint list. Three different faults are conflated: exception before commit (rollback), process death before commit, and process death after commit but before the response (lost ack). S-03 and S-08 need the last one. On Functions, "kills the host process or invocation" has no defined mechanism; killing a worker mid-invocation triggers platform retry semantics that differ from a container kill.
Fix: publish a failpoint catalogue (one per write in INV-TX-1: request, revision, decision, review, audit, outbox, idempotency complete; plus `after-commit-before-response`, `after-claim-before-deliver`). Define each as throw / hard-exit / connection-drop. For Functions define how hard-exit is realised (process exit in a custom handler, then host restart) and state what is out of reach (platform retry, instance recycle); mark those as spike items, not conformance.

**CE-QA-04 [High] Cross-host equivalence is under-specified and the VM comparison is partly vacuous.**
Evidence: §7.1 Cross-host equivalence; §6.1 (VM and ACA run "the same image").
Problem: "identical canonical decision bytes" will include `asOf`, UUIDs, policy IDs, audit sequence and hash. `HostDriver` can fix the clock but not seed `IdGenerator`; concurrent scenarios are order-dependent. The comparison covers decisions only, not audit chain head, outbox rows, or HTTP response bodies and status codes. VM and ACA share an image, so agreement proves nothing except the wrapper; the real diversity is Functions vs container.
Fix: add `seedIds(n)` to the driver (counter generator in non-prod builds); define a normalisation spec (what fields are compared, what is masked); compare decision, audit chain head, outbox set, and problem+json bodies; run the scenarios sequentially for equivalence and keep races to per-host assertions. State honestly that VM = ACA at the artifact level.

**CE-QA-05 [High] Functions feasibility cannot be shown by the proposed local and CI setup.**
Evidence: §7.2 (Functions row), §6.2 Outbox relay, §6.1 table, §9 P-new-1.
Problem: (a) `runJob` through the admin endpoint bypasses the timer trigger, so INV-OUT-1 (relay within 10 s), the loop-until-empty design, and S-12 double-fire never exercise the real trigger. (b) Core Tools plus Azurite do not emulate Flex Consumption always-ready, cold start, scale-out or instance recycle, so the NFR-01 cold-start claim, per-instance pool behaviour and `withLease` under multiple instances are unmeasured. (c) "a Postgres-polling trigger on Premium" is not a known first-party trigger; treat as unverified. (d) Timer minimum (one second on Premium) and "no slots on Flex" are unconfirmed Azure facts and carry no **verify** tag here. (e) "Warm-up function runs the INV-PLACEHOLDER-1 check" has no ordering guarantee against the first trigger.
Fix: split Functions criteria into (i) conformance runnable locally (HTTP path, `runJob`) and (ii) cloud-only acceptance run in the P-new-1 spike on a real Flex or Premium app with measurable pass criteria: p95 latency with and without cold start, relay lag p99 ≤ 10 s over 1 hour, two-instance double-fire test, pool saturation at N instances. Tag the Azure facts **verify**. Do not claim Option 3 "feasible" until (ii) passes.

**CE-QA-06 [High] Conformance runs on a different artifact from what ships.**
Evidence: §7 `setClock` "disabled in prod builds"; `crashAfter`; §6.2 "suite runs against each artifact".
Problem: the driver needs test-only clock and failpoint endpoints, which prod builds exclude, so the tested artifact is not the shipped artifact. A defect in the gating itself (endpoint reachable in prod) is untested.
Fix: build one artifact with the test hooks behind `environment != prod` AND a startup refusal (testable), then add a prod-mode test: same artifact started with `environment=prod` returns 404 on the hooks and refuses to start with the software signer or `allowNonProductionRules=true`. Run the INV-PLACEHOLDER-1 suite and the smoke scenario against that prod-mode start.

**CE-QA-07 [Medium] INV-IDEM-1 expected results are undefined for races and timing.**
Evidence: §5, S-03; ports `IdempotencyRepository.begin`.
Problem: what does the second of two concurrent identical submits receive (wait and replay, 409, or 5xx)? "Safe across failover" cannot be tested. Payload hash canonicalisation (field order, decimal `100.1` vs `100.10`) and key retention/TTL are not stated. A replay of a response whose original produced a Sev-1 fallback is unspecified.
Fix: state the contract (second caller blocks on the unique row then replays), add vectors for equivalent-but-textually-different payloads, key expiry, and a replay after the policy has since changed (must return the stored response, not re-evaluate). Drop "failover" or test it through the connection-drop failpoint.

**CE-QA-08 [Medium] INV-CONC-1, INV-AUD-1 and INV-TX-1 miss negative and backstop tests.**
Evidence: §5 rows; S-06, S-10.
Problem: S-06 covers reviewer decisions only; other command pairs (decide vs cancel, decide vs expiry sweep, escalate vs lapse sweep, double resubmit) are untested. The `UNIQUE(request_id, cycle)` backstop is claimed to live in migrations but no test bypasses the app (direct insert must fail). INV-AUD-1 "IDs and hashes only, no PII" has no test (needs a PII canary through every command and an audit scan). Chain verification has no tamper test (mutate a row as superuser, `verify` returns `firstBadSeq`). Anchor write failure behaviour is untested. "Nightly reconciliation" is monitoring, not conformance.
Fix: add a command-pair race matrix to S-06; a constraint-bypass test; PII canary scan of audit; tamper and truncation tests.

**CE-QA-09 [Medium] INV-DET-1 and INV-3VL-1 mappings are weak.**
Evidence: §5; §7.1 Replay; ADR-006.
Problem: INV-DET-1 says byte-identical "for the same engineVersion", but the Replay gate re-evaluates stored inputs "under the new build", whose engineVersion differs; define what must be equal (everything except `engineVersion`) and what a permitted diff is (design §11 says "unless approved", the plan says "any diff blocks"). There is no check that two different builds (Node major, Functions bundle) produce identical bytes, which is the whole point of the claim. INV-3VL-1 says "missing or ill-typed" but DT-15..17 are missing-data vectors; ill-typed (string for amount, wrong currency) has none. Property tests should log seeds so failures replay.
Fix: add a per-host replay run on the same stored sample and compare across hosts; add ill-typed vectors; record fast-check seeds in CI output; reconcile "unless approved" wording.

**CE-QA-10 [Medium] INV-PLACEHOLDER-1 has gaps in how the tests discriminate.**
Evidence: §5 row; S-09.
Fix: list the assertions: start-up refusal, `publishPolicy` rejection, image scan for seed files, self-check Sev-1 on a seeded violating decision, and a negative control (same rule works in `demo`). Add the Functions ordering test from CE-QA-05(e).

**CE-QA-11 [Medium] INV-LOG-1 canary test needs an explicit sink list.**
Evidence: §5, S-11, §6.1 Telemetry.
Problem: "no log or telemetry sink" is open-ended. Missing: PostgreSQL server logs (statement logging with bind parameters), PgBouncer logs, pg-boss payloads, error stacks and problem+json bodies, Functions host logs, App Insights dependency telemetry (SQL text), and the outbox payload itself.
Fix: enumerate sinks; capture each in the harness; place the canary in every PII field, including inside a failing request (validation error, 500). Assert Postgres `log_statement`/`log_min_duration_statement` settings.

**CE-QA-12 [Medium] Scenarios and behaviours without invariant IDs; missing scenarios.**
Evidence: §5 vs §7.1; design §11 Concurrency, Governance rows.
Gaps: no invariant for resubmission floor (S-04), escalate-once (S-07), expiry (S-12), SoD and branch scope (S-13); velocity counters under parallel submit (design §11) is in no scenario; graceful shutdown/SIGTERM drain (§6.1) has no test; PgBouncer transaction mode "no session features" is asserted by a lint-free runtime test only if the suite deliberately fails on session-level calls (state how); migrations (forward-only, constraints present) untested; authorisation reads from DB on every call (ADR-014/015) has no test (revoke role mid-session).
Fix: add INV-FLOOR-1, INV-ESC-1, INV-SOD-1, INV-AUTHZ-1 or map S-xx to FR IDs; add scenarios S-14 velocity race, S-15 shutdown drain, S-16 role revocation, S-17 migration/constraint presence.

**CE-QA-13 [Medium] CI gating weakens the guarantee.**
Evidence: §7.3 bullets.
Problem: non-deployed hosts nightly means a PR can break the Functions host and the break is found a day late, possibly after several merges. PR-level S-05 at 100 iterations is weak (see CE-QA-01). The open item is left to the sponsor.
Fix: PR runs the full scenario set once (deterministic, barrier-based) on the shipped host plus the HTTP-path subset on Functions via `func start`; nightly adds stress and cloud spike tests. Record who owns nightly failures and the SLA to fix them.

**CE-QA-14 [Low] Property and vector bookkeeping.**
Evidence: §7.1, §10. "DT-01 to DT-41" are said to be "per design §11", which resolves GAP rows but DT-10, DT-32 raise alerts; vectors must include the alert expectation. P5/P6 end-to-end per host need a fixed list of rules/pauses. §9 item 3 says DT vectors and properties are "pure; no dependency on E2a" but the vectors-as-JSON loader is in `conformance`, which is part of E2a; clarify the ordering.

## Decisions the product owner must make

1. Do non-deployed hosts (Functions, VM) gate pull requests, or run nightly only? Recommended: HTTP-path subset on PR, full suite nightly.
2. Is Option 3 "feasible" only after the cloud spike meets stated numbers (relay lag, p95, double-fire)? Who owns and funds the spike, and what is the stop rule?
3. Does the conformance suite run against a prod-mode start of the shipped artifact (recommended), accepting test hooks compiled into non-prod builds only?
4. Contract for a concurrent duplicate submit: block-and-replay or 409?
5. Is a replay diff ever allowed through with approval, and who approves (design says yes, plan says no)?
6. Is INV-PAUSE-1 per rule or global in the production Sev-1 self-check, and who is paged?
