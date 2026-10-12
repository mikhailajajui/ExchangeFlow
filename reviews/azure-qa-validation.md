# ExchangeFlow — QA Validation of the Azure Architecture Proposal

| | |
|---|---|
| **Reviewed** | `azure-architecture-proposal.md` (Draft v0.1), `diagrams/azure-architecture.drawio` (4 pages, including the 19-step call flow) |
| **Read against** | `PRD.md` §8 NFRs, `reviews/qa-review.md`, and the relevant items of `reviews/architecture-review.md` (D6, ADR-006/016/017/021) and `reviews/security-review.md` (SEC-19, SEC-23) |
| **Angle** | QA, testability, operability (Option 2 only) |
| **Date** | 2026-10-01 |

## Verdict: **Approve with changes**

Option 2 is the right choice to test against. It keeps one process, an in-process engine and a single database transaction, so the decision-table, property and replay suites from `qa-review.md` carry over unchanged. Before R1 build starts, the following **High** items must be fixed:

| ID | Problem |
|---|---|
| QA-AZ-01 | A worker that scales to zero never drains the outbox |
| QA-AZ-02 | Database migrations aren't in the pipeline, and rollback ignores the schema |
| QA-AZ-03 | The test environment can't run failover or representative load tests |
| QA-AZ-04 | Nothing proves the placeholder auto-decision flag is off in production |
| QA-AZ-05 | The automation-accuracy guardrail has no metric, alert or mechanism |
| QA-AZ-06 | The pipeline has no accessibility, performance or decision-table gate, and smoke-test criteria are undefined |
| QA-AZ-07 | No DR restore drill, and RTO/RPO are undefined |
| QA-AZ-08 | Call-flow step 9 has no failure branch (control revision changed at commit) |
| QA-AZ-09 | No test identity strategy that works with MFA, Conditional Access and PIM |

Severity: **High** = would let a wrong or unverified result reach production, or blocks an NFR test. **Medium** = the NFR can be verified, but only after a missing number, tool or step is added. **Low** = clarity.

All target files below are owned by the architect or tech lead. QA did not edit them.

---

## 1. NFR verification on Option 2

"Env" = where the test must run. Pass criteria use the numbers proposed in `qa-review.md` §2 until stakeholders confirm them.

| NFR | How to test on Azure | Env | Pass criteria | Can Option 2 meet it / can it be measured? |
|---|---|---|---|---|
| **NFR-01** p95 ≤ 2 s | **Azure Load Testing** (JMeter or Locust) against the Front Door endpoint, using a scripted submit mix built from fixture policies. Server-side time comes from App Insights `requests` duration for `POST /requests`. Client-side time comes from Load Testing. | perf (scaled-up test, see QA-AZ-03) | p95 ≤ 2.0 s and p99 ≤ 4 s at the Q9 peak for 15 min. Error rate < 0.1 %. Engine `evalDurationMs` p99 < 50 ms | **Meets** (min 2 replicas, no cold start). **Measurement gap:** test SKUs are "smaller sizes", and WAF rate limits will throttle load traffic (QA-AZ-10). Load numbers are still TBD (Q9). |
| **NFR-02** engine timeout 50 ms soft / 200 ms hard | Unit and integration tests with a deliberately slow rule fixture and a fake clock. On Azure, an App Insights custom metric `engine.eval.duration` plus a counter `engine.timeout`. | CI + test | Every evaluation over 200 ms returns `HUMAN_REVIEW/ENGINE_ERROR` (sub-cause TIMEOUT). 0 automated outcomes with duration > 200 ms (KQL over decision telemetry) | **Meets** (in-process). **Measurement gap:** the proposal defines no engine-duration telemetry (QA-AZ-17). |
| **NFR-03** availability | App Insights **standard availability tests** against a `/health/ready` endpoint (DB + Key Vault reachable) from ≥ 3 locations every 1 min. Zone resilience: forced PostgreSQL HA failover (`az postgres flexible-server restart --failover Forced`) during load. Service Bus and Key Vault access-denial faults via **Azure Chaos Studio**. Replica loss: delete or restart replicas of the active revision. | perf / pre-prod with ZR enabled | Target TBD (AZ-5, Q9). Proposed ≥ 99.5 % in business hours. During PG failover: no lost committed decisions, client retries with the same Idempotency-Key succeed, recovery < 120 s | **Partly measurable.** Chaos Studio's fault library, as far as QA knows, has no Container Apps zone-down fault (verify current support). Zone failure of the app tier can't be injected, so it relies on the platform SLA. **Can't test in `test` as specified** (non-ZR tiers, QA-AZ-03). |
| **NFR-04** atomic decision + state + audit | Integration tests (Testcontainers Postgres) with fault injection before and after each statement in step 9 and step 18. On Azure: kill api replicas and force PG failover mid-load, then run a **reconciliation query**. | CI + perf | 0 requests without a decision record. 0 decisions without an audit event. 0 outbox rows older than X min unpublished. Hash chain verifies end to end | **Meets** (one DB transaction). The reconciliation query should become a scheduled prod self-check (QA-AZ-18). |
| **NFR-03/04 DR** | **Geo-restore drill:** restore the PG geo-backup into Canada East, deploy Container Apps from Bicep with `region=canadaeast`, repoint Front Door, verify hash-chain continuity against the GRS Blob anchors | dedicated DR drill, twice a year | RTO/RPO met (AZ-5, TBD). Audit chain verifies. Last anchor ≤ RPO | **Not verifiable yet.** No drill, no Canada East compute, no RTO/RPO (QA-AZ-07). |
| **NFR-05** TLS, authN everywhere, server authZ | `testssl.sh` against Front Door. Azure Policy compliance (min TLS 1.2). `curl` the Container App's own FQDN directly to prove the origin isn't reachable outside the private link. A route-inventory test (every route except health returns 401 unauthenticated). The role × endpoint matrix test from `qa-review.md` FR-61. | test + prod (read-only probes) | TLS ≥ 1.2 only. Origin direct access refused. 100 % of routes in the inventory are covered | **Meets.** Add the origin-lockdown test (QA-AZ-11). |
| **NFR-06** secrets out of code | gitleaks in CI. Azure Policy requiring Key Vault references. A pipeline check that no Container App revision has plaintext `secrets[].value` or secret-like env vars (`az containerapp show`) | CI + each deploy | 0 findings | **Meets.** Gate missing from the pipeline (QA-AZ-06). |
| **NFR-07** no sensitive data in logs | Submit **canary PII values** through E2E tests, then KQL-search every sink: `AppRequests` (URLs and query strings), `AppTraces`, `AppExceptions`, `AppDependencies` (**SQL command text** if enabled), `ContainerAppConsoleLogs_CL`, Front Door access and WAF logs (request URI, matched values), Service Bus dead-letter message bodies, Web PubSub logs | test | 0 canary hits in every sink | **Risky.** WAF logs record matched request content. App Insights SQL collection can capture parameters. DLQ bodies hold the event payload (QA-AZ-12). |
| **NFR-08** synthetic only outside prod | Separate subscriptions. Azure Policy / RBAC deny on cross-subscription restore of the prod PG into dev or test. App startup check refuses rows without `synthetic=true` when `ENV≠prod`. | dev, test | Policy compliance 100 %. Startup check enforced | **Meets** once the startup check and restore deny exist (QA-AZ-13). |
| **NFR-09** reproducible decisions | CI replay over the fixture corpus (the pipeline lists "decision replay" in test). A **prod nightly replay job** of N random decisions using stored `{context, policyVersion, controlRevision, asOf, engineVersion}` (architecture review ADR-006) | CI + prod | 100 % identical outputs for the same engineVersion | **Meets in design.** The prod self-check isn't in the job list (QA-AZ-18). |
| **NFR-10** retention | Verify PG backup retention (Flexible Server PITR max 35 days), the Blob immutability policy period, and Log Analytics retention against the retention schedule | prod config audit | Matches the schedule (TBD) | **Not measurable until defined.** Records needing long-term retention need LTR backup or archival export, not PITR. A *locked* immutability period can't be shortened later (QA-AZ-14). |
| **NFR-11** usability | Moderated sessions on test with synthetic data. App Insights custom events `form.opened` → `request.submitted` give the time on task | test | ≥ 80 % of ≥ 5 users < 60 s | Platform-neutral. Measurable. |
| **NFR-12** WCAG 2.1 AA | `@axe-core/playwright` in E2E, plus a manual NVDA/keyboard audit before each release | CI + test | 0 serious/critical axe violations. Manual checklist passed | Platform-neutral. **Missing from the pipeline** (QA-AZ-06). |
| **NFR-13** browsers | Playwright on Chromium, Edge and Firefox. Microsoft Playwright Testing (cloud browsers) is optional | CI + test | All E2E green on all 3 | Meets. |
| **NFR-14** errors, conflicts, pauses, notification failures alerted | Fire each event deliberately in test (engine error fixture, conflict fixture, pause, DLQ poison message) and assert that an alert reaches the action group | test | Each alert arrives within 5 min | **Partly.** No action groups or on-call target defined. Several required alerts are missing (QA-AZ-16). |
| **NFR-15** scale with headroom | Azure Load Testing at 2× peak for 1 h. Watch replica count, PG CPU and connections, outbox lag | perf | NFR-01 holds. PG connections < 80 % of max | **Measurement gap.** Volumes TBD. No max-replica or connection-pool sizing: replicas × pool size can exhaust PG `max_connections`, so use the built-in PgBouncer (QA-AZ-15). |

---

## 2. Findings

### High

**QA-AZ-01 [High] A worker that scales to zero never drains the outbox.**
- The worker "scales on Service Bus queue depth" and "can scale to zero" (§5 Strengths, §8).
- The worker is also the component that polls the outbox and *publishes* to Service Bus (call-flow steps 11–12).
- With 0 replicas, nothing publishes, so the queue stays empty, so KEDA never scales the worker up. Notifications (FR-50/51) and every other outbox consumer stall silently.
- **Fix:** split the outbox relay from the consumer. Either run the relay with `minReplicas: 1`, or run it as a Container Apps job, or scale it with a KEDA PostgreSQL scaler on `count(outbox where published_at is null)`.
- **Test:** scale the worker to 0, submit a request, and assert the notification arrives within FR-50's latency.
- **Alert:** oldest unpublished outbox row age > 60 s.
- **Target:** `azure-architecture-proposal.md` §5 table, §8, §10 diagram; drawio Option 2 page `opt2-i14`.

**QA-AZ-02 [High] Database migrations are missing from the pipeline, and rollback ignores the schema.**
- §10 deploys "Bicep + new revision" with no migration step, although a `migrator` DB role exists (§3).
- With revisions and traffic splitting, old and new revisions run **against the same database at the same time**. "Rollback = shift traffic" doesn't undo a migration.
- **Fix:** add a migration stage, run as a Container Apps job under the migrator identity, *before* the new revision. Mandate expand/contract (backward-compatible) migrations. Rehearse every migration in test against a production-shaped synthetic dataset, including running the **previous** revision against the migrated schema.
- **Gate:** the N-1 revision passes the smoke suite on schema N.
- **Target:** §10 Delivery pipeline (diagram and text); new ADR "Schema migration and rollback".

**QA-AZ-03 [High] The test environment can't run failover or representative load tests.**
- §10 Environments says test is "production-like topology, smaller sizes". §8 says "use smaller, non-zone-redundant tiers in dev and test".
- Without ZR HA, PG forced failover and zone tests (NFR-03/04) can't run.
- With smaller SKUs, NFR-01/15 results don't transfer to prod.
- The test environment also hosts the **demo**, so load and chaos runs will disrupt demos and pollute demo data.
- **Fix:** add a **perf** profile: a Bicep parameter set that scales test to prod SKUs with ZR HA for scheduled load and chaos windows, then scales back. Alternatively, add a separate ephemeral `perf` resource group. Move demo to its own resource group or environment. State explicitly that pass criteria are measured only on the perf profile.
- **Target:** §10 Environments table, §8 cost levers.

**QA-AZ-04 [High] Nothing proves the placeholder auto-decision flag is off in production.**
- "Demo-only placeholder auto-decisions allowed here, never in prod" is a statement, not a control. See SEC-23 and ADR-021.
- **Fix:** use layered, testable controls:
  1. Bicep sets `EXCHANGEFLOW_ENV=prod` on prod Container Apps. A pipeline step **asserts** that no prod revision has `ALLOW_NONPROD_RULES` or the demo-identity flag (`az containerapp show` query).
  2. The app refuses to start in prod if either flag is set.
  3. The rule-store publish path rejects any `nonProduction`/`PLACEHOLDER-*` rule with an ACTIVE approve or decline outcome when env = prod.
  4. A pipeline test deploys the prod configuration to test, attempts to publish such a rule, and expects rejection.
  5. A scheduled KQL/SQL self-check (`decisions where decidingRule.nonProduction = true and env = prod` → must be 0) raises a **Sev-1 alert** on any hit.
- **Target:** §10 Environments + Delivery pipeline; §11 Security mapping (new row).

**QA-AZ-05 [High] The automation-accuracy guardrail can't be verified or enforced.**
- PRD §9: "any rule whose accuracy falls below its agreed threshold is paused". The proposal's alerts cover only a "shadow disagreement spike".
- There is no per-rule accuracy computation, no threshold, no minimum sample size, and no pause action.
- Success metrics (time to decision by path, automation rate, reviewer workload, overturned auto-declines, sampled-review error rate, record completeness) all come from PostgreSQL, but the proposal defines no reporting or dashboard surface.
- **Fix:**
  - A nightly Container Apps job computes per-rule metrics from the read-only reporting role into a `rule_metrics` table, and emits them as App Insights custom metrics. Only IDs and counts go to App Insights, never request values.
  - An Azure Monitor alert fires when a rule's accuracy < threshold with n ≥ minimum sample. The alert notifies the policy owner and opens a pause task. Auto-pause is optional and needs a policy-owner decision.
  - An Azure Monitor Workbook (or Power BI on the reporting role) covers the PRD §9 metrics.
  - Prerequisite: the FR-37 agreement definition (`qa-review.md` H7).
- **Test:** seed a golden dataset where rule R's accuracy is 80 % against a threshold of 90 %, and assert the alert fires and the metric matches the hand-computed value.
- **Target:** §3 Observability row; §10; new section "Operational metrics and guardrails".

**QA-AZ-06 [High] The pipeline lacks required test gates.** §10 against `qa-review.md` §6:

| Required | In §10? | Fix |
|---|---|---|
| Decision-table suite (JSON vectors, DT-01…41) | Implicit in "unit" | Name it as a blocking CI gate. Any change to vector files needs a policy-owner review |
| Property tests | Yes (CI) | Fix the seed count (≥ 1,000/property) and keep failing seeds |
| Decision replay | Yes (test) | Define the corpus. When `engineVersion` changes, a replay diff report must be approved |
| Security tests | "security tests" (vague) | List them: gitleaks, the authz matrix test, ZAP baseline DAST against test, IaC scan (Checkov/PSRule for Azure), image scan severity threshold, testssl |
| Accessibility | **Missing** | axe in E2E, blocking on serious/critical |
| Performance | **Missing** | An Azure Load Testing stage with fail criteria (p95, error %) on the perf profile. Mandatory before a prod release that touches the submit path or engine, nightly otherwise |
| Migration rehearsal | **Missing** | See QA-AZ-02 |
| Bicep what-if / drift | **Missing** | `what-if` output attached to the manual gate. Azure Policy compliance must be 100 % |
| Prod smoke criteria | "smoke test" only | Define them: health/ready, authN redirect, a read-only queue query, a revision-label call to `GET /version` returning the expected `engineVersion`/commit. **No synthetic submits in prod**: audit is append-only and the records can't be deleted, and they would distort automation metrics. If a write smoke test is required, use a flagged synthetic branch excluded from all metrics, and get compliance agreement |
| Rollback verification | Assumed | Rehearse every release in test: shift traffic back and rerun the smoke suite on N-1 (needs QA-AZ-02). Note that **worker and jobs have no ingress traffic split**: a new worker revision starts consuming immediately, so either single-revision mode for the worker with a version-tolerant message schema, or deploy the worker after the api is verified |
| SPA/API version skew | **Missing** | Static Web Apps deploys separately from api revisions. Add a compatibility check (SPA reads `/version`, contract tests on the API) |
| Image signature verification at deploy | Signing only | Verify the signature in the pipeline before the revision is created (Container Apps doesn't enforce it natively, as far as QA knows) |
| Manual approval gate criteria | "Manual approval" | Checklist: all gates green, replay diff approved, what-if reviewed. The approver is not the change author |

**Target:** §10 Delivery pipeline diagram and a new "Quality gates" table.

**QA-AZ-07 [High] No DR drill, and DR has no compute.**
- DR is "restore from geo-redundant backup into Canada East". The design has no Canada East Container Apps environment, ACR replica, Key Vault, or Entra redirect URI, and no Front Door origin switch.
- RTO/RPO are TBD (AZ-5). Without a drill, the RTO is unknown.
- **Fix:**
  - Make Bicep region-parameterised and include Canada East.
  - Use ACR geo-replication (Premium) or a re-push step.
  - Run a scripted twice-yearly **restore drill** with measured RTO/RPO and a hash-chain verification against the GRS anchors.
  - Record pass criteria in a runbook.
  - Note that during a primary-region outage, GRS Blob is read-only until failover, so anchor writes fail: alert on it and backfill afterwards.
- **Target:** §10 Resilience targets; §12 AZ-5; new runbook.

**QA-AZ-08 [High] Call-flow step 9 has no failure branch.**
- Step 9 says "check control revision; COMMIT", but there is no alternative path for when the revision changed between steps 5 and 9 (a pause landed mid-evaluation, SEC-19).
- The expected result isn't stated: re-evaluate, or downgrade to `HUMAN_REVIEW/ENGINE_PAUSED`.
- The idempotency-replay path and the DB-unavailable path (503, nothing saved, client retries with the same key) are also missing.
- **Fix:** add `alt` branches with observable results (response code, the stored fallbackCause, a `decision.revisionConflict` counter).
- **Test:** a race test that commits a pause between evaluate and commit, 1,000 iterations, with 0 automated outcomes committed after the pause.
- **Target:** drawio "Call flow" page, step `flow-m20`; §10 Resilience "Pause / kill switch" row.

**QA-AZ-09 [High] No test identity strategy.**
- AZ-6 uses the organisation's production Entra tenant, with Conditional Access MFA and PIM for approver and admin roles. Automated E2E and load tests can't complete interactive MFA or PIM activation.
- Call-flow step 2 implies a **branch** claim, but Entra has no native branch attribute.
- The flow shows a bearer token in the browser (step 3), while the architecture review's ADR-014 specifies a BFF session cookie.
- **Fix:**
  - Use a separate non-prod Entra tenant, or dedicated non-prod app registrations, with test users per role × branch (including multi-role and deactivated users).
  - Scope Conditional Access exclusions to those test users and the non-prod app only. Tokens come from certificate-based credentials held in a test Key Vault.
  - PIM: test elevation once manually per release, and use permanent test-tenant assignments in automation.
  - Define where the branch comes from (Entra group or app-role naming, or a directory extension attribute), with a claim-mapping test.
  - Reconcile bearer token versus BFF.
- **Target:** §3 Identity row; §10 Environments; drawio Call flow steps 2–3; §12 AZ-6.

### Medium

**QA-AZ-10 [Medium] WAF and rate limits will distort load tests.**
- **Fix:** in perf only, add a WAF custom rule that allows the Azure Load Testing VNet-injected engine IPs or a signed header. Separately, run one test **through** the prod-equivalent WAF rules at the expected peak to prove they don't block legitimate traffic. JSON bodies with decimal strings and free-text reasons can trigger OWASP false positives, so run WAF in Prevention mode in test.
- **Target:** §3 Edge row; §10 Environments.

**QA-AZ-11 [Medium] Origin lockdown isn't tested.**
- **Fix:** Container Apps ingress must be internal-only behind the Front Door private link. Add a pipeline probe that the app's FQDN is unreachable from the internet, and an Azure Policy check for it.
- **Target:** §10 pipeline; §11 Network row.

**QA-AZ-12 [Medium] Log sinks can capture PII.**
- **Fix:**
  - Turn off SQL command-text collection in App Insights.
  - Scrub request bodies.
  - Don't put customer fields in Service Bus event payloads (IDs only), so DLQ bodies are safe.
  - Check the WAF log content policy.
  - Add the canary-PII KQL test (NFR-07 row) as a test-env gate.
- **Target:** §3 Observability row.

**QA-AZ-13 [Medium] There's no synthetic data generator, and the test environment can't be reset.**
- **Fix:**
  - Add a seeded generator as a Container Apps job in dev and test, producing requests in every lifecycle state, at volumes scaled to Q9, tagged `synthetic=true`.
  - The append-only audit plus the hash chain plus immutable Blob anchors make environment resets impossible. In dev and test, use *unlocked* time-based immutability with short retention, a per-environment chain genesis, and a migrator-only reset job.
  - Add Azure Policy to deny restoring prod backups outside prod.
- **Target:** §10 Environments; §3 Audit anchoring row.

**QA-AZ-14 [Medium] Retention can't be configured or verified.**
- Flexible Server PITR is ≤ 35 days. A locked WORM period is irreversible.
- **Fix:** don't lock immutability policies until NFR-10 is set. Plan LTR backup or archival export.
- **Target:** §3 Relational database and Audit rows; §12 (new AZ item).

**QA-AZ-15 [Medium] Scale limits aren't specified.**
- **Fix:** set max replicas for api and worker. Enable built-in PgBouncer, and size the pool so that max replicas × pool ≤ 80 % of `max_connections`. Add a load-test assertion.
- **Target:** §5 table, §10.

**QA-AZ-16 [Medium] Alert set is incomplete (NFR-14), and there's no on-call routing.**
- **Add these alerts:**
  - MISSING_DATA and NO_MATCH rate spikes
  - outbox lag (QA-AZ-01)
  - hash-anchor job failure, and hash-chain verification failure
  - automated outcome committed after a pause (must be 0)
  - non-production rule decision in prod (QA-AZ-04)
  - queue-age SLA breach
  - availability-test failure
  - p95 latency SLO burn
  - 409 stale-update rate
  - authZ-denied spike
  - WAF block spike
  - PG failover event
  - Cost Management budget
- **Also define:**
  - action groups and owners
  - expected alert latency (log alerts are evaluated at 1–15 min frequency)
  - an alert-test runbook that fires each alert in test once per release
- **Target:** §3 Observability row; new "Alerts" table in §10.

**QA-AZ-17 [Medium] Telemetry sampling and engine spans aren't defined.**
- App Insights adaptive sampling will drop events, so outcome counts from telemetry would be wrong.
- **Fix:** take business counts from PostgreSQL only. Exclude decision custom events and metrics from sampling. Add spans and attributes for steps 5–8: `policyVersionId`, `controlRevision`, `engineVersion`, `evalDurationMs`, `outcome`, `fallbackCause`. Propagate the W3C trace context through the outbox → Service Bus → worker → Web PubSub, so steps 11–15 are traceable per request.
- **Target:** §3 Observability row; drawio Call flow notes.

**QA-AZ-18 [Medium] No production self-check jobs.**
- **Fix:** add nightly jobs for decision replay (NFR-09), the atomicity reconciliation (NFR-04) and hash-chain verification, each with an alert. The §5 job list currently has only expiry, sampling and anchor.
- **Target:** §5 table `JOB`; drawio `opt2-i15`.

**QA-AZ-19 [Medium] The call flow covers only submit and decide.**
- Escalation, resubmission (re-evaluation, `qa-review.md` A3), pause/resume, the reviewer request for more information, and the scheduled jobs have no flow.
- The decide flow (steps 16–19) also omits the server authZ, reason validation and self-decision checks.
- **Fix:** add these flows with observable results, or reference the sequence diagrams.
- **Target:** drawio Call flow page (new pages).

**QA-AZ-20 [Medium] Web PubSub delivery is unverifiable and group membership is unsafe.**
- Web PubSub has no delivery acknowledgement, and offline users miss pushes.
- Group join tokens must be issued server-side per role and branch, or staff could subscribe to reviewer or other-branch groups.
- **Fix:** keep an in-app notification list read from the DB, with the client refetching on reconnect. Issue group tokens server-side. Add an E2E test that a staff token can't join the reviewer group.
- **Target:** §3 In-app notifications row; drawio steps 14–15.

### Low

**QA-AZ-21 [Low] Chaos Studio coverage isn't stated.**
- **Fix:** list which faults are run (Service Bus and Key Vault access denial, NSG block to PG, PG forced failover via CLI, replica kill), and note that Container Apps zone-down can't be injected.
- **Target:** §10 Resilience.

**QA-AZ-22 [Low] Step 7 takes `time`, but its source isn't stated.**
- **Fix:** take `asOf` from a single clock (DB `now()` at step 5 or the app UTC clock), store it, and include it in replay.
- **Target:** drawio `flow-m18`.

**QA-AZ-23 [Low] Step 10 shows only the 201 response.**
- **Fix:** list 200 (idempotent replay), 422, 403, 409 (key/payload mismatch) and 503.
- **Target:** drawio `flow-m21`.

---

## 3. Call-flow step testability (drawio page "Call flow — submit, notify, decide")

| Step | Observable outcome today? | How to verify | Gap → finding |
|---|---|---|---|
| 1 Sign in (OIDC + PKCE, MFA) | Yes: Entra sign-in logs | E2E with a test tenant | MFA blocks automation → QA-AZ-09 |
| 2 Token with roles, branch | Partly | Decode-token claim test | Branch claim source undefined; bearer vs BFF → QA-AZ-09 |
| 3 POST + Idempotency-Key | Yes: App Insights request | INV-IDEM-1 concurrent test | — |
| 4 WAF, private link | Yes: Front Door/WAF logs | Origin probe, WAF false-positive suite | QA-AZ-10, -11 |
| 5 Read policy + control state | **No** telemetry | Span with policyVersionId, controlRevision | QA-AZ-17 |
| 6 Pinned manifest + revision | **No** | Same span; stored on the decision | QA-AZ-17 |
| 7 evaluate(context, policy, control, time) | **No** (in-process) | Unit/property/decision-table suites; `evalDurationMs` metric | QA-AZ-17, -22 |
| 8 Decision returned | Yes: via the stored decision record | Replay test | — |
| 9 Single transaction + revision check | Success path only | Race test, reconciliation query | **No failure branch** → QA-AZ-08 |
| 10 201 Created | Yes | API contract tests | Error codes missing → QA-AZ-23 |
| 11 Poll outbox (SKIP LOCKED) | Partly (`published_at`) | Outbox-lag metric; duplicate-publish test with 2 workers | Scale-to-zero deadlock → **QA-AZ-01**; lag alert → QA-AZ-16 |
| 12 Publish event | Yes: Service Bus metrics | At-least-once → consumers deduplicate by event ID (test) | — |
| 13 Deliver (retry, DLQ) | Yes: DLQ count | Poison-message test → DLQ alert | — |
| 14 Send to user/group | **No** delivery ack | E2E browser receipt; DB notification list | QA-AZ-20 |
| 15a/15b WebSocket updates | Only in the browser | Playwright E2E with two contexts | QA-AZ-20 |
| 16 POST decision, If-Match | Yes | Contract test | Missing authZ/reason/self-decision checks → QA-AZ-19 |
| 17 Forward | Yes: Front Door logs | — | — |
| 18 UPDATE … WHERE version = n | Yes: rows affected | FR-23/24 concurrency test (N parallel → 1 success) | — |
| 19 200 / 409 | Yes | Contract test | — |

---

## 4. Carry-over from `qa-review.md`

The Azure design doesn't resolve these, and they stay blocking for engine tests:
- H1 paused-rule semantics
- H2 shadow isolation
- A3 resubmission path
- H7 agreement definition (prerequisite for QA-AZ-05)
- the complete permission matrix (H6, needed for the authZ matrix gate)

The architecture review's D6 values (50 ms / 200 ms, no control-state cache, commit-time revision guard) are reflected in the proposal and the call flow. They are testable once QA-AZ-08 and QA-AZ-17 are fixed.
