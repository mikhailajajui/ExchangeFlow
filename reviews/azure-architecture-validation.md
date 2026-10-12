# ExchangeFlow — Validation of the Azure Cloud Architecture Proposal

| | |
|---|---|
| **Validated** | `azure-architecture-proposal.md` (Draft v0.1), `diagrams/azure-architecture.drawio` (4 pages: Option 2, Option 1, Option 3, call flow) |
| **Against** | `reviews/architecture-review.md` (§2 stack, §3 D6 and determinism, F-01, F-06, F-07, F-10, F-13, ADR-006/010/011/014/016/017), `policy-engine-design.md` §4.3 and §5.1, and the session and role rules in `reviews/security-review.md` §3.5 and SEC-18/21/28 |
| **Date** | 2026-10-01 |
| **Method** | Read the proposal in full. Extracted every cell and edge from the draw.io XML. The call-flow page has floating arrows, so I mapped each arrow's endpoint coordinates to the nearest lifeline. Azure service claims were checked against Microsoft documentation found by web search. That search is **background only** and is listed at the end. Anything not confirmed is marked **verify**. |

## Verdict: **Approve with changes**

Option 2 (Container Apps) is the right choice. The comparison is broadly sound and fits the modular monolith, the in-process engine and the single-transaction design. It should not be baselined until the six High findings are fixed:

| # | Must fix | Finding |
|---|---|---|
| 1 | The worker scales to zero, but it is also the only thing that moves outbox rows into Service Bus. At zero replicas, notifications stall forever. | AV-01 |
| 2 | Service Bus "Standard or Premium" conflicts with "private endpoints, no public data plane". Private endpoints are Premium only. | AV-02 |
| 3 | The commit-time control-revision check in step 9 is in the wrong order, has no lock and has no mismatch branch. | AV-03 |
| 4 | Idempotency is sent (step 3) but never checked. Replay and concurrent-duplicate behaviour is undefined. | AV-04 |
| 5 | Browser bearer tokens with roles and branch in claims contradict the BFF/session and app-DB-roles decisions in both earlier reviews. | AV-05 |
| 6 | Replay inputs (context snapshot, hashes, control revision, `asOf`, `engineVersion`) are not persisted, and canary revisions run two engine versions at once. | AV-06 |

Plus AV-07 (High): the pipeline has no schema-migration step, and revision traffic-splitting requires expand/contract migrations.

---

## 1. Does Option 2 satisfy the architecture review?

| Recommendation (source) | Status | Evidence | Gap / finding |
|---|---|---|---|
| Engine in-process, no network hop (review §2, D6) | **Met** | Proposal §1, §2; drawio `opt2-i13`; flow step 7 | — |
| `evaluate` is pure over {context, policy, control, asOf} (review §3 Determinism) | **Met (call shape)** | Flow step 7: `evaluate(context, policy, control, time)` | — |
| Replay inputs persisted (review F-01, ADR-006) | **Not met** | Flow step 9 inserts "request, decision, audit, outbox" only | AV-06 |
| Control state never cached (review D6, ADR-016) | **Met** | Proposal §1 row "Pause"; flow step 5; flow note | Manifest content should be cached (AV-28) |
| Commit-time revision guard (review D6) | **Partial** | Flow step 9 says "check control revision", after the inserts, with no lock and no branch. Proposal text doesn't mention it at all. | AV-03 |
| Decision + state + audit + outbox in one transaction (NFR-04, review F-13) | **Met** | Flow steps 9 and 18; note `flow-n32` | Outbox liveness is broken by scale-to-zero (AV-01) |
| Immutable policy versions (review F-04, ADR-005) | **N/A at platform level** | Application concern; nothing in the proposal contradicts it | Only cache manifests by immutable ID (AV-28) |
| 50 ms soft / 200 ms hard budget (ADR-017) | **Met in principle, unproven** | In-process, always-on replicas | No CPU sizing per replica; Node is single-threaded (AV-19) |
| 2 s p95 (NFR-01) | **Met in principle** | min 2 replicas, same-region DB, no cold start | Failover windows and replica count (AV-08, AV-10) |
| Idempotent submit (review F-07, ADR-011) | **Partial** | Key sent in step 3 | No lookup, replay or unique-violation path (AV-04) |
| Optimistic concurrency, 409 on stale (review F-06, ADR-010) | **Met with a protocol inconsistency** | Steps 16, 18, 19 | `If-Match` with 409 instead of 412 (AV-27); SoD and cycle checks absent (AV-29) |
| OIDC + BFF server session, roles in app DB (review ADR-014/015; security §3.5) | **Not met** | Steps 2–3: browser holds bearer token with roles and branch; proposal §3 "app roles mapped to Entra groups" | AV-05 |
| Insert-only audit + hash chain (review F-10) | **Met, plus WORM anchor** | Proposal §3, §11 | Anchor details (AV-23) |
| Minimal infrastructure: Postgres-backed queue, polling, SPA served by backend (review §2) | **Deliberate deviation, undocumented** | Adds Service Bus, Web PubSub, Static Web Apps | Record as ADRs with justification, or defer (AV-02, AV-15, AV-09) |

---

## 2. Option comparison and Azure service claims

The comparison is **sound in direction**. Option 2 is correctly preferred over VMs (ops burden) and Functions (cold start and Durable dual state). Corrections needed:

| Claim in proposal | Assessment | Fix (file) |
|---|---|---|
| Service Bus "Standard or Premium" with private endpoints (§3, §10) | **Incorrect combination.** Private endpoints are Premium-only (background: MS Learn, Service Bus network security). | AV-02 (proposal §3, §8) |
| Front Door Premium private link to Container Apps (§3, §5, §10) | **Correct, with conditions.** Supported for **workload profiles** environments only. Needs a separate non-delegated subnet for the private endpoint and approval of the private endpoint connection (background: MS Learn). | AV-09 (proposal §5) |
| Container Apps "zone-redundant", api "min 2 replicas" | **Partly wrong.** Microsoft reliability guidance recommends **at least 3** replicas with zone redundancy, and zone placement is best-effort (background). **Verify:** zone redundancy must be chosen at environment creation and needs a VNet-integrated environment. | AV-08 (proposal §5, §10; drawio `opt2-i13`) |
| Container Apps jobs on cron | **Correct.** Jobs support scheduled, event and manual triggers. Manual jobs also suit migrations (AV-07). | — |
| PostgreSQL Flexible Server: zone-redundant HA, PITR, geo-redundant backup | **Correct, but incomplete.** Geo-redundant backup must be enabled **at server creation** (background). **Verify:** geo-restore RPO/RTO figures and whether HA needs General Purpose or Memory Optimized (no Burstable). | AV-10 (proposal §3, §10) |
| "Private endpoints for PostgreSQL" | **Needs a decision.** Flexible Server has two irreversible networking modes. VNet integration (delegated subnet) is one; public-access mode with private endpoint and public access disabled is the other. Private endpoints cannot be added to a VNet-integrated server (background). | AV-10 |
| ACR private endpoint (§5, drawio) | **Correct, Premium SKU required** (background). It is a cost line the proposal doesn't mention. | AV-22 (proposal §8) |
| Web PubSub "or SignalR Service" | **Both viable.** For a Node backend with raw WebSocket clients, Web PubSub is the natural fit. SignalR suits ASP.NET hubs. Front Door now supports WebSockets (GA, background), so WS traffic can go through the WAF edge. **Verify** that a Web PubSub custom domain behind Front Door is supported. | AV-15 |
| Functions Flex Consumption: always-ready, VNet integration (§6) | **Correct.** Note: Flex has **no deployment slots**; it uses rolling updates (background). The §7 table row "Deployment slots (Premium)" is accurate but should add "rolling updates on Flex". Durable on Flex supports only Azure Storage or Durable Task Scheduler backends (background), which adds another store of request state that must sit in-region. | AV-21 (proposal §6, §7) |
| Option 3 "Fits modular monolith: No — requires splitting" | **Overstated.** One function app can host every HTTP function from one codebase and deployable. The real problems are Durable's second state store and cold start. | AV-21 (proposal §7) |
| Option 1: Front Door → Application Gateway → VMs | **Valid, but double L7.** Front Door Premium can private-link to an internal Load Balancer via Private Link Service (**verify** for VMSS). Application Gateway is optional unless the org mandates it. | AV-20 (proposal §4) |
| Canada East as DR target | **Verify AZ support.** Sources conflict on whether Canada East has availability zones. If it doesn't, the DR environment cannot be zone-redundant. The region pair Canada Central ↔ Canada East is correct for geo-backup. | AV-17 (proposal §10) |
| Static Web Apps behind Front Door | **Works, verify the lock-down.** The SWA origin stays publicly reachable unless restricted (Standard plan; check the Front Door ID header or use enterprise-grade edge, **verify**). It also creates a second origin, which complicates same-origin cookie sessions. | AV-09 |
| Built-in PgBouncer (not mentioned) | **Fact:** available on port 6432, **not on Burstable** (background). Relevant to dev/prod parity. | AV-11 |

---

## 3. Findings

### High

**AV-01 (High) — The outbox relay stops when the worker scales to zero.** The worker is KEDA-scaled on **Service Bus queue depth** (§5 table, drawio `opt2-i14`), and proposal §5/§8 say it "can scale to zero". But the worker is also the **only** component that polls the outbox and publishes to Service Bus (flow steps 11–12). With an empty queue the worker scales to zero, so nothing moves new outbox rows, so the queue stays empty: a permanent stall. FR-52 still holds (DB is truth) but FR-50/51 silently die.
**Fix:** split the relay from the consumer.
- (a) `outbox-relay` container app with **min replicas 1**. Alternatively, run the relay loop inside each api replica (already min ≥ 2) using `FOR UPDATE SKIP LOCKED`.
- (b) The `notifier` consumer may scale to zero on queue depth.
- Alternative: a KEDA PostgreSQL scaler on `count(*) WHERE published_at IS NULL` (**verify** Container Apps custom-scaler support and managed-identity auth).
- **Invariant INV-OUT-1:** insert an outbox row with all workers at zero replicas → it is published within N s (N set in the ADR, proposal 10 s).
- *Files:* proposal §5 table and Strengths, §8 "Idle overnight"; drawio `opt2-i14` label plus a new relay box.

**AV-02 (High) — Service Bus tier vs private networking, and whether Service Bus is needed at all.** Proposal §3 says "Standard or Premium" but also "no public data-plane access" and an Azure Policy requiring private endpoints. Standard has no private endpoints, so a Standard deployment either violates the policy or fails to deploy. Premium is a significant fixed monthly cost. The architecture review (§2, ADR-002/013) recommended a Postgres-backed queue (pg-boss) with no broker, because the only consumer today is the same app.
**Fix:** for R1–R3, drop Service Bus. The outbox relay delivers directly to the in-app channel (Web PubSub, or DB rows that clients poll). Add Service Bus **Premium** only when an external integration consumer exists (Q1/D8), via an ADR. If Service Bus is kept now, specify Premium and add it as a cost driver.
- *Files:* proposal §3 Messaging row, §8 Shared row, §10 diagram; drawio `opt2-i18` and edges `opt2-e36`.

**AV-03 (High) — The commit-time control-revision guard is under-specified and in the wrong order (flow step 9).** As drawn: "BEGIN; insert request, decision, audit, outbox; check control revision; COMMIT". There is no lock, so a pause can commit between the check and COMMIT, and there is no branch for a mismatch. The proposal text (§1 "Pause" row, §10 "Pause / kill switch" row) only says "read on every evaluation", which alone does not stop an automated outcome being committed after a pause (architecture review D6).
**Fix (per review ADR-016):**
1. Right after `BEGIN`, run `SELECT control_revision FROM policy_control FOR SHARE` and compare it with the step-6 revision.
2. Pause and resume transactions take `FOR UPDATE` on the same row and increment the revision.
3. On mismatch: `ROLLBACK`, re-read and re-evaluate once. If it mismatches again, persist `HUMAN_REVIEW` / `ENGINE_PAUSED`.
4. Inserts come after the check.
- **INV-PAUSE-1:** pause commits while a submit is between steps 6 and 9 → the stored outcome is not `AUTO_*` under the old revision.
- *Files:* drawio flow step 9 label (split into 9a lock+check, 9b alt branch, 9c inserts), flow note `flow-n32`; proposal §1 Pause row and §10 resilience row.

**AV-04 (High) — Idempotency is sent but never processed.** Step 3 carries `Idempotency-Key`, but no step looks it up. Step 10 always returns `201`.
**Fix (review F-07, security SEC-18):**
1. After `BEGIN` (step 9), insert the request with `UNIQUE(submitter_id, idempotency_key)` and a stored payload hash.
2. On unique violation: `ROLLBACK`, then read the stored response.
3. Same payload hash → return the original body with `200`. Different → `422 IDEMPOTENCY_MISMATCH`.
4. Optional fast path before evaluation (step 4a): look up the key and short-circuit.
This also covers clients retrying after a PostgreSQL HA failover drops the connection mid-commit.
- **INV-IDEM-1:** two concurrent POSTs with the same key → one request row, both responses carry the same ID and outcome.
- *Files:* drawio flow (add 4a and an alt on 9/10); proposal §1 (add an "Idempotent submit" row).

**AV-05 (High) — The authentication model contradicts both earlier reviews.** Flow steps 2–3 have the browser receive "ID + access token (roles, branch)" and call the API with a bearer token. Proposal §3 maps app roles to Entra groups.
- The architecture review (ADR-014) chose a **BFF with an HttpOnly server-side session**.
- The security review §3.5 says "no tokens in local storage" and that "roles come from the application's authorisation store".
- FR-63 requires role changes to be audited **in the application**.
- Per-object SoD (review F-11) needs app data anyway.
- "branch" is not a standard Entra claim.
- Token-held roles go stale until expiry, which conflicts with "revocation within minutes" (security §3.5, SEC-21).
**Fix:**
1. The api performs the OIDC auth-code + PKCE flow as a confidential client. **Verify** whether a federated or managed-identity credential can replace the client secret for this app type; otherwise use a certificate in Key Vault.
2. Session stored in PostgreSQL, `__Host-` cookie, CSRF token.
3. Roles and branch are resolved from the app DB on every request.
4. Entra groups and PIM can feed role assignments via an audited sync. They are a source of provisioning, not the authorisation source of truth.
- *Files:* drawio flow steps 1–3 and 16 (cookie instead of bearer); proposal §3 Identity row, §11 SoD row.

**AV-06 (High) — Replay inputs are not persisted, and canary revisions mix engine versions.** Step 8's output lists "outcome, rule, version, reason", and step 9 stores only request, decision, audit and outbox. NFR-09 and architecture review F-01/ADR-006 require persisting:
- the context snapshot and hash
- the policy version and `policy_hash`
- `control_revision` and paused rule IDs
- `asOf`
- `engineVersion`
- the request revision

Proposal §10 also prescribes revision traffic splitting, so **two engine builds evaluate concurrently** during a canary.
**Fix:** add these fields to step 9. Make `engineVersion` part of the image's build metadata and record it per decision. The test-stage replay suite (proposal §10 pipeline) must replay the stored corpus under the **new** image and block promotion on any unexplained diff.
- *Files:* drawio flow steps 8–9; proposal §1 (add a "Reproducible decisions" row), §10 pipeline TEST box.

**AV-07 (High) — No schema-migration step, and revisions require backward-compatible schema.** The pipeline (§10) deploys a new revision at 0 % traffic while the old revision serves 100 % against the **same** database. Rollback means "shift traffic back", which only works if the schema is still compatible with the old code.
**Fix:**
1. Migrations run as a **Container Apps manual-trigger job** using the `migrator` DB identity (proposal §3 already defines that role), *before* the new revision is created.
2. Use the expand/contract pattern: additive changes ship one release ahead; destructive changes ship one release after.
3. The pipeline fails if a migration is not marked backward-compatible.
4. Audit-table triggers and grants are managed only by migrations.
- *Files:* proposal §10 pipeline mermaid (add "Run migration job" between IMG and DEV/TEST/PROD), §5 table (add a "Migrations" row); drawio `opt2-i15` (add a migrate job).

### Medium

**AV-08 (Medium) — Replica count for zone redundancy.** min 2 with best-effort zone placement can leave both replicas in one zone, and a zone loss leaves one or none until rescheduling. **Fix:** prod api min **3** replicas (background: Microsoft reliability guidance). The relay (AV-01) min 1 in dev/test, 2 in prod. State in the proposal that zone redundancy is fixed at environment creation (**verify**). *Files:* proposal §5 table, §10; drawio `opt2-i13`, flow none.

**AV-09 (Medium) — Front Door origin lock-down and the SPA origin.**
1. Container Apps environment: workload-profiles type, **internal** (no public ingress), a private-endpoint subnet separate from the delegated infrastructure subnet, and Front Door private-endpoint approval automated in IaC (it is a manual approval by default, **verify** whether Bicep can auto-approve).
2. Static Web Apps is a second, publicly reachable origin. Either lock it to Front Door (Standard plan + Front Door ID header check, **verify**) or follow the architecture review and **serve the SPA from the api container**. That gives one origin, simpler cookies and CSRF, one CSP, and one less service.
Recommendation: serve from the api; keep SWA only if CDN caching is shown to matter.
*Files:* proposal §3 Edge row, §5 table "Web client", §10; drawio `opt2-i6`, `opt2-e9`.

**AV-10 (Medium) — PostgreSQL decisions that are irreversible at creation.** The proposal must decide, before the first environment is built:
- (a) **networking mode**: VNet integration vs public-access mode + private endpoint (public access disabled). Recommend the private endpoint mode for uniformity with the other services and Azure Policy "private endpoints required"; **verify** current guidance.
- (b) **geo-redundant backup on**.
- (c) compute tier General Purpose or higher in test and prod (HA and PgBouncer unavailable on Burstable).
- (d) HA failover drops connections. The app must retry idempotently (AV-04), and p95 measurement must exclude or flag failover windows.
*Files:* proposal §3 Relational database row, §10 resilience table.

**AV-11 (Medium) — Connection pooling.** Not addressed. Each replica has a pool, and replicas × pool size must stay under the server's `max_connections`. **Fix:**
- Use built-in PgBouncer (port 6432) in transaction mode. Code must then avoid session state: no session advisory locks (use `pg_advisory_xact_lock`), no `SET` (use `SET LOCAL`), no LISTEN/NOTIFY, and care with named prepared statements.
- Managed-identity tokens expire (about 1 h, **verify**). The pool must fetch tokens per new connection (password callback).
- **Verify** Entra authentication through built-in PgBouncer.
- Dev must use a tier with PgBouncer, or run a PgBouncer sidecar locally, so transaction-mode bugs surface before prod.
*Files:* proposal §3 Relational database row.

**AV-12 (Medium) — Outbound egress.** Not addressed. The app calls Entra (OIDC metadata, JWKS, token endpoint), Web PubSub, Application Insights and ACR. **Fix:** state the egress path:
- NAT Gateway for a stable outbound IP, or UDR → Azure Firewall if the org requires egress inspection (workload profiles environments only, **verify**).
- Private endpoints for ACR and Key Vault. Azure Monitor Private Link Scope for App Insights if required.
*Files:* proposal §3 Networking row, §5 diagram.

**AV-13 (Medium) — Private DNS.** Not addressed, and the most common cause of private-endpoint deployment failure. **Fix:** list the zones the IaC creates and links: `privatelink.postgres.database.azure.com`, `privatelink.vaultcore.azure.net`, `privatelink.servicebus.windows.net` (if kept), `privatelink.blob.core.windows.net`, `privatelink.azurecr.io`, `privatelink.webpubsub.azure.com` (if private), plus the Container Apps environment's private zone for internal ingress. In a hub-and-spoke estate, use Azure DNS Private Resolver or corporate conditional forwarders. *Files:* proposal §3 Networking row.

**AV-14 (Medium) — Outbox semantics across replicas.** `SKIP LOCKED` (step 11) is correct for parallel relays. Still to specify:
- (a) **At-least-once**: publish, then mark published, so a crash between the two re-sends. Set `MessageId = outbox.id` (Service Bus duplicate detection, **verify** tier) and make consumers idempotent.
- (b) **Ordering**: parallel relays can deliver a request's events out of order. Clients must treat a push as an *invalidation hint* and refetch the request, never apply the payload as state.
- (c) Retention and cleanup of published rows.
*Files:* drawio flow steps 11–15 note; proposal §3 Messaging row.

**AV-15 (Medium) — Web PubSub exposure and authorisation.** Browsers connect from branch networks over the internet, so Web PubSub has a public client endpoint outside the WAF unless routed through Front Door (WebSocket GA; **verify** custom-domain support). Specify:
- The api issues client access tokens via a negotiate endpoint, joining only groups the user may see (own user, own branch per FR-62, reviewer queue).
- Disable key-based (local) auth and use Entra for the server SDK.
- Messages carry IDs and codes only, no PII or free text (security SEC-31).
Phasing: polling satisfies R1–R2. Introduce Web PubSub in R3 with FR-50/51, or defer it. *Files:* proposal §3 In-app notifications row; drawio `opt2-i22`, `opt2-e38`.

**AV-16 (Medium) — Secrets and key rotation.** Managed identities cover most of this. Add:
- Disable local or SAS auth on Storage, Service Bus and Web PubSub.
- Key Vault soft delete and purge protection.
- The anchor signing key is a Key Vault **key** used through the `sign` operation (it never leaves the vault). Each anchor records the key version so rotation doesn't break verification.
- OIDC client credential rotation (AV-05) and its owner.
- Front Door managed certificates.
*Files:* proposal §3 Secrets row, §11.

**AV-17 (Medium) — No DR runbook.** §10 says "restore from geo-redundant backup into Canada East". **Fix:** add a runbook outline:
1. Declare the incident.
2. Deploy the Canada East stack from IaC (same modules, region parameter).
3. Geo-restore PostgreSQL (new server name, so update config).
4. Re-point the Front Door origin.
5. Re-publish unpublished outbox rows (idempotent consumers).
6. Verify the audit hash chain against the last WORM anchor.
7. Communicate.
Also: confirm whether Canada East has AZs (**verify**), test DR at least annually, and set RTO/RPO (AZ-5). *Files:* proposal §10 resilience table, new subsection.

**AV-18 (Medium) — Environment parity.** test "production-like topology" is good. Make explicit that test includes private endpoints, internal environment + Front Door private link, PgBouncer and Entra auth. Those are the prod-only failure modes. dev may use public endpoints with IP restriction. *Files:* proposal §10 Environments table.

**AV-19 (Medium) — CPU sizing for the engine budget.** Evaluation blocks the Node event loop. **Fix:** at least 1 vCPU per api replica; load test in test to confirm the evaluation p99 stays under the 50 ms soft budget at expected concurrency (NFR-01, Q9). Autoscale on concurrent requests, not CPU only. *Files:* proposal §5 table.

**AV-22 (Medium) — Fixed costs from private networking.** Private endpoints force Premium tiers on Service Bus and ACR (both confirmed, background), plus Front Door Premium. For a low-volume pilot, the shared foundation will likely cost more than compute. The relative-cost table should say so. *Files:* proposal §8.

**AV-29 (Medium) — The decision step omits server-side checks.** Step 18 shows only the version check. Add:
- the authorization and SoD check (reviewer ≠ submitter, review F-11, security A9)
- the `UNIQUE(request_id, cycle)` backstop (review F-06)
- the audit write through the `audit_writer` role (security §3.3)
- context built server-side on submit (SEC-28)
*Files:* drawio flow step 18; proposal §11.

### Low

**AV-20 (Low)** — Option 1: Application Gateway behind Front Door is optional (see §2). Say why it's kept (org mandate, WAF at the regional tier) or drop it. *Files:* proposal §4; drawio `opt1-i12`.

**AV-21 (Low)** — Option 3 text: add "Flex: no deployment slots, rolling updates" and "Durable state in Azure Storage, in-region". Soften "requires splitting". Also, the §6 mermaid draws `ORCH --> PG`, but Durable orchestrators must be deterministic and do I/O only via activity functions. Draw an activity. *Files:* proposal §6, §7.

**AV-23 (Low)** — Audit anchoring: daily leaves up to a 24 h window where tampering is undetected. Consider hourly. Each anchor should contain `{last_seq, last_hash, count, key_version, signature}`. The job identity gets write but not delete (immutability enforces this). Test with an **unlocked** policy in dev, because locked time-based retention is irreversible. *Files:* proposal §3 Audit anchoring row.

**AV-24 (Low)** — Scheduled jobs: expiry and cancel sweeps must go through workflow commands (version check plus audit), not raw `UPDATE`. Set parallelism 1 and guard against overlapping runs with `pg_advisory_xact_lock`. *Files:* proposal §5 table.

**AV-25 (Low)** — IaC layout is not specified. Proposal:

```text
infra/
  main.bicep                 # per-environment composition
  env/{dev,test,prod}.bicepparam
  modules/
    network/   (vnet, subnets, nsg, nat-gateway, private-dns-zones + links)
    security/  (key-vault, user-assigned identities, role-assignments)
    data/      (postgres-flex, storage-immutable, servicebus[optional])
    app/       (aca-environment, api, outbox-relay, notifier, jobs: migrate|expiry|sampling|anchor)
    edge/      (front-door, waf-policy, private-link approval)
    observability/ (log-analytics, app-insights, alerts, action-groups)
    governance/ (policy assignments: allowed regions, PE required; budgets)
```

Prefer Azure Verified Modules where they exist (**verify** coverage). *Files:* proposal §3 IaC row or a new §10 subsection.

**AV-26 (Low)** — In the call flow, the step 10 and step 19 responses are drawn api → browser, bypassing Front Door. Cosmetic. Route them back via Front Door. *Files:* drawio `flow-m21`, `flow-m31`.

**AV-27 (Low)** — Step 16 uses `If-Match` but step 19 returns `409`. Under HTTP semantics (RFC 9110), a failed `If-Match` is `412 Precondition Failed`. Either use `If-Match`/ETag with 412, or `expectedVersion` in the body with `409 STALE_REQUEST` (architecture review F-06/F-22). Pick one. **Recommend the body + 409** for consistency with the other commands. *Files:* drawio `flow-m28`, `flow-m31`.

**AV-28 (Low)** — Step 5 reads the "active policy version" every request. Only the pointer and control row should be read per evaluation. The manifest content is cached in-process by its immutable ID (review D6). *Files:* drawio `flow-m16`/`flow-m17` labels.

---

## 4. Call-flow page review (19 steps)

| Step | Verdict | Note |
|---|---|---|
| 1–2 | Change | Use BFF session, not browser tokens (AV-05) |
| 3 | OK | Idempotency-Key present; cookie instead of bearer (AV-05) |
| 4 | OK | Private link; add the internal-environment condition (AV-09) |
| — | **Missing** | Server-side context build from session + validated body (SEC-28); idempotency fast path (AV-04) |
| 5–6 | OK | Pointer + control read per evaluation; manifest from cache (AV-28) |
| 7–8 | OK / extend | Output must include hashes, control revision, `engineVersion` (AV-06) |
| 9 | **Wrong order, incomplete** | Lock + revision check first, alt branch, snapshot fields, unique key (AV-03, AV-04, AV-06) |
| 10 | Change | 201 new / 200 replay / 422 mismatch (AV-04) |
| 11–15 | Change | Relay liveness (AV-01); at-least-once and ordering (AV-14); Service Bus optional (AV-02) |
| 16–17 | Change | Cookie + CSRF; `expectedVersion` (AV-27) |
| 18 | Incomplete | AuthZ/SoD, cycle uniqueness, audit role (AV-29) |
| 19 | OK / align | 409 `STALE_REQUEST` with current state (AV-27) |

Consistency with `policy-engine-design.md` §5.1: the order (evaluate, then one transaction, then notify) matches, and the notification is correctly decoupled through the outbox, which is an improvement on §5.1's direct call. Note that `policy-engine-design.md` §4.3 has the missing-data ordering defect raised in architecture review F-02. The call flow inherits nothing from it, but the engine implementation must not.

Corrected submit sequence (replacing steps 1–10):

```mermaid
sequenceDiagram
    actor Staff as Staff browser
    participant FD as Front Door + WAF
    participant API as api (BFF + workflow)
    participant PE as policy-core (in-process)
    participant DB as PostgreSQL
    Staff->>FD: POST /requests (session cookie, CSRF, Idempotency-Key)
    FD->>API: forward over private link
    API->>API: authN session, roles+branch from DB, validate body
    API->>DB: lookup (submitter, key)
    alt key exists
        API-->>Staff: 200 stored response, or 422 IDEMPOTENCY_MISMATCH
    end
    API->>API: build context server-side, asOf = clock.now()
    API->>DB: read current policy pointer + control row (no cache)
    API->>PE: evaluate(context, policy[cached by id], control, asOf)
    PE-->>API: Decision (+ policyHash, controlRevision, engineVersion)
    API->>DB: BEGIN; SELECT control_revision FROM policy_control FOR SHARE
    alt revision changed
        API->>DB: ROLLBACK, re-evaluate once, else HUMAN_REVIEW / ENGINE_PAUSED
    end
    API->>DB: INSERT request (unique key), revision, decision_record(snapshot), audit (audit_writer), outbox; COMMIT
    alt unique violation on key
        API->>DB: read stored response
    end
    API-->>FD: 201 Created (id, status, version, outcome, reason)
    FD-->>Staff: 201
```

---

## 5. Diagram vs document consistency

| # | Inconsistency | Fix (file) |
|---|---|---|
| C1 | Proposal §2 puts expiry, sampling and anchoring in the **worker**; §5 and drawio `opt2-i15` put them in **jobs**. | Align §2 to jobs (proposal §2). |
| C2 | Proposal §3 lists private endpoints for PostgreSQL, Key Vault, Service Bus and Storage; §5 and drawio `opt2-i20` add ACR. | Add ACR, and Web PubSub if made private (proposal §3). |
| C3 | Drawio Option 2: the Key Vault edge `opt2-e34` labels "signing key" from **api**, but the anchor job signs. No job → Key Vault edge. | Move the signing-key edge to jobs (drawio). |
| C4 | Drawio Option 2: ACR image-pull edge only to jobs (`opt2-e41`); none to api or worker. Proposal §5 shows ACR → whole environment. | Draw ACR → environment boundary (drawio). |
| C5 | Proposal §5 says "worker can scale to zero"; the call flow relies on the worker polling the outbox. | AV-01 (both). |
| C6 | Proposal §3 Service Bus "Standard or Premium" vs Azure Policy "private endpoints required" (§3 Security posture). | AV-02 (proposal). |
| C7 | Flow step 2 and proposal §3 put roles in tokens and Entra groups; earlier reviews put roles in the app DB. | AV-05 (both). |
| C8 | Proposal §6 mermaid `ORCH --> PG`; drawio Option 3 has no orchestrator → DB edge, but shows submit and decision functions → PG. Drawio is closer to correct. | AV-21 (proposal §6). |
| C9 | Drawio note `flow-n32` says "Pause state read every evaluation (step 5), never cached" but omits the commit-time guard. | AV-03 (drawio). |
| C10 | Proposal §1 says the security review recommends "group-based roles", but security review §3.2 says roles come from the app authorisation store or signed claims verified every request. | Reword proposal §1 Identity row. |

---

## 6. Proposed ADRs arising from this validation

| ADR | Proposed decision |
|---|---|
| ADR-AZ-1 | Hosting: Azure Container Apps (workload profiles, internal, zone-redundant) in Canada Central; api min 3 replicas in prod. |
| ADR-AZ-2 | Messaging: transactional outbox with an always-on relay; no Service Bus until an external consumer exists, then Premium. |
| ADR-AZ-3 | Web client served by the api container behind Front Door; Static Web Apps not used. |
| ADR-AZ-4 | PostgreSQL Flexible Server, General Purpose+, private endpoint mode, zone-redundant HA, geo-redundant backup, built-in PgBouncer (transaction mode). |
| ADR-AZ-5 | Authentication: BFF server-side session in the api; Entra ID as IdP; roles and branch from the app DB, with Entra groups as an audited provisioning feed. |
| ADR-AZ-6 | Schema migrations: expand/contract, executed by a Container Apps manual job with the migrator identity before revision rollout. |
| ADR-AZ-7 | In-app notifications: polling in R1–R2; Web PubSub (Entra auth, negotiate endpoint, hint-only payloads) from R3. |
| ADR-AZ-8 | DR: IaC-redeployable Canada East stack, geo-restore runbook, annual test; RTO/RPO per AZ-5. |

---

## Background sources (web research — background only; does not override project documents)

- [Use Azure Front Door Premium with a custom virtual network and Private Link in Azure Container Apps](https://learn.microsoft.com/en-us/azure/container-apps/front-door-custom-virtual-network-private-link)
- [Network security for Azure Service Bus](https://learn.microsoft.com/en-us/azure/service-bus-messaging/network-security)
- [Reliability in Azure Container Apps](https://learn.microsoft.com/en-us/azure/reliability/reliability-container-apps)
- [PSRule Azure.ContainerApp.MinReplicas](https://azure.github.io/PSRule.Rules.Azure/en/rules/Azure.ContainerApp.MinReplicas/)
- [Azure Functions Flex Consumption plan hosting](https://learn.microsoft.com/en-us/azure/azure-functions/flex-consumption-plan)
- [PgBouncer in Azure Database for PostgreSQL Flexible Server](https://learn.microsoft.com/en-us/azure/postgresql/connectivity/concepts-pgbouncer)
- [Backup and restore in Azure Database for PostgreSQL Flexible Server](https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore)
- [Networking with Private Link — Azure Database for PostgreSQL Flexible Server](https://learn.microsoft.com/en-us/azure/postgresql/network/concepts-networking-private-link)
- [Azure Front Door WebSocket](https://learn.microsoft.com/en-us/azure/frontdoor/standard-premium/websocket)
- [Azure Container Registry SKU features and limits](https://learn.microsoft.com/en-us/azure/container-registry/container-registry-skus)
- [Configure a CDN for Azure Static Web Apps (Front Door manual)](https://learn.microsoft.com/en-us/azure/static-web-apps/front-door-manual)
- [Azure Availability Zones launch in Canada](https://news.microsoft.com/en-ca/2020/09/22/azure-availability-zones-launch-in-canada-offering-canadian-customers-additional-capabilities-to-innovate-with-data-and-the-cloud/) (Canada East AZ status unresolved, so verify)
