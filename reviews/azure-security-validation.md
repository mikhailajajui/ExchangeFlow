# Azure Architecture Security Validation

**Reviewed:** `azure-architecture-proposal.md` (esp. §3, §10, §11) and `diagrams/azure-architecture.drawio` (4 pages, incl. 19-step call flow), against `reviews/security-review.md`.
**Date:** 2026-10-01. Advisory; compliance items to confirm with compliance, not legal advice.

## Verdict: APPROVE WITH CHANGES

Option 2 (Container Apps) is a sound hosting choice and the security posture of the platform layer is good in intent (private endpoints, managed identity, Entra, WORM anchor, commit-time control-revision check in step 9). However, the proposal only maps about 6 of the 20 High findings. Governance-type controls (SEC-04, 05, 06, 08, 13, 14, 15, 17, 22, 23, 24) are not mentioned at all, and several Azure controls are stated at a level where the insecure default is still possible (Key Vault model, Web PubSub groups, immutability policy lock, signature verification, federated credential scope, token handling in the SPA). Fix the items marked High below before R1 build starts (for platform items) or before any rule goes ACTIVE (for governance items).

Severity: High = fix before real data / any ACTIVE rule; Medium = before pilot; Low = before production or accept explicitly. "Target file" = where the fix should be documented (P = `azure-architecture-proposal.md`, D = `diagrams/azure-architecture.drawio`, with page).

---

## 1. Mapping of High SEC items to Azure controls

| SEC | Requirement (short) | Azure design says | Status | Gap / fix | Target |
|---|---|---|---|---|---|
| 01 | Role-conflict matrix enforced server-side | Entra app roles, groups, PIM, "server-side role-conflict checks" (§11) | **Partial** | Stated, but Entra is the role source while the app DB holds the conflict rules; Entra admins/group owners can add conflicting memberships outside the app. Make the app DB the authoritative role store (or reconcile on every login and deny/alert on conflicting claims). Block conflicting PIM eligibilities via Entra access packages with incompatible-access rules. See F-ID-03. | P §3, §11 |
| 02 | Two-person role grants, step-up, alert | Not mentioned (PIM covers approver/admin elevation only) | **Not covered** | Role grants happen in Entra groups. Require access packages with approver, access reviews quarterly, alert on group/app-role assignment changes into Sentinel. | P §3, §11 |
| 03 | Approve vs activate by different people; two-person activation | PIM "for approver and admin" | **Partial** | PIM is time-bound elevation, not per-rule two-person approval. Keep it as an app-level workflow; PIM does not substitute. State that explicitly. | P §11 |
| 04 | System-derived regulated classification | Not mentioned | **Not covered** (app logic) | Add to §11 as "application-enforced controls not provided by Azure" with a link to SEC list. | P §11 |
| 05 | Rule schema forbids identity fields, specificity test | Not mentioned | **Not covered** (app logic) | Same. | P §11 |
| 06 | Compliance-owned guardrail policy | Not mentioned | **Not covered** | Same; store in DB table writable only through a stored procedure by a compliance role. | P §11 |
| 08 | Content-hash approvals, immutable versions | Not mentioned | **Not covered** | Same; implement with DB constraints and stored procedure. | P §11 |
| 10 | Audit protected below app layer | Role without UPDATE/DELETE, hash chain, daily anchor to immutable Blob | **Partial** | Good start. Gaps: daily anchoring (tail deletion undetected up to 24 h), unlocked immutability policy, signing key access, DB admin path, anchor store in same subscription. See F-AU-01 to 05. | P §3, §11; D page 1 |
| 11 | Rich audit event + stored inputs | Not mentioned; step 9 inserts "audit" only | **Not covered** | Specify event schema and stored EvaluationContext snapshot/hash in flow step 9. | P §3; D flow page |
| 12 | Branch scoping at data layer | Not mentioned. Token carries "branch" (step 2) | **Not covered** | Enforce via server-side filter or PostgreSQL row-level security keyed to DB user directory; do not trust the token claim alone. F-FL-02. | P §11; D flow |
| 13 | Pause only toward human | Pause "stored in PostgreSQL, read every evaluation"; control revision checked at commit | **Partial** | Persistence and freshness are covered. Monotonic semantics and who may pause are not. Add as app control. | P §10, §11 |
| 14 | Pseudonymous customer key (HMAC in KMS) | Not mentioned | **Not covered** | Use a dedicated Key Vault HMAC key, separate identity, no export. | P §3 |
| 15 | Atomic velocity counters | Step 9 transaction, no counters | **Not covered** | Add counter update to step 9 under row lock. | D flow |
| 17 | Completed reconciliation | Not mentioned | **Not covered** (app logic) | Add. | P §11 |
| 18 | Immutable request fields, idempotency scope, nonce | Idempotency-Key (step 3), If-Match (step 16) | **Partial** | Key scope (user+endpoint+payload hash) and decision-endpoint idempotency not shown. | D flow |
| 19 | Pause checked at commit | Step 9 "check control revision" | **Covered (verify lock)** | Must be done with a lock/serialisable read, else TOCTOU. F-FL-03. | D flow |
| 21 | SSO, MFA, step-up, session revocation | Entra, Conditional Access, sign-in risk | **Partial** | No step-up (CA authentication context), no phishing-resistant strength, no CAE/session revocation, no guest/legacy-auth block. F-ID-01, 02, 04. | P §3, §11 |
| 23 | No rule files / placeholder in prod | "Demo placeholders allowed in test, never in prod" (§10) | **Partial** | A statement, not a control. Need image build without rule files, startup assertion on environment flag, DB write path to rules via stored procedure only, and CI check. F-CI-04. | P §10; D page 1 |
| 24 | XSS/CSRF/CSP | Front Door WAF only | **Not covered** | WAF is not a CSP. Set CSP and headers at Front Door rules engine and SWA config; decide token storage model (F-FL-01). | P §3, §11 |
| 28 | Server-built context | Step 7 `evaluate(context…)` | **Partial** | Add that branch/user/role/time come from session + DB directory; request DTO allow-list. | D flow |

Summary: 1 covered (with caveat), 9 partial, 10 not covered. The "not covered" ones are mostly application logic; the proposal should say so and cross-reference rather than let §11 imply completeness.

---

## 2. Azure-specific threats and findings

### 2.1 Identity

| ID | Sev | Finding | Fix | Target |
|---|---|---|---|---|
| F-ID-01 | High | Token validation not specified. Risks: wrong audience (accepting Graph/other-app tokens), multi-tenant issuer acceptance, v1/v2 mix-up, unvalidated `tid`, roles taken from tokens signed for another app. | API validates issuer (single tenant), `aud` = API app ID URI, signature, `exp`, `scp`/`roles`. Register API and SPA as separate app registrations; `accessTokenAcceptedVersion=2`; single-tenant; reject ID tokens as bearer. Exact redirect URIs only, no implicit flow, PKCE (already in step 1). | P §3 Identity row |
| F-ID-02 | High | Conditional Access listed as "MFA" only. Missing: phishing-resistant authentication strength (FIDO2/WebAuthn) for reviewer/policy/compliance/admin; step-up via **authentication context** for approve/activate/pause-resume/role changes (SEC-21); compliant/managed device; block legacy auth; sign-in frequency; token protection; Continuous Access Evaluation for fast revocation; named locations for branch networks. | Add a CA policy table to §3; app must demand the `acrs` claim on privileged endpoints and re-challenge. | P §3, §11 |
| F-ID-03 | High | **App role assignment abuse.** Roles come from Entra groups/app roles; anyone with Entra "Application Administrator", "Groups Administrator", group owner or user-assignment rights on the enterprise app can grant roles outside the app's SoD and two-person flow (SEC-02, A9). Org-wide existing tenant (AZ-6) increases the admin population. | Enterprise app: "Assignment required = Yes"; roles assigned only to role-assignable groups managed via Entitlement Management with approvers and incompatible-access rules; named group owners; quarterly access reviews; alert (Sentinel) on any change to app role assignments, group membership, app registration credentials/redirect URIs; limit Entra admin roles via PIM. Application keeps its own conflict check on every request. | P §3, §11 |
| F-ID-04 | Medium | **Guest/B2B users** not addressed. | Block guests via CA and `Assignment required`; app rejects `idtyp`/`#EXT#` accounts; alert on guest invitations. | P §3 |
| F-ID-05 | Medium | Group overage (more than 200 groups): token omits groups, apps often fall back to Graph or fail open. | Use app roles (not group claims) in tokens, deny when role claim absent; no fail-open fallback. | P §3 |
| F-ID-06 | Medium | Token carries "branch" (step 2). Stale after transfer; claims editable by directory admins. | Resolve branch scope from the application's user directory table on each request. | D flow step 2 |
| F-ID-07 | High | **Break-glass accounts not defined.** CA misconfiguration or Entra outage can lock out the kill switch. | Two cloud-only emergency accounts, FIDO2, excluded from CA but monitored with alerts on any sign-in, credentials in sealed storage, tested semiannually. The kill switch must also be reachable via a documented DB/ops procedure that is itself audited. | P §3, new §14 |

### 2.2 Managed identities and Key Vault

| ID | Sev | Finding | Fix | Target |
|---|---|---|---|---|
| F-MI-01 | High | Single "managed identity" wording. API, worker, jobs, and CI need different privileges. A shared identity gives the API Blob write and signing rights, defeating audit separation. | Separate **user-assigned identity per workload**: api (PG app role, KV none or HMAC-sign only, Service Bus none), worker (PG outbox role, SB Data Sender, WebPubSub Service Owner for server operations only), anchor job (PG read audit, KV `sign` on one key, Blob Data Contributor on anchor container but no delete), reporting (PG read-only). No Owner/Contributor at any data scope. Document in a role-assignment table. | P §3 |
| F-MI-02 | High | Key Vault access model unspecified; diagram shows API reading "secrets / signing key". | Azure RBAC authorisation (not access policies), soft delete and **purge protection**, public network disabled, private endpoint, firewall off. Signing key as **non-exportable key (Premium/HSM-backed)** with `sign` operation only; no secret export; only the anchor job identity gets Key Vault Crypto User on that key. API never holds it. Use a separate key for pseudonymisation HMAC (SEC-14). Verification public keys retained across rotations. Key Vault diagnostic logs to the security workspace; alert on key operations outside the job. | P §3, §11; D page 1 |
| F-MI-03 | Medium | Passwords/connection strings may still exist ("any remaining secrets"). | Entra authentication for PostgreSQL (disable password auth), Service Bus and Web PubSub local auth disabled, Storage shared key disabled, App Insights local auth disabled. Enforce via Azure Policy (deny). | P §3 |
| F-MI-04 | Medium | Key rotation absent. | Rotation schedule: signing key versions annually with overlap; CMK (if adopted) auto-rotate; client secrets none. | P §3 |

### 2.3 Network exposure

| ID | Sev | Finding | Fix | Target |
|---|---|---|---|---|
| F-NW-01 | High | **Front Door private link and origin bypass.** The origin must not be reachable except via Front Door; Static Web Apps (React client) is shown behind Front Door but is publicly reachable by default and bypasses WAF/headers. | Container Apps environment with internal ingress only and public network access disabled; private link approved only for the Front Door profile; API also validates `X-Azure-FDID`. For SWA: use Standard plan with private endpoint/IP restriction, or host the SPA in Storage static site behind Front Door private link. Confirm Front Door Premium Private Link to Container Apps is GA for the chosen configuration. | P §3, §10; D page 1 |
| F-NW-02 | High | "Public network access" settings not stated per service. Private endpoints alone do not disable the public endpoint. | Explicitly set `publicNetworkAccess=Disabled` on PostgreSQL, Key Vault, Service Bus, Storage, ACR, App Insights/Log Analytics (ingestion via Private Link Scope), and enforce with Azure Policy deny. Private DNS zones linked to the VNet. | P §3 |
| F-NW-03 | Medium | **Web PubSub is public** by necessity (browser WebSocket) while the rest is private; worker egress path also undefined. No egress control: a compromised container can exfiltrate to the internet. | Restrict worker to Web PubSub via private endpoint (server side); client side stays public with short-lived tokens (F-WS-01). Add egress control (Azure Firewall or NAT gateway with FQDN allow-list / UDR) for the Container Apps environment. | P §3; D page 1 |
| F-NW-04 | Medium | Database admin access path undefined. | No public path. Admin via PIM-eligible Entra DB admin, from Bastion/jump host in VNet; time-boxed, session-logged; no standing admin; pgaudit to separate security workspace. | P §3 |
| F-NW-05 | Low | DDoS. | Front Door has platform L3/4 protection; DDoS Protection plan unnecessary if no public IPs in the VNet. State this and keep Web PubSub rate limits. | P §3 |

### 2.4 Web PubSub (in-app notifications)

| ID | Sev | Finding | Fix | Target |
|---|---|---|---|---|
| F-WS-01 | High | **Can a staff user subscribe to a reviewer group?** Not specified. If the API issues a client access URL with broad `joinLeaveGroup` roles, or the client can call `joinGroup`, a staff user can listen to reviewer or other-branch traffic (A10, SEC-12). | The API (not the client) mints client tokens with **no `joinLeaveGroup` role** (or only a role scoped to that user's own group name) and the **server adds connections to groups** after checking current DB roles and branch. Group names: `user:<id>`, `branch:<id>`, `reviewq:<queue>`; no wildcards. Disallow client-to-client publish (`sendToGroup` removed). Token lifetime minutes; on role change or deprovisioning, server calls close/remove user. Payload carries IDs and status codes only; client refetches over the authorised API. Disable access keys (Entra only on server side). | P §3, §10; D flow steps 14-15 |
| F-WS-02 | Medium | Notifications are pushed after commit; replay or spoof of push events could trigger UI phishing. | Messages treated as hints only; UI re-reads state. | D flow |

### 2.5 Service Bus

| ID | Sev | Finding | Fix | Target |
|---|---|---|---|---|
| F-SB-01 | Medium | Message tampering/spoofing: with SAS keys any holder can send. | Disable SAS (local auth); RBAC per entity: worker sends, consumers receive; messages contain IDs, event type, outbox ID only (never PII/free text); consumers re-read DB state and ignore anything inconsistent. Optionally HMAC the envelope. | P §3 |
| F-SB-02 | Medium | Poison messages and DLQ: unlimited retries cause storms; DLQ holds sensitive content and is readable by ops. | Max delivery count, exponential backoff, DLQ alerting (already NFR-14), DLQ access limited, idempotent consumers keyed by `MessageId` = outbox ID, duplicate detection on. Premium tier for private endpoint (Standard does not support private endpoints; the proposal says "Standard or Premium"). | P §3 |

### 2.6 Container Registry, images and CI/CD

| ID | Sev | Finding | Fix | Target |
|---|---|---|---|---|
| F-CI-01 | High | **"Images signed in CI" but nothing verifies signatures at deploy.** Container Apps has no native admission control; signing without verification is ineffective. | Sign with Notation or cosign (keys in Key Vault); verify in the deployment pipeline before creating a revision; deploy by **digest**, never tag; ACR immutability of tags where available; only the pipeline identity can push. | P §5, §10; D pipeline |
| F-CI-02 | High | **Federated credential scope.** "OIDC federated credentials" with a broad subject (any branch/PR) lets any workflow run deploy to prod; pipeline identity with Contributor or User Access Administrator is an escalation path. | One identity per environment; subject restricted to `repo:<org>/<repo>:environment:prod` with GitHub environment protection (required reviewers who are not the committer, branch restriction to protected main); no pull-request subjects in prod; scope RBAC to the resource group; pipeline identity has no data-plane rights (no DB, no Key Vault secrets) and cannot assign roles (role assignments done by a separate privileged, PIM-gated process). Azure DevOps equivalent: workload identity service connection with approvals and checks. | P §3, §10 |
| F-CI-03 | Medium | ACR hardening. | Premium SKU (private endpoint), admin user and anonymous pull disabled, `AcrPull` to runtime identities only, `AcrPush` to the pipeline only, Defender for Containers scanning, retention for untagged, base images pinned and rebuilt on schedule. | P §3, §5 |
| F-CI-04 | High | Config-file rule bypass (SEC-23) is not controlled in the pipeline. Test environment "allows placeholder auto-decisions" with presumably the same image. | Prod image contains no rule files; engine loads rules only from DB rules table; startup check refuses placeholder IDs in prod; DB write to rule tables only via stored procedure invoked by the admin API (revoke direct DML from app role); CI test T-PE-07/13. | P §10; D pipeline |
| F-CI-05 | Medium | Manual approval gate has no SoD. | Gate approver is not the author of the changes in the release; record in audit; separate prod deploy approvers; branch protection and CODEOWNERS on engine, auth and audit modules. | D pipeline |
| F-CI-06 | Medium | IaC scanning listed; no policy as code gate. | Run Checkov/PSRule/`bicep` linting against the Azure Policy baseline; fail on public access, local auth, missing diagnostics. | P §3 |

### 2.7 Audit store (Blob + PostgreSQL)

| ID | Sev | Finding | Fix | Target |
|---|---|---|---|---|
| F-AU-01 | High | **Immutability policy lock.** "Time-based retention" in unlocked state can be shortened or removed by a storage admin; the text "can't be altered even by admins" is only true once the policy is **locked** (and on a container with version-level or container-level WORM). | Lock the policy in production after testing; retention at least the compliance retention (to confirm); legal hold supported; disable shared key and SAS; enable versioning and soft delete; resource lock on the storage account; Defender for Storage. Document that unlocked is allowed only in dev/test. | P §3, §11 |
| F-AU-02 | High | **Same trust domain.** Anchor store lives in the same production subscription as the app; a subscription Owner can delete the storage account (WORM prevents blob deletion, not account deletion, if no resources inside... deletion is blocked while locked policies exist, but subscription-level compromise still threatens diagnostics, keys and the chain). | Anchor storage account in a **separate subscription/management group with different administrators**; deny delete via Azure Policy and locks; GRS/RA-GRS replica to Canada East already planned. Verification job runs from a separate identity and tenant context if feasible. | P §3, §10 |
| F-AU-03 | High | **Daily anchor** leaves up to 24 hours of tail truncation or rewrite undetected. Security review proposed minutes. | Anchor every few minutes (job or worker) or every N events; verify chain on schedule and on restore. | P §3; D page 1 jobs |
| F-AU-04 | High | **DB admin can bypass REVOKE/triggers.** PostgreSQL Flexible Server admin (and table owner) can alter or disable triggers on the app's tables. Hash chain without a key outside the DBA's reach can be recomputed. | Hash chain HMAC key in Key Vault (sign operation via anchor job), so a DBA cannot forge a valid signed chain; admins are PIM-eligible only (F-NW-04); pgaudit and Azure activity logs to an immutable, separate workspace; separate owner role for audit schema, with app role INSERT only; migrations run by a dedicated role, tracked. | P §3, §11 |
| F-AU-05 | Medium | Chain head concurrency: a single global chain serialises step 9 and 18 transactions. | Per-aggregate streams (per request, per rule) with a global periodic Merkle checkpoint; advisory lock only within the stream. | D flow step 9 |
| F-AU-06 | Medium | Backups: PITR and geo-redundant backups are platform-managed; a restored copy can be altered silently, and backup encryption defaults to Microsoft-managed keys. | Decide on CMK for PostgreSQL and Storage (Key Vault, purge protection, rotation) based on compliance; verify chain against anchors after every restore drill; restrict who can restore/delete servers (resource lock, PIM). | P §3, §10 |

### 2.8 Logging and monitoring

| ID | Sev | Finding | Fix | Target |
|---|---|---|---|---|
| F-LG-01 | High | **PII in Application Insights.** Auto-collection records URLs, exception messages, request/dependency data, possibly SQL text and headers; free-text reasons can be captured. NFR-07 is a statement only. | Disable SQL text/parameter capture and request body capture; telemetry initializer/processor allow-list; strip query strings; mask user identifiers (use opaque ID); do not sample security/audit events; exceptions sanitised; workspace RBAC with table-level access; diagnostic settings reviewed; retention set deliberately; log-scan tests T-WB-04 run against App Insights. Use Entra auth for ingestion and a Private Link scope. | P §3; D page 1 |
| F-LG-02 | Medium | "Optional" Sentinel. SEC-37 alerts (rule activation, pause/resume, role grants, repeated author/approver pairs, chain verification failure) require SIEM-grade detection; the app audit events must be ingested. | Make SIEM integration (Sentinel or existing) **required before R3**; ingest Entra sign-in/audit logs, Azure Activity, Key Vault, Storage, PostgreSQL, app security log. Provide analytic rules list. | P §11, AZ-7 |
| F-LG-03 | Medium | Application audit and operational logs mixed in one workspace. | Separate security workspace with restricted access and immutable/long retention, distinct from engineering workspace. | P §3 |

---

## 3. Missing controls

| ID | Sev | Missing control | Fix | Target |
|---|---|---|---|---|
| F-MC-01 | High | **Azure Policy baseline is a one-line mention.** | Define the initiative: deny public network access; deny local auth/shared key/access policies on KV; allowed locations; require private endpoints; require diagnostics (DeployIfNotExists); deny public IPs in the VNet; deny Owner/User Access Admin assignments at prod scope except PIM; require tags, TLS 1.2+, HTTPS only; deny non-ACR images for Container Apps (audit). Assign at management group so prod cannot opt out. | P §3 |
| F-MC-02 | Medium | **Defender plans unspecified.** | Enable Defender CSPM, Containers (ACR scan, runtime), Storage (malware and anomalous access), Key Vault, Resource Manager, and Open-source relational databases; route alerts to SIEM. Servers plan applies only in Option 1. | P §3, §11 |
| F-MC-03 | High | **Environment isolation.** "Separate subscriptions or resource groups" is insufficient for prod. | Production in its own subscription under a restricted management group, separate Entra app registrations per environment, no production roles for test identities, no network path from dev/test to prod data (NFR-08). | P §3, §10 |
| F-MC-04 | Medium | Encryption and key management statement missing (SEC-33). | At-rest encryption (platform-managed minimum; CMK decision recorded as ADR), TLS 1.2+ everywhere including Postgres `require_secure_transport`, key rotation (F-MI-04). | P §3 |
| F-MC-05 | Medium | Resource locks, deletion protection, budget alarms for tampering/DoS cost. | CanNotDelete locks on PG, KV, Storage, Log Analytics; Cost Management alerts per environment (already partly in §8). | P §3 |
| F-MC-06 | Medium | Incident response and rollback of **policy** (not just revision rollback). | Runbook: pause engine, review decisions by audit query, restore prior approved policy version; revision rollback does not undo rule data in DB. | P §10 |
| F-MC-07 | Medium | Time source and tenant location. | Server time only; confirm Canada tenant data residency for Entra logs/Sentinel workspace (assumption AZ-2). | P §3 |
| F-MC-08 | Low | Option-specific items if chosen later: Option 3 Durable Functions task hub storage holds orchestration payloads (PII risk, shared keys) and Function system keys; APIM must `validate-jwt`; Option 1 Bastion/Update Manager audit and Defender for Servers; AKS variant needs Azure Policy for Kubernetes, workload identity, network policies, admission control for signed images. | Add a short per-option security note. | P §4-6 |

---

## 4. Security issues on the call-flow page (D, page "Call flow")

| ID | Sev | Step | Issue | Fix |
|---|---|---|---|---|
| F-FL-01 | High | 1-3 | SPA obtains tokens in the browser (public client). Tokens in browser storage are exposed to XSS (SEC-24), and the security review's session design assumed HttpOnly cookies. | Choose explicitly: either **BFF pattern** (the API acts as confidential client, HttpOnly `__Host-` SameSite cookie, CSRF token) or MSAL with in-memory cache, strict CSP, short token lifetimes and no refresh token in storage. Document the decision. Annotate step 2/3 and CSP headers on the Front Door rule set. |
| F-FL-02 | High | 2, 3, 7 | "ID + access token (roles, branch)": branch/role used for scope and engine context come from the token. | Context assembled server-side from the user directory table; token only identifies the user and carries app roles; deny if role conflicts (SEC-01). |
| F-FL-03 | High | 5, 9 | Pause/control state is read at step 5 and re-checked at step 9, but without a lock this check is racy; velocity counters (SEC-15) and the audit hash chain are not shown. | In step 9 use `SELECT ... FOR SHARE` on the control row (or serialisable isolation) and update velocity counters and chain head in the same transaction; label what is committed: request, decision, **context snapshot/hash**, audit with actor/session/IP, outbox. |
| F-FL-04 | Medium | 3, 16 | Idempotency scope and replay: only "Idempotency-Key" shown; decision endpoint has If-Match but no idempotency/nonce, no step-up and no self-decision/authority check. | Add to step 16/17: server re-evaluates roles from DB, ensures reviewer is not the submitter/editor, checks authority level, requires fresh MFA (auth context) for privileged actions, stores payload hash with the key. |
| F-FL-05 | Medium | 10 | Reason returned to staff may leak thresholds or compliance holds (tipping-off, SEC-16). | Annotate: generic reason code/text from approved list only; sensitive declines show "refer to head office". |
| F-FL-06 | Medium | 11-13 | Outbox publish is at-least-once; duplicates and out-of-order events can produce wrong or duplicate notifications. | Consumers idempotent by outbox ID; messages carry IDs only; state re-read from DB. |
| F-FL-07 | High | 14-15 | "Send to user / reviewer group": group authorisation undefined (F-WS-01). | Show a step where the API mints a scoped Web PubSub token and the server (not client) assigns groups after role/branch check; add revoke on role change. |
| F-FL-08 | Medium | 4 | Only "WAF checks, forward over private link": no origin validation or header/CSP injection. | Add `X-Azure-FDID` check, CSP and security headers via Front Door rules, request size limits and rate limits (SEC-34). |
| F-FL-09 | Medium | All | Flow omits security-relevant paths: rule administration (approve/activate/pause), escalation, audit read, authN/Z denials, audit anchoring, role-change events. | Add a second flow page for privileged actions showing step-up, two-person check, content-hash verification, audit write, alert to SIEM; and one for anchoring/verification. |
| F-FL-10 | Low | Notes | "Pause state read every evaluation, never cached" — consistent with the proposal, but D6 in the design allows a short documented cache. | Align wording across documents. |

---

## 5. Priority fix list (before R1 build)

1. F-NW-01, F-NW-02, F-MC-01, F-MC-03: private-only exposure and enforced baseline, prod subscription isolation.
2. F-ID-01, F-ID-02, F-ID-03, F-ID-07: token validation, CA strength and step-up, role assignment governance, break-glass.
3. F-MI-01, F-MI-02: per-workload identities, Key Vault RBAC with non-exportable signing key.
4. F-CI-01, F-CI-02, F-CI-04: verified signatures, scoped federated credentials, no rule files in prod.
5. F-AU-01 to F-AU-04, F-LG-01: locked immutability, separate subscription, minute-level anchoring, key-based chain, App Insights PII controls.
6. F-FL-01, F-FL-02, F-FL-03, F-FL-07, F-WS-01: token storage model, server-side context, locked commit check, scoped Web PubSub groups.
7. Extend §11 with an explicit table of High SEC items marked "application-enforced" so the mapping is complete (section 1 above).

## 6. Residual items to confirm with others

- Compliance: Canadian residency assumption (AZ-2), retention duration for WORM policy, CMK requirement, whether Canada East is acceptable for backups.
- IT: feasibility of Entitlement Management/PIM licensing (Entra ID P2/Governance), Sentinel vs existing SIEM, access to a separate subscription for the anchor store.
- Architect: BFF versus SPA token model; per-aggregate chain design; confirm Front Door Premium Private Link support for the chosen Container Apps networking mode.
