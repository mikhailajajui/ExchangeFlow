# ExchangeFlow Security Review (design-stage threat model)

**Scope:** PRD.md (v0.1), policy-engine-design.md (v0.1), application-elaboration-plan.md, application-project-plan.md (v0.2). No code exists; this is a review of design documents only.
**Date:** 2026-10-01
**Status:** Advisory. Compliance items are flagged for confirmation with the compliance function and are not legal advice.
**Severity key:** High = fix before real data or any rule goes ACTIVE; Medium = fix before pilot; Low = fix before production or accept explicitly.

---

## 0. Executive summary

The design is strong on safe defaults (fail to human, deterministic engine, immutable versions, shadow mode, kill switch). The main weaknesses are in governance and trust boundaries, not in the engine logic:

1. **Separation of duties is stated but not enforceable as written.** Users can hold several roles (FR-60), "approver" both approves and activates (matrix §7), the "regulated" flag is author-controlled, and admin can grant roles without a second person. One insider can plausibly author, approve and activate a rule.
2. **Rules can be crafted to favour the insider.** Context fields include submitting user and branch; nothing prevents narrow or overfitted AUTO_APPROVE rules, and effective dating allows short-lived rules.
3. **Pause is not always fail-safe.** Pausing a force-human or AUTO_DECLINE rule makes the outcome more permissive. Four roles may pause; no restriction on which direction.
4. **Threshold evasion (structuring, probing, post-approval amount drift) is unaddressed.** Per-request rules, a reason text that discloses logic, free resubmission, and no reconciliation of approved vs completed amounts.
5. **"Append-only audit" is only an application-level promise (FR-44).** A DB administrator or compromised service account can alter history. Reproducibility (NFR-09) also needs the evaluation inputs stored, which the data model omits.
6. **Branch isolation (FR-62) is only "Should"** and conflicts with R3; enumeration of other branches' requests is a High risk.
7. **Stored XSS in free-text fields (reasons, escalation notes) in a reviewer console** is the cheapest path to mass-approval via a hijacked reviewer session.

---

## 1. Threat model

### 1.1 Assets and trust boundaries

| Asset | Why it matters |
|---|---|
| Rule store and active policy version | Controls who gets auto-approved; integrity is the highest-value target |
| Decision and audit records | Evidence for compliance and disputes; must be tamper-evident |
| Customer and request data | Minimised, but still personal/financial |
| Role assignments and IdP identities | Root of every authorisation decision |
| Kill-switch state | Safety control; also a denial-of-automation lever |

Trust boundaries: (a) browser to API (untrusted client, including a malicious insider using their own valid session); (b) API/workflow to policy engine (context must be built server-side from trusted sources); (c) application to database/audit store (DB admins and the app service account are different trust levels); (d) application to notification provider and IdP (third parties); (e) CI/CD and config repository to production (the first increment loads rules from config files, bypassing governance).

### 1.2 STRIDE by component

| Component | Spoofing | Tampering | Repudiation | Info disclosure | DoS | Elevation of privilege |
|---|---|---|---|---|---|---|
| **Web client** | Phished or shared workstation credentials; shared accounts at the counter | Client-supplied branch, role, amount or "status" fields trusted by server (mass assignment); DOM XSS | User denies acting ("someone used my session") | Cached pages on shared PCs; PII in browser storage, URLs, referrers | UI-driven request floods | Hidden controls assumed to be security; XSS gives session of a reviewer/approver |
| **API** | Stolen/replayed tokens; demo identity flow left enabled | Replay of approve/decide calls; IDOR on request IDs; parameter tampering of EvaluationContext; CSRF | Missing actor/session/IP on events | Verbose errors, enumeration through 403 vs 404, list endpoints without branch filter | No rate limits; expensive simulate/report endpoints | Role check missing on one admin endpoint (many endpoints, see §8.2); self-approval of own request when user holds staff+reviewer |
| **Policy engine** | Context fabricated by caller to look like another branch/type | Rule JSON with oversized/deeply nested conditions; type confusion (string vs decimal); field path injection | Decision cannot be reproduced because inputs are not stored | Rule reason text discloses thresholds to staff (oracle) | Rule complexity, huge `in` lists, timeout storms flooding reviewers | Rule crafted to approve insider's requests; missing data under `not` matching |
| **Rule administration** | Approver identity borrowed (shared credentials, second account) | Edit of mutable columns (`mode`, `state`, `effective_*`) on "immutable" versions; config-file rules bypassing workflow; TOCTOU between approval and activation | Approval without evidence of what was reviewed | Rule logic and thresholds exposed to broad audience | Pause abuse to disable automation or flood reviewers | Author = approver = activator via multiple roles; admin self-grants roles; author chooses `category` to avoid compliance approval |
| **Audit store** | Forged events by any code path with write access | Edit/delete by DBA or service account; truncated chain; clock manipulation | Events lacking actor, session, correlation, input hash | Audit viewers see more PII than needed; audit export | Audit write failure blocks decisions (good: fail closed) but audit flooding fills storage | Compliance/manager role able to read all branches; admin able to alter audit retention |
| **Notifications** | Spoofed notifications/phishing lookalikes inside the app | Reason text injected into email/push templates | "I never saw it" disputes; delivery log not tamper-evident | PII or amounts in email/push payloads handled by third-party provider | Notification storm; provider outage (must not block decisions: covered by FR-52) | Notification deep links that skip authorisation checks |

### 1.3 Abuse cases specific to automated decisioning

Each case lists the attack, the current coverage, and the gap. IDs map to the requirements in section 2.

| # | Abuse case | Current design coverage | Residual risk | Req. |
|---|---|---|---|---|
| A1 | **Insider crafts a rule to auto-approve their own requests** (narrow rule on a unique amount, branch, time window, or submitting user/role; or a short-lived rule via effective dates, retired before review) | Author != approver; shadow; replay | High. `Origin: branch, submitting user role` are rule inputs. No specificity limit, no max approve ceiling, no minimum shadow period, effective dating can shorten exposure | SEC-04, 05, 06, 07 |
| A2 | **Splitting a large request into small ones** under an auto-approve threshold, across time, staff members or branches | Placeholder velocity field "request count in window" only | High. Per-request evaluation; no customer-level aggregation (conflicts with data minimisation); concurrent submissions race on counters | SEC-14, 15 |
| A3 | **Threshold probing**: resubmit with varied values until AUTO_APPROVE; use reason text to learn the limits | FR-06 preserves history (does not limit it) | Medium. Reason text is shown to staff; no per-user attempt limits or anomaly flag | SEC-16 |
| A4 | **Approved-vs-executed drift**: approve a small amount, execute a larger one in the existing system | Out of scope (no money movement); Completed is a bare status (FR-07) | High for fraud, since ExchangeFlow's approval becomes a false assurance. No reconciliation | SEC-17 |
| A5 | **Collusion between author and approver** (two insiders, or one person with two accounts/roles) | Identity inequality only; compliance for "regulated" | High. SoD is identity-string based, "where team size allows", and approver can also activate | SEC-01, 02, 03, 08 |
| A6 | **Collusion between rule author and reviewer to game the shadow agreement report** (reviewers rubber-stamp what the shadow rule predicts; shadow results are visible to reviewers, FR-21) | Report signed off by approver | Medium/High. Anchoring and gaming; shadow outcome shown to reviewer biases the human decision that the report treats as ground truth | SEC-09 |
| A7 | **Tampering with audit** (DBA edit, service-account misuse, deleting the evidence of a bad rule) | FR-44: "cannot be edited through the application" | High. Nothing protects against actors below the application | SEC-10, 11 |
| A8 | **Replaying or racing decisions** (replay an approve call; double-submit; reviewer decision racing with escalation; pause cache window; policy version flips between evaluate and commit; field edit after evaluation) | Idempotent submit FR-08; stale-update FR-23/24; pinned version; "short documented" pause cache | Medium. Idempotency scope not defined; pause cache window allows automation after pause; no check at commit that pause/policy state unchanged; fields editable between evaluation and commit | SEC-18, 19, 20 |
| A9 | **Privilege escalation via roles** (self-grant by admin; role stacking staff+reviewer+approver; role change not audited with approver; stale sessions retain old roles) | FR-63 audits role changes | High. No role-conflict matrix, no second-person approval for role grants, no step-up auth | SEC-01, 02, 21 |
| A10 | **Enumerating other branches' requests** (IDOR, search, list filters, notification links, reports, audit view) | FR-62 "Should", marked TBD | High. UUIDs reduce guessing but are not authorisation; search (FR-43) and manager reports are natural leaks | SEC-12 |
| A11 | **Unsafe pause**: a user pauses the force-human rule or the AUTO_DECLINE rule so that remaining AUTO_APPROVE rules decide alone | Pause permitted for four roles, "fail safe" assumed | High. Pause is only safe if it can only move outcomes toward human review | SEC-13 |
| A12 | **Missing-data exploitation** (`not` conditions match when the field is absent; attacker omits a field so a decline/approve fires, or forces human review en masse to flood reviewers) | MISSING_DATA fallback for "candidate rule" | Medium. Ambiguous for negations; no three-valued logic | SEC-22 |
| A13 | **Rules bypassing governance through config files** (first increment loads rules from files; anyone with repo or deploy access can change policy) | None stated | High until R2 ships. Placeholder-only restriction (FR-17) is a policy, not an enforced control | SEC-23 |
| A14 | **Stored XSS / CSRF to act as a reviewer or approver** | Not addressed (NFR-05 covers TLS, authn, authz only) | High. Free-text reasons, escalation notes and rule names are rendered to privileged users | SEC-24 |
| A15 | **Staff conflict of interest** (processing requests for themselves, relatives or an accomplice; submitting under another branch) | None | Medium. Needs self/related-party exclusion and anomaly detection | SEC-25 |
| A16 | **Reviewer pressure / fatigue** (staff chase reviewers, floods of junk requests, bulk approvals) | Reason required for decline only | Medium. No reviewer-level limits, no random second review of human approvals | SEC-26 |
| A17 | **Sampling manipulation** (manager chooses which auto-decisions to review, or hides bad ones; sample via client-side param `sample=true`) | Random sample by manager | Low/Medium. Sampling must be server-side random and logged | SEC-27 |

---

## 2. Gaps in current requirements, with added requirements

Format: ID, priority, gap, and the added or amended requirement. "Amends" references an existing ID.

### 2.1 Authorisation, roles and separation of duties

| ID | Pri | Gap | Added requirement |
|---|---|---|---|
| SEC-01 | High | FR-60 lets one user hold several roles; SoD (design §1.7, §7) is only "where team size allows". | Define a **role-conflict matrix enforced by the server**: no user may hold both policy author and policy approver; approver and activator must be different people per rule version; admin must not hold policy author/approver/reviewer/compliance; reviewer may not decide a request they submitted or edited. Violations blocked at role-assignment time and at action time. Amends FR-31, FR-60, D5. |
| SEC-02 | High | Admin can grant any role (matrix: "Manage users and roles"); FR-63 only audits. | Role grants for author/approver/compliance/reviewer require **second-person approval** (another admin or compliance), are time-bounded or periodically recertified (quarterly), alert compliance, and require step-up MFA. Admin cannot approve their own grant. Amends FR-63. |
| SEC-03 | High | Matrix gives "Enable shadow, activate" and "Approve" to the same role. D5 two-person activation is an open default. | Split approve vs activate. **Activation of any AUTO_APPROVE rule requires two distinct people other than the author** (approver plus policy owner or compliance). Amends FR-31, FR-33, D5. |
| SEC-04 | High | `category` (and thus "regulated") is a free string set by the author. | Regulated classification is **derived by the system** from rule content (request type, currency pair, amount band, customer attributes) against a compliance-owned classification table; the author cannot override it. Any change to the table needs compliance approval. Amends FR-31. |
| SEC-05 | High | Rules can use `Origin: branch, submitting user role` and unbounded conditions. | Rule schema **forbids user identity, user ID and individual-level fields**; branch only in HUMAN_REVIEW or AUTO_DECLINE rules unless compliance approves; `eq` on amount forbidden for AUTO_APPROVE; every AUTO_APPROVE rule must satisfy a **specificity test** (matches at least N historical requests from at least M users and K branches in replay). Amends FR-16, §6.2. |
| SEC-06 | High | No hard ceiling on what any approve rule can approve. | A compliance-owned, separately versioned **guardrail policy** (max amount for auto-approve, prohibited types, prohibited currencies) that is evaluated after rules and can only force HUMAN_REVIEW. Rule authors cannot edit it. Amends FR-16, D4. |
| SEC-07 | Medium | Effective dating (FR-35) can create a short-lived rule; shadow period undefined. | Minimum shadow duration and minimum sample size (set by compliance) before activation, **not waivable by effective dating**. Rules with effective windows shorter than a minimum, or backdated windows, rejected. Retiring a rule within a set period after activation triggers review. Amends FR-33, FR-35. |
| SEC-08 | High | Approval is not bound to content; mutable columns exist on RULE_VERSION (`mode`, `state`); approver may not see impact. | Approval records a **hash of the canonical rule content**, and activation re-verifies the hash (no TOCTOU). Approver UI must show the diff against the prior version and the simulation/replay impact report; approval cannot be recorded without having opened them. DB-level constraints make content columns immutable once approved; state changes only via a stored procedure that writes the audit event. Amends FR-30, §6.1. |
| SEC-09 | Medium | Shadow results are visible to reviewers (FR-21) and the agreement report assumes human decisions are independent. | Hide shadow outcomes from reviewers until after they decide (or for a random hold-out subset), report agreement with sample-size and segment confidence, and require compliance review of any rule whose agreement is unusually high with few distinct reviewers. Amends FR-21, FR-37. |
| SEC-13 | High | Any of four roles can pause any rule or the engine; pausing a force-human or decline rule is permissive. | Pause semantics must be **monotonically safe**: pausing the engine is always safe; pausing a single rule is allowed immediately only for AUTO_APPROVE rules. Pausing HUMAN_REVIEW or AUTO_DECLINE rules requires approver/compliance action, or alternatively is implemented as "route everything the rule could have affected to HUMAN_REVIEW". Resume needs two-person approval for AUTO_APPROVE rules. Pause/resume needs a mandatory reason and alerts. Amends FR-34. |
| SEC-12 | High | FR-62 branch scoping is "Should"; R3 and FR-04 imply it. Search (FR-43), manager and audit views have no scope. | Make branch scoping **Must** at the data-access layer (row-level filter or server-side authorisation on every query, including search, reports, notifications, audit views and exports). Cross-branch access is an explicit, audited grant. Return 404 for out-of-scope objects. Amends FR-04, FR-43, FR-62. |
| SEC-25 | Medium | No conflict-of-interest or self-service guard. | Staff cannot submit or escalate requests for themselves or declared related parties (field to be agreed with privacy); detect anomalies (same staff, same customer token, repeated outcomes) and report to compliance. |
| SEC-26 | Medium | FR-25 authority levels is "Should". Reviewers have unlimited authority. | If any amount-based authority exists, enforce it server-side (Must). Add reviewer-level monitoring (approval rate, volume, out-of-pattern), and random second-review of a sample of human approvals. |
| SEC-27 | Low | Sampling is a query parameter. | Sampling done server-side with a CSPRNG, sample selections logged, manager cannot choose which records to see, flags immutable. Amends FR-42. |

### 2.2 Decision integrity (engine, requests, threshold evasion)

| ID | Pri | Gap | Added requirement |
|---|---|---|---|
| SEC-14 | High | Velocity "request count in window" is optional and per-request; customer data minimisation prevents tracking. | Provide a **pseudonymous customer key** (keyed hash of the permitted identifier, key in KMS) for aggregation, so cumulative amount/count per customer per window (across branches) can be evaluated without storing raw identifiers. Confirm permitted identifiers with privacy (Q5). Until this exists, no AUTO_APPROVE rule is activated for amounts where structuring risk is relevant. |
| SEC-15 | High | Concurrent submissions can each see counters below threshold. | Counters updated atomically in the same transaction as the decision (e.g. serialisable isolation or row lock on the customer-window record). Test with parallel submissions. Amends NFR-04. |
| SEC-16 | Medium | Reason text and unlimited resubmission leak thresholds. | Reason templates must be generic (no numeric limits). Rate-limit and flag repeated submissions from one user/customer key with small variations; alert compliance. Cap resubmissions per request and require reviewer approval for amount changes after a decline. Amends FR-06, FR-13. |
| SEC-17 | High | Approval is detached from the transaction actually executed. | FR-07 upgrade: the **Completed step records the executed amount, currency pair and transaction reference**; a mismatch with the approved values (beyond a tolerance set by compliance) raises an alert and blocks Completed. Approval expires after a configured period. Confirm with Q1/D8. Amends FR-07 (raise to Must if any rule is ACTIVE). |
| SEC-18 | High | Request mutable between evaluation and commit; idempotency scope undefined. | Request business fields are **immutable after submission**; changes create a new revision (resubmit) and a new evaluation. Idempotency keys are scoped to (user, endpoint) with a stored request hash; same key with different payload is rejected. Decision and review endpoints require the request `version` (optimistic lock), and server-side nonce/one-time-token for approve/decline actions. Amends FR-08, FR-23, FR-24. |
| SEC-19 | High | Pause flag cached for an undefined interval (D6). | Pause state is checked **inside the decision transaction at commit** (or cache TTL no greater than a few seconds, documented, tested); decisions whose evaluation started before a pause but commit after are re-evaluated or downgraded to HUMAN_REVIEW. Amends FR-34, D6. |
| SEC-20 | Medium | Policy version pinned at evaluation, but not verified at commit; clock source undefined. | Commit asserts pinned policy version is still the active one or is explicitly valid; all timestamps and effective-date decisions use server time (NTP-synced, single time source), never client time. |
| SEC-22 | Medium | `not` and absent fields: PLACEHOLDER-002 would match when `currencyPair` is missing. | Use **three-valued logic**: any condition referencing a missing/invalid field yields UNKNOWN, and any UNKNOWN in a rule that could produce an automated outcome yields MISSING_DATA. Specify and test for negations. Amends §4.2, §4.3. |
| SEC-28 | High | EvaluationContext assembly trusted. | The context is built **server-side**: branch, user, role, timestamp and environment come from the session and server, never request body; request body is validated against a strict schema (reject unknown fields); amounts parsed as decimal strings with currency; bounds and precision checks. Amends FR-02, §4.1. |
| SEC-29 | Medium | Rule schema permits unbounded size/complexity. | Strict JSON schema for rules: allow-listed fields and operators, max depth, max node count, max `in` list size, typed values, no regular expressions or string-to-number coercion, and rejection of `__proto__`/path traversal in `field`. Engine has CPU/time budget independent of the timeout fallback. |
| SEC-23 | High | First increment loads rules from files (elaboration plan §7); FR-17 relies on policy. | In every non-demo environment, **rule source must be the governed rule store only**; config-file loading disabled outside demo. Placeholder rules (ids `PLACEHOLDER-*`) are hard-blocked from ACTIVE approve/decline in any environment flagged production. Demo identity flow compiled out or gated by an environment flag verified at startup. Amends FR-17. |

### 2.3 Audit, logging and data

| ID | Pri | Gap | Added requirement |
|---|---|---|---|
| SEC-10 | High | FR-44 only covers the application. | Audit store must be **tamper-evident and protected below the application layer** (see §3.3): insert-only DB role, hash chaining, external signed anchoring, separate administrative domain. Amends FR-44, NFR-09. |
| SEC-11 | High | Data model (AUDIT_EVENT: actor, action, at) too thin; DECISION_RECORD lacks inputs. NFR-09 "reproducible" needs more. | Audit event must include: event ID, sequence number, previous hash, actor user ID (not a name string) and role set at the time, session ID, source IP/device, correlation ID, target object and version, action, before/after content hashes, and for decisions a **minimised EvaluationContext snapshot (or its hash plus retained snapshot) and the rule-version content hashes**. Authentication events, authorisation denials, role changes, pauses/resumes and audit-view access are all audited. Amends §6.1, §10. |
| SEC-30 | Medium | Reads are not audited. | Audit **access to customer data and to audit/search results** (who viewed what), with alerts for bulk viewing or cross-branch access. |
| SEC-31 | Medium | NFR-07 "no sensitive data in logs" is not testable; free-text fields can hold PII. | Define a **log data classification**: allowed log fields (IDs, codes, outcome), blocked fields (names, ID numbers, account numbers, free text, tokens). Structured logging with an allow-list serialiser; free-text reason fields capped, flagged as potentially sensitive, and never logged or placed in notifications. Add automated log-scan tests. Amends NFR-07. |
| SEC-32 | Medium | NFR-10 retention is TBD; erasure vs immutability conflict unaddressed. | Separate PII from audit evidence: audit stores pseudonymous keys and hashes; PII in a store that supports deletion/crypto-shredding at end of retention. Retention schedule set by compliance; legal hold supported. Amends NFR-10. |
| SEC-33 | Medium | No encryption-at-rest, key management, backup, or region requirement. | Add NFR: encryption at rest for DB, backups and logs with KMS-managed keys; backups include the audit store with the same integrity guarantees; restore tested; data residency confirmed with compliance. |

### 2.4 Platform and operational

| ID | Pri | Gap | Added requirement |
|---|---|---|---|
| SEC-21 | High | NFR-05 lacks authentication strength, session, and step-up requirements. | See §3.1 and §3.5: SSO with MFA, step-up for privileged actions, session limits and immediate revocation on deprovisioning or role change. Amends FR-60, NFR-05. |
| SEC-24 | High | XSS/CSRF/headers not mentioned. | Add NFR: output encoding for all user-supplied text (reasons, notes, rule names), strict CSP (no inline scripts), CSRF protection on all state-changing requests, `X-Content-Type-Options`, frame-ancestors none, no sensitive data in URLs or local storage, and cache-control no-store on sensitive pages. Notification text rendered as plain text. |
| SEC-34 | Medium | No rate limiting or abuse controls. | Per-user and per-IP rate limits (submit, escalate, resubmit, login), tighter limits on admin and simulate endpoints, anti-enumeration behaviour, and queue-flood alerts. |
| SEC-35 | Medium | NFR-06 only says secrets are out of source. | Secrets in a managed secret store, rotated, per-environment; CI secret scanning; no shared accounts; separate service accounts for app, migrations and audit writes. See §3.4. |
| SEC-36 | Medium | No supply-chain requirements. | Lockfiles, pinned versions, SBOM, dependency and container scanning in CI with a fix-SLA, signed builds, protected main branch with required review, least-privilege CI tokens, no `eval`/dynamic code in the rule engine. |
| SEC-37 | Medium | NFR-14 alerts are operational only. | Add **security alerts**: any rule activation, pause/resume, role grant, approval by a repeat author/approver pair, audit chain verification failure, engine conflict spikes, auto-approve rate shift, off-hours admin actions, failed-login bursts. Route to compliance/security, not only ops. |
| SEC-38 | Medium | Notification provider handling of PII not specified (FR-53, E8). | Notifications contain only request ID and status code, with deep link behind authentication and authorisation; provider under a data-processing agreement; no PII/amounts in email/push. |
| SEC-39 | Low | Rate source (FR-70/UC-07) mentions a public rate page. | If implemented: server-side fetch only from an allow-listed host (SSRF), treat as untrusted data (validate, sanitize, label), and **never feed it into rule evaluation** without an integrity-validated source. |
| SEC-40 | Low | No break-glass or incident procedure. | Define break-glass access (time-boxed, dual approval, alerting), a security incident runbook (wrong auto-decision, suspected rule tampering, credential compromise), and a documented rollback of policy to a prior approved version. |
| SEC-41 | Low | Environment separation. | Production isolated from dev/test; synthetic data only outside production (NFR-08) enforced by controls, e.g. blocking production DB access from non-prod, and no production copies for testing. |

### 2.5 Specific edits to the §7 permission matrix

| Change | Priority | Reason |
|---|---|---|
| Add "Policy owner" role column or confirm it is the approver | Medium | Persona exists in PRD but not in matrix; ambiguity over who may enable shadow/activate |
| Staff: add "View own branch requests"; Manager and Compliance: add scoped "View requests/audit" with branch limits; add "View shadow results" (reviewer, approver, manager) | High | FR-04, FR-43 and FR-21 are not represented; unlisted actions default to undefined access |
| Split "Enable shadow" (approver) from "Activate" (second person, per SEC-03) | High | SoD |
| Restrict "Pause" per SEC-13; remove Policy author from pause permission | High | Author holding pause increases insider impact |
| "Decide human-review cases": add condition "not own submission, not own branch if a conflict is declared" | High | Self-approval via role stacking |
| "Manage users and roles": add second-person approval; deny self-modification | High | SEC-02 |
| Add rows: "View audit log", "Export", "Manage guardrail policy" (compliance), "Resume engine" (two-person), "Run simulate/replay with real data" (restricted) | Medium | Currently unspecified |
| Specify that the matrix is a **machine-readable, version-controlled artefact** used by both enforcement and tests | Medium | Prevents drift between document, code and tests |

---

## 3. Recommended controls

### 3.1 Authentication

- **SSO through the organisation's IdP** (OIDC with authorization code and PKCE, or SAML), no local passwords in the application. The "safe demonstration identity flow" (elaboration §7) must be a separate, non-production build mode.
- **MFA mandatory for all users**; **phishing-resistant MFA (FIDO2/WebAuthn)** for reviewers, policy, compliance and admin roles.
- **Step-up re-authentication** (fresh MFA within a few minutes) for: approve/activate a rule, pause/resume, role grants, audit export, large-value review decisions.
- Joiner/mover/leaver: provisioning/deprovisioning via SCIM or daily sync; a disabled IdP user loses access within minutes (session revocation, not only at token expiry). Quarterly role recertification by managers and compliance.
- Validate tokens fully (issuer, audience, signature, expiry, nonce); roles come from the application's authorisation store (or signed claims verified every request), not from client-editable data.
- No shared or generic counter accounts. Where shared workstations are unavoidable, require per-user login with quick re-auth (badge or WebAuthn) and short idle timeout.

### 3.2 Authorisation model

- **Deny by default**, centralised policy enforcement point in the API layer; every handler declares its required permission; a CI test fails if an endpoint lacks one.
- **RBAC plus attribute rules**: role grants permissions; attributes (branch, amount authority, own-request exclusion, rule-author exclusion, conflict-of-interest flags) constrain them.
- **Static SoD** (role-conflict matrix, SEC-01) and **dynamic SoD** (the person who touched a request or rule version cannot approve it).
- **Object-level checks** on every read and write (request, decision, audit, report, notification), and row-level filtering for lists and search. Use 404 for out-of-scope objects.
- Mass-assignment protection: explicit DTO allow-lists; status, branch, user and version fields are never accepted from clients.
- The permission matrix is a machine-readable file used for tests that iterate every role against every endpoint.
- Decision-integrity guardrails as authorisation-like controls: compliance-owned ceiling policy (SEC-06), schema restrictions (SEC-05, SEC-29), monotonic pause (SEC-13).

### 3.3 Audit immutability approach

Layered, so that no single administrator can silently change history:

1. **Application layer:** only an audit-append function writes events; no update/delete code paths.
2. **Database layer:** dedicated `audit_writer` role with INSERT only (REVOKE UPDATE, DELETE, TRUNCATE); triggers rejecting updates/deletes; audit tables in a separate schema or database; the application's general service account cannot modify them. Audit written in the same transaction as the state change (NFR-04), and failure to write the audit event aborts the decision (fail closed).
3. **Tamper evidence:** per-stream sequence numbers and a **hash chain** (each event includes the hash of the previous event and a canonical serialisation of its content; optionally HMAC with a key in KMS/HSM held outside the application's reach).
4. **External anchoring:** periodically (for example every few minutes or N events) write a signed checkpoint (chain head or Merkle root) to **WORM storage in a separate account/administrative domain** (object lock in compliance mode, or an equivalent managed ledger). Different admins for the app and the anchor store.
5. **Verification:** scheduled job re-computes the chain and compares to the anchors; any mismatch raises a high-severity security alert. Include the check in restore drills.
6. **Operational controls:** database admin actions logged to an independent log sink; break-glass for DDL changes; backups retained with the same immutability; retention locks aligned with the compliance retention schedule (SEC-32).
7. **Content:** include inputs and content hashes as in SEC-11 so that a decision can be replayed and verified against the rule version hash.

### 3.4 Secrets and configuration

- Managed secret store/KMS; no secrets in repository, images, client bundles or CI logs; per-environment and per-service credentials; rotation schedule and rotation on staff departure.
- Pre-commit and CI secret scanning; incident process if a secret is committed (rotate first).
- Separate DB accounts: migration, application read/write, audit-append, reporting read-only (with branch scoping).
- Signing/HMAC keys for audit and pseudonymisation held in KMS with restricted use policy, and not accessible to application developers.
- Configuration that changes behaviour (pause state, feature flags, guardrails, engine timeouts) is stored and changed through audited paths, not environment variables edited ad hoc.

### 3.5 Session handling

- Server-managed sessions or short-lived access tokens with refresh rotation; cookies `HttpOnly; Secure; SameSite=Lax` (or Strict), `__Host-` prefix; no tokens in local storage.
- Idle timeout (suggest 15 minutes for reviewer/policy/admin; confirm for counters) and absolute lifetime (suggest 8 to 12 hours); re-auth on role change; revoke all sessions on password/MFA reset, deprovisioning and role removal; list/terminate active sessions.
- CSRF: anti-CSRF token or double-submit plus SameSite for all state-changing methods; verify `Origin`.
- Limit concurrent sessions for privileged roles; bind sessions loosely to device/IP changes and re-authenticate on significant change; optionally restrict privileged roles to corporate network/managed devices (conditional access).
- Cache controls so sensitive pages are not stored in shared browsers; clear client state on sign-out.

### 3.6 Logging and PII

- Structured, allow-listed logging; log identifiers, outcome codes and correlation IDs, never names, ID numbers, free-text, tokens, or full request bodies; central log store with access control and retention distinct from audit.
- Separate **security log** (authN/authZ events, denials, privilege changes, pause/resume) feeding alerts; time-synchronised.
- Free-text fields treated as potentially sensitive: length limits, not echoed in logs or notifications.
- Mask data by default in UI (show last digits only) and reveal on demand with audit; reviewers see only fields needed for the decision.
- Test, demo and simulation environments use synthetic data (NFR-08); simulation/replay on real historical data runs only in production-grade controlled environment with masked fields.
- Error responses generic to clients; detail in logs only.

### 3.7 Rate limiting and abuse protection

- Per user, per IP and per branch limits on submit, escalate, resubmit, login and search; stricter on admin, simulate and report endpoints; limit request payload size and rule size.
- Detect and alert on threshold probing, repeated near-threshold submissions, bursts creating HUMAN_REVIEW fallbacks (MISSING_DATA floods) and queue flooding.
- Engine timeouts plus resource limits so a hostile rule cannot stall evaluation; a timeout storm raises an alert and automatically triggers global pause evaluation.

### 3.8 Dependency and supply-chain hygiene

- Lockfiles; automated dependency updates; `npm audit` (or equivalent) gating high/critical in CI with fix SLAs; SBOM generated per build; container base-image scanning; license check.
- Protected branches, mandatory reviews (CODEOWNERS for the rule engine, authorisation and audit modules), signed commits/tags, build provenance, least-privilege CI credentials, separate deploy approvals.
- No dynamic code execution in the engine (the design already excludes `eval`; enforce with lint rules and tests); disable prototype pollution vectors in JSON parsing.
- Third-party scripts avoided in the client; subresource integrity if used; pin and review any UI component libraries.
- Vendor review for IdP, hosting and notification providers (security attestations, data processing terms, breach notification).

### 3.9 Compliance considerations (confirm with compliance; not legal advice)

Jurisdiction and licence type are not stated in the documents, so each item below must be mapped to the applicable regime by the compliance function.

1. **AML/CFT program interaction.** Confirm whether the policy engine's decisions form part of the regulated AML/CFT controls (risk assessment, transaction monitoring, thresholds), and whether automated approval/decline of any transaction type is permitted. This ties to Q3, D4 and R12. Treat rules as controls requiring documented rationale, owner, testing and periodic review (model/rule governance).
2. **Structuring and aggregation.** Per-request thresholds can facilitate structuring. Confirm required aggregation (customer-level, multi-day, multi-branch) and whether this must be evaluated before auto-approval (SEC-14).
3. **KYC / identity verification and sanctions screening.** The product states it does not replace ID verification or compliance systems. Confirm that auto-approval is only valid after those checks, and how the evidence is referenced (a verification reference rather than raw identity data).
4. **Reporting obligations.** Confirm any threshold or suspicious-activity reporting that ExchangeFlow decisions or declines must trigger or feed, and who is authorised to escalate.
5. **Tipping-off and explanation.** Persona "Sam" explains outcomes to the customer, and auto-decline reasons are visible to staff. Confirm that decline reasons based on suspicion or compliance holds are never displayed to staff or customers, and define staff-facing generic reason codes.
6. **Record retention and immutability.** Confirm minimum retention periods for transaction, decision, rule-change and audit records, and whether records must be retrievable within a stated time for regulators. Plan for retention vs privacy erasure conflict (SEC-32), legal hold, and retention of rule history for as long as decisions made under it.
7. **Privacy and automated decision-making.** Confirm applicable privacy law (data minimisation, lawful basis, cross-border transfers and residency, data subject access) and whether customers have any right to human review or explanation of automated decisions. Complete a privacy impact assessment before any real customer data (Q5, D7).
8. **Change management and approvals.** Regulators and auditors typically expect documented, approved, tested changes with segregation of duties; the rule lifecycle should produce evidence packs (who, what, when, tests, sign-off).
9. **Third parties and outsourcing.** Confirm requirements for cloud hosting, IdP and notification providers (due diligence, exit plans, location of data).
10. **Operational resilience and incident reporting.** Confirm availability targets, backup/recovery objectives, and any regulatory timelines for reporting security incidents or material operational failures.
11. **Standards alignment (optional).** ISO 27001 / SOC 2 style control mapping, and PCI DSS scope avoidance (do not collect card data).
12. **Rate source terms.** Using a public rate web page programmatically may breach terms; confirm before FR-70.

---

## 4. Security test cases to add to the test strategy

Add as a "Security" and "Abuse" level in policy-engine-design.md §11 and to acceptance tests. Notation: Pass = expected result.

### 4.1 Authentication and session

| ID | Test | Pass |
|---|---|---|
| T-AU-01 | Call every API endpoint without a session or with an expired/forged/wrong-audience token | 401, no data |
| T-AU-02 | Sign in as a user disabled in the IdP while a session exists | Session revoked within the stated window; further calls fail |
| T-AU-03 | Privileged action (approve rule, pause, role grant) without recent MFA | Step-up required; action blocked until completed |
| T-AU-04 | Idle and absolute timeout; logout then reuse the old cookie | Session invalid; server-side invalidation |
| T-AU-05 | Cookie flags and CSRF: submit state-changing request cross-origin without token | Rejected; cookies HttpOnly/Secure/SameSite |
| T-AU-06 | Production build with demo identity flow or placeholder-rule loader | Not available; startup fails if flag set |
| T-AU-07 | Role changed while the user is logged in | New permissions effective on next request; removed roles lose access immediately |

### 4.2 Authorisation, SoD and enumeration

| ID | Test | Pass |
|---|---|---|
| T-AZ-01 | Matrix test: iterate every role x every endpoint x allowed/denied per the machine-readable matrix | Matches matrix exactly; missing permission declaration fails CI |
| T-AZ-02 | Staff user calls reviewer, admin and rule endpoints directly (bypassing the UI) | 403 |
| T-AZ-03 | Author attempts approve/activate own rule version, directly via API, and via second role held by same user | Blocked; audited denial |
| T-AZ-04 | User assigned both author and approver (or admin + approver) | Assignment rejected by role-conflict rule |
| T-AZ-05 | Same person approves and activates the same version | Blocked; needs a different person (SEC-03) |
| T-AZ-06 | Admin grants self a policy role; admin grants role with no second approver | Blocked |
| T-AZ-07 | User with staff+reviewer roles tries to decide their own submitted request or one they edited | Blocked |
| T-AZ-08 | IDOR: Branch A user requests Branch B request ID by direct GET, by search, in list filters, in notification link, in report and audit view, in export | 404/empty everywhere; no differing responses revealing existence |
| T-AZ-09 | Mass assignment: submit body with `branch`, `status`, `version`, `role`, `submittedBy` | Fields ignored or rejected; context built from session |
| T-AZ-10 | Mark rule category as non-regulated when content matches regulated classification | System still requires compliance approval |
| T-AZ-11 | Compliance approves own authored rule; approver approves with compliance flag but is not compliance | Blocked |

### 4.3 Policy engine and rule integrity

| ID | Test | Pass |
|---|---|---|
| T-PE-01 | Rule referencing user identity/ID/branch (in approve rule) | Schema rejects (SEC-05) |
| T-PE-02 | AUTO_APPROVE rule matching one exact amount or one narrow shape in replay | Specificity test fails; cannot be submitted for approval |
| T-PE-03 | Approve rule exceeding the compliance ceiling | Evaluation yields HUMAN_REVIEW via guardrail; rule cannot activate |
| T-PE-04 | Short-lived rule via effective dates; backdated effective_from; activation before minimum shadow time | Rejected |
| T-PE-05 | Modify `mode`, `state`, `conditions`, `outcome` of an approved version via direct SQL as app account, and via API | Denied; only audited stored procedure can change state |
| T-PE-06 | Change rule content after approval but before activation (TOCTOU) | Content hash mismatch blocks activation |
| T-PE-07 | Rule config file modified in a non-demo environment | Ignored/startup failure; only governed store loaded |
| T-PE-08 | Oversized, deeply nested, large `in` list, wrong types, string-for-decimal, `__proto__` field path, unknown operator | Rejected at authoring; if present at runtime, ENGINE_ERROR to HUMAN_REVIEW with no resource exhaustion |
| T-PE-09 | `not` condition with missing field (PLACEHOLDER-002 shape) | MISSING_DATA, not an automated outcome |
| T-PE-10 | Pause HUMAN_REVIEW or AUTO_DECLINE rule as a manager | Not permitted, or results in more human review, never more automation |
| T-PE-11 | Pause then immediately submit; submit concurrently with pause | No automated outcome after pause time (within documented bound); commit-time check works |
| T-PE-12 | Concurrent evaluation while policy version changes | One pinned version recorded; commit asserts version validity |
| T-PE-13 | Placeholder rules in production-flagged environment as ACTIVE approve/decline | Blocked |
| T-PE-14 | Reason template contains numeric threshold or field values | Lint/review fails; generic reasons only |

### 4.4 Threshold evasion and workflow races

| ID | Test | Pass |
|---|---|---|
| T-WF-01 | Submit N small requests for same customer key across staff and branches that cumulatively exceed the limit | Aggregation yields HUMAN_REVIEW at the cumulative threshold |
| T-WF-02 | Submit parallel requests (concurrent threads) near a velocity limit | Counter is atomic; exactly the allowed number is automated |
| T-WF-03 | Probing: 50 resubmissions with varied amounts | Rate limit and anomaly alert; reasons reveal no thresholds |
| T-WF-04 | Edit amount/currency after evaluation or after approval | Rejected, or new revision re-evaluated; previous approval void |
| T-WF-05 | Mark Completed with executed amount greater than approved | Blocked/alerted |
| T-WF-06 | Replay captured approve/decline request (same and different session) | Second attempt rejected; idempotency with different payload rejected |
| T-WF-07 | Two reviewers decide simultaneously; escalate while reviewer decides | Exactly one decision; other gets stale error |
| T-WF-08 | Same idempotency key used by another user | Not shared or leaked |
| T-WF-09 | Resubmission loop to move declined request to a lenient reviewer or queue | Routing not user-selectable; flagged |
| T-WF-10 | Approval after expiry period | Rejected / re-review |

### 4.5 Audit integrity

| ID | Test | Pass |
|---|---|---|
| T-AD-01 | UPDATE/DELETE/TRUNCATE on audit tables with app account and with DB admin role (non-break-glass) | Denied (app) / alerted (admin) |
| T-AD-02 | Alter one audit row in a restored copy, then run chain verification | Detected and located; alert fired |
| T-AD-03 | Delete a tail segment of the chain | Detected by external anchor comparison |
| T-AD-04 | Decision commit with audit store unavailable | Whole transaction fails closed; no unaudited decision |
| T-AD-05 | Replay a decision from stored context snapshot and rule content hashes | Same outcome, same hash (NFR-09, FR-14) |
| T-AD-06 | Audit contents: every event has actor ID, role set, session, correlation, hashes; authN failures, denials, role changes, pause/resume logged | Complete |
| T-AD-07 | Audit viewer access and exports | Scoped by branch/role; access itself audited |
| T-AD-08 | Backup restore drill including the audit store and anchors | Integrity verified after restore |

### 4.6 Web, data and platform

| ID | Test | Pass |
|---|---|---|
| T-WB-01 | Stored XSS payloads in reason, escalation note, more-info message, rule name/description, notification text, request fields | Rendered inert; CSP blocks inline execution; no privileged session leakage |
| T-WB-02 | Security headers and CSP check on all pages; clickjacking attempt | Headers present; framing denied |
| T-WB-03 | Error handling: malformed input, oversized payload, SQL meta characters, unicode/homoglyph in IDs and names | Generic errors; parameterised queries; no stack traces |
| T-WB-04 | Log scan after test run with canary PII values and canary free-text | No canary values in logs, metrics, traces, or notifications |
| T-WB-05 | Notification payloads | Only IDs/status; deep link requires authentication and authorisation |
| T-WB-06 | Rate-limit tests on login, submit, search, simulate, admin endpoints | 429 after threshold; alerts raised |
| T-WB-07 | Simulate/replay endpoints use only synthetic or masked data; no side effects (no audit decisions, no notifications, no counters) | Verified |
| T-WB-08 | Dependency and container scan, secret scan, SBOM presence; build fails on high/critical | CI gate works |
| T-WB-09 | TLS configuration (modern protocols only, HSTS), and no plain HTTP | Pass external scan |
| T-WB-10 | Environment isolation: non-production cannot reach production data or secrets | Verified |
| T-WB-11 | Third-party/rate source (if built): SSRF attempts, malformed data, rate value never reaches rule evaluation | Blocked |

### 4.7 Exercises (non-automated)

- **Red-team tabletop** for A1/A5: an author and an approver conspire to activate a rule benefiting an insider; verify detection (SEC-37 alerts) and recovery (rollback to prior approved policy, review of affected decisions by audit query).
- **Kill-switch drill** before R3: measure time from pause to no automated outcomes; verify who can pause and resume.
- **Pre-pilot penetration test** by an independent party, including authorisation matrix, rule administration, and audit tamper attempts.
- **Access recertification dry run** and **audit restore drill** before pilot.

---

## 5. Suggested sequencing

| Release | Security work that must land |
|---|---|
| R1 Workflow MVP | SSO+MFA design, session controls, deny-by-default authorisation and machine-readable matrix, branch scoping (SEC-12), server-built context (SEC-28), immutable request fields and idempotency (SEC-18), XSS/CSRF/headers (SEC-24), insert-only audit with hash chain and richer events (SEC-10, 11), log allow-list (SEC-31), demo flow gating (SEC-23), secrets/KMS, rate limits, CI supply-chain gates |
| R2 Shadow | Role-conflict matrix and two-person role changes (SEC-01, 02), content-hash approvals and immutability (SEC-08), rule schema limits (SEC-05, 29), system-derived regulated classification (SEC-04), three-valued logic (SEC-22), shadow integrity (SEC-09), simulate controls, security alerts (SEC-37), external audit anchoring |
| R3 Controlled automation (gate) | Guardrail policy (SEC-06), activation two-person rule (SEC-03), monotonic pause and commit-time checks (SEC-13, 19), aggregation and atomic counters (SEC-14, 15), reconciliation of Completed (SEC-17), probing controls (SEC-16), sampling integrity (SEC-27), kill-switch drill, compliance sign-off on section 3.9 items |
| R4 Pilot | Independent pen test, access recertification, restore and chain-verification drills, incident runbook and break-glass (SEC-40), retention and erasure design (SEC-32), vendor due diligence |

**Recommended gate:** no rule may be set ACTIVE (AUTO_APPROVE or AUTO_DECLINE) until SEC-01, 03, 04, 05, 06, 08, 10, 11, 13, 14/15, 17, 19 and 23 are met and the compliance items in §3.9 (1 to 6) have written answers.
