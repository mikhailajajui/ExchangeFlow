# ExchangeFlow Application Project Plan

**Document status:** Draft v0.4, assumption-based. Revised after the core-engine and regulatory reviews in `reviews/` (v0.3 followed the earlier reviews). Dates, team assignments, estimates and decision policies must be confirmed with the business sponsor before baselining.
**Document owner:** Project lead (to be assigned). **Review cadence:** each iteration review.
**Single decision log:** `reviews/ba-review.md` §4. **Requirements:** `PRD.md`. **Platform:** `azure-architecture-proposal.md`. **ADRs:** `docs/adr/README.md`.

### Changes from v0.3

| Change | Why (finding, decision) |
|---|---|
| Target organization is a Canadian credit union (working assumption: Ontario, provincial); regulatory research is advisory and unconfirmed. | Decision of 2026-10-01; REG-MGR-01 |
| New backlog items E2a, E19, E20 and platform items P21 to P23 (§5). | CE-MGR-03; REG-MGR-04/06; ADR-023, ADR-026 |
| REL-1 is provisionally six iterations (It2 to It7): restricted compliance channel and full multi-host core are in REL-1 by the product owner's decision. Later iterations are re-baselined at the end of REL-0. | Decision of 2026-10-01; CE-MGR-01; REG-MGR-06 |
| Risks R22 to R32 added; R12 re-rated High/High. | CE-MGR-08; REG-MGR-08 |
| Go/no-go criteria added for REL-0, REL-3 and REL-4 (§12). | CE-MGR-09; REG-MGR-09 |

## 1. Summary

ExchangeFlow is a proposed desktop web and cloud application that decides, routes and records currency exchange requests. A policy engine evaluates each request and sends it down one of three paths:
- **auto-approve**: the request proceeds immediately;
- **auto-decline**: the request is refused with a recorded, generic reason;
- **human review**: the request is queued for an authorized head-office reviewer.

Front-line staff and reviewers share one workflow. Every decision, whether made by a rule or a person, is recorded with its reason, its responsible actor and the input it was based on.

The decision policies (which requests take which path, and under what thresholds) are owned by the business and will be collected from stakeholders during discovery. The product holds them as versioned, auditable configuration and defaults to human review whenever a request is not clearly covered. ExchangeFlow does not settle funds or replace existing transaction, identity-verification or compliance systems.

This plan:
- organizes the work into releases and iterations;
- sets out the work breakdown, including the platform workstream;
- proposes team responsibilities;
- tracks risks and the go/no-go criteria.

It assumes a small product team (2–3 people) building on Azure Container Apps with synthetic data. The target business, dates, team size, business rules and integrations are not yet confirmed.

## 2. Project Goals and Success Measures

### Goals

- Validate the current approval process and the users' needs before committing to detailed workflow rules.
- Deliver a secure, usable request and review workflow for staff and head-office reviewers.
- Decide routine requests automatically under business-approved policy, so reviewers spend time only on requests that need judgment.
- Keep every automated decision explainable, replayable, pausable and reversible, and fail safe to a human.
- Maintain an accurate, tamper-evident request status and decision history.
- Keep the initial product independent of payment execution and unverified third-party data.
- Assess whether the application reduces coordination effort and improves operational visibility.

### Proposed success measures

Success measures are listed in `PRD.md` §9. Establish current-process baselines with users first. Targets are set with the business after the baseline; none is assumed in this draft.

## 3. Scope and Boundaries

Scope, non-goals and requirements are defined in `PRD.md` §3 and §6. In summary:

**In scope**
- Role-based access with server-enforced role conflicts.
- Request submission, cancellation and completion.
- A policy engine with three paths, shadow mode, safe pause, and a compliance guardrail policy.
- Policy administration with two-person activation.
- Escalation of auto-declines.
- Reviewer queue and decisions.
- Tamper-evident audit.
- In-app notifications.
- Search and operational summaries.
- Sampled review and accuracy monitoring.

**Excluded**
- Payment, settlement or execution of transactions.
- Replacement of existing platforms.
- Machine-learning decisions.
- Any automated rule in production without business approval, shadow mode and two-person sign-off.
- Live rates until confirmed.
- Real customer data before security, privacy and business approval.

## 4. Delivery Approach

Use short iterations with a demonstrable outcome at the end of each one:
1. Begin with discovery and workflow validation, and request platform access in the first week.
2. Build a minimal platform and a thin end-to-end product slice.
3. Add policy governance, then controlled automation, then the pilot.

Keep the backlog prioritized by user value, risk reduction and dependencies. Revisit estimates and scope at each iteration review.

Iteration length is provisionally two weeks. Calendar dates are omitted until a start date and team capacity are known.

### Work item hierarchy

- **Release (REL-n):** a meaningful milestone of product maturity.
- **Use case (UC-nn):** a coherent user goal or cross-cutting project area.
- **Backlog item (E-nn / P-nn):** a story or platform package that can be completed and reviewed in one iteration.
- **Task:** implementation, research, design, deployment, support or validation work, with an owner and an hour estimate.

Each backlog item has a user outcome, acceptance criteria (Given/When/Then for REL-1 are in `reviews/qa-review.md` §5), dependencies, estimate, owner and status. Track effort hours separately from story points.

## 5. Work Breakdown Structure and Backlog

### A. Product capabilities (use cases)

| ID | Capability / use case | Outcomes | Priority | Requirements |
|---|---|---|---|---|
| UC-01 | Submit and track a request | Draft, submit, idempotent retry, status, history, cancel, complete with executed values | Must | FR-01–08, FR-26, FR-27 |
| UC-02 | Review and decide | Queue, details, approve, decline, request information; stale and duplicate protection; no self-decision | Must | FR-20–25, FR-28 |
| UC-03 | Clarify and resubmit | Staff update and resubmit; re-evaluated for the record and always returned to a human | Must | FR-06 |
| UC-04 | Notify users | In-app inbox within 30 s; channels optional later | Should | FR-50–53 |
| UC-05 | Manage users and permissions | Roles in the app, conflict matrix, two-person grants, branch scoping, step-up | Must | FR-60–64 |
| UC-06 | Monitor operations | Workload, aging, outcomes, causes | Should | FR-40, FR-41, FR-46 |
| UC-07 | View indicative rates | Labelled rate from an approved source | Could | FR-70 |
| UC-08 | Evaluate request by policy | Three paths; precedence; shadow isolation; replayable records; guardrail; velocity limits | Must | FR-10–19 |
| UC-09 | Manage decision policy | Draft, approve, simulate, shadow, two-person activation, safe pause, agreement report | Must | FR-30–37 |
| UC-10a | Escalate an auto-decline | Staff escalate once within the window | Must | FR-05 |
| UC-10b | Audit automated decisions | Sampled review, accuracy alert, audit search | Should (Must before activation) | FR-42–45 |

### B. Product backlog items

Points are rough and provisional. These items replace the earlier S1–S6 list.

| ID | Item | Release | Points | Notes |
|---|---|---|---:|---|
| E1 | Define request fields, states, roles and decision rules with users | REL-0 | 3 | Workshop guide `reviews/ba-review.md` §3 |
| E3b | Collect decision policy from stakeholders | REL-0–1 | 3 | Fills every [TBD-Stakeholder] marker |
| E2 | Project structure, conventions, API error format (RFC 9457) | REL-1 | 3 | ADR-001 |
| E3 | Request domain model, transition table as data, revisions, cycles | REL-1 | 5 | ADR-018 |
| E2a | Ports, conformance harness (Testcontainers PG16 + PgBouncer), fake adapters, lint bans on `Date.now()` and random UUIDs outside adapters | REL-1 | 5 | ADR-023; `docs/core-engine-plan.md` |
| E3a | Policy engine: evaluator, precedence, three-valued logic, placeholder rules (non-production); guardrail over all outcomes with tri-state compliance facts (schema) | REL-1 | 8 + 3 | ADR-003/005/006/007/021/025 |
| E20 | Regulatory profile as configuration; compliance fact intake with provenance; reason-text approved set (EN/FR) and lint | REL-1 | 4 | ADR-025/028; FR-82, FR-83 |
| E19 | Restricted compliance channel: role, restricted store, refer action, opaque audit, projection, canary tests | REL-1 | 8–13 | ADR-026; FR-80, FR-81 |
| E4 | Staff submit with idempotency and server-built context | REL-1 | 5 | ADR-011 |
| E5 | Reviewer queue and detail with branch scoping | REL-1 | 5 | FR-62 |
| E6 | Decisions, concurrency, per-object SoD, audit hash chain | REL-1 | 8 | ADR-010/012/015 |
| E7 | Staff status, escalation, resubmission, cancel | REL-1 | 5 | FR-05, FR-06, FR-26 |
| E9 | Users and roles: conflict matrix, two-person grants, BFF session | REL-1 | 5 | ADR-014/015 |
| E8 | In-app inbox notifications via outbox | REL-2 | 3 | ADR-013 |
| E11 | Policy administration: drafts, approvals bound to content hash, simulation, publishing | REL-2 | 8 | FR-30–33 |
| E12 | Pause and resume with commit-time guard; guardrail policy | REL-2 | 5 | FR-18, FR-34, ADR-016 |
| E13 | Shadow agreement report | REL-2 | 3 | FR-37 |
| E14 | Step-up MFA for privileged actions | REL-2 | 2 | FR-64 |
| E15 | Velocity limits with pseudonymous customer key | REL-3 | 5 | FR-19; needs Q5 |
| E16 | Completion reconciliation and expiry | REL-3 | 3 | FR-07, FR-27 |
| E17 | Monitoring dashboards, sampled review, accuracy alert | REL-3 | 5 | FR-40–42, FR-45 |
| E18 | Routing and authority levels | REL-3 | 3 | FR-25; needs Q6 |
| E10 | Validate optional exchange-rate source | REL-4 | 2 | FR-70 |

### C. Platform backlog (from `azure-architecture-proposal.md` §11)

| ID | Package | Release | Size |
|---|---|---|---|
| P1 | Subscription, management group, RBAC and budget requests | REL-0 | S effort, long elapsed |
| P2 | Networking: VNets, private endpoints, private DNS, egress | REL-1 | M |
| P3 | Entra app registrations, Conditional Access baseline, test tenant | REL-1 | S–M |
| P4 | Bicep modules and environment parameters | REL-1 | L |
| P5 | CI/CD with gates, signature verification, migration job | REL-1 | M–L |
| P6 | Container hardening and health probes | REL-1 | S |
| P7 | PostgreSQL roles, insert-only audit grants, PgBouncer, PITR test | REL-1 | M |
| P8 | Observability: telemetry allow-list, two workspaces, alerts | REL-1–2 | M |
| P9 | Security baseline: Azure Policy initiative, Defender, Key Vault | REL-1–2 | M |
| P10 | Front Door Premium, WAF, private link, headers and CSP | REL-2–3 | M |
| P12 | Audit anchor job to immutable Blob in the audit subscription | REL-2 | M |
| P13 | Production environment from IaC; revision release; rollback drill | REL-3 | M |
| P14 | Load test on the perf profile | REL-3 | M |
| P15 | Restore, chain-verification and kill-switch drills | REL-3 | S–M |
| P16 | Runbooks, break-glass, incident procedure, support handover | REL-3–4 | M |
| P17 | Pen test and remediation | REL-4 | M+ |
| P18 | SIEM integration | REL-3 | S–M |
| P19 | DR runbook and drill into Canada East | REL-4 | M |
| P20 | Cost ranges, budgets, later reservations | REL-0, post-pilot | S |
| P21 | Host adapters beyond Container Apps: Functions host, CI leg and feasibility spike with numeric pass criteria (relay lag, p95, double-fire, cold start) | REL-1 (full layout approved) | L |
| P22 | PgBouncer and pool-size test (replicas or instances × pool ≤ server limit; no session-level features) | REL-1 | S–M |
| P23 | VM host wrappers (systemd, cron) | REL-1 (full layout approved) | M |

Platform effort to the pilot is roughly 13–18 person-weeks, which is about 0.4–0.6 of one person over nine iterations (indicative; confirm with IT).

### D. Research, discovery and project support

- Run the policy-elicitation workshops (`reviews/ba-review.md` §3): two sessions, classification template and parameter sheet.
- Map the current workflow; collect baselines for `PRD.md` §9.
- Confirm privacy, retention, residency, audit and security expectations with compliance.
- Obtain privacy approval before any replay on historical decisions (DL-N03). Until then, replay uses synthetic data only.
- Maintain the decision log, risk register, ADRs and release notes; hold planning, review and retrospective every iteration.

## 6. Release Roadmap

Release IDs match `PRD.md` §10. REL-1 grew in v0.4; the iteration numbers shown for REL-2 onward are the v0.3 baseline and are re-baselined at the end of REL-0 once team size and REL-1 capacity are confirmed (estimate: REL-1 adds roughly 9 to 15 person-weeks for the three-host layout and 8 to 13 points for the restricted channel; assumptions in `reviews/core-engine-manager.md` and `reviews/regulatory-manager.md`).

| Release | Iterations | Product goal | Platform goal | Exit |
|---|---|---|---|---|
| **REL-0 Discovery** | It1 | Validate workflow, roles, fields, exceptions; policy workshops; baselines | Request subscriptions, network, identity, budget; sandbox spike; decide AZ-1/3/4/6/9/10/12/14 | Decisions recorded; requests submitted in week 1 |
| **REL-1 Workflow MVP** | It2–It7 (provisional; was It2–It4) | Submit, evaluate with non-production placeholder rules (all three paths in test), escalate, resubmit, review, audit; restricted compliance channel; regulatory profile; guardrail schema | Minimal platform before It3 features; dev (It2) and test (end of It3); all three host adapters and the conformance matrix | End-to-end demo in test; conformance subset green on every host through PgBouncer |
| **REL-2 Policy engine (shadow)** | It5–It6 | Policy administration, guardrail, safe pause, shadow agreement, inbox notifications, step-up | Front Door + WAF in test; anchor job; security alerts | Real draft rules in shadow; pause proven |
| **REL-3 Controlled automation** | It7–It8 | Activation with two-person sign-off; velocity limits; reconciliation; dashboards; sampled review; accuracy alert | Prod subscription and environment; load test; drills; SIEM | First low-risk category active after sign-off; go/no-go for pilot |
| **REL-4 Pilot** | It9+ | Pilot with agreed branches; optional features | Pen test; DR drill; lock immutability once retention is set | Metrics against baseline; production go or no-go |

### Iteration planning details

**Iteration 1 (REL-0) — Validate and request**
- Interview staff, reviewers and an operations owner; draw current and proposed workflows.
- Workshop session A: request types, fields, roles, lifecycle timings (BQ-3/4/5), escalation window.
- Workshop session B: rule categories, thresholds and currencies (BQ-2), guardrails, regulated classes, specificity parameters, agreement threshold.
- Submit subscription, network, identity, licence and budget requests in **week 1** (R15, R21).
- Platform spike in a sandbox: hello-world container, PostgreSQL, Entra sign-in.
- Decide AZ-1/3/4/6/9/10/12/14; write the first ADRs.

**Iteration 2 (REL-1) — Minimal platform and model**
- dev from Bicep with private networking; pipeline to dev; test tenant users.
- Request model, transition table, revisions and cycles; audit roles and hash chain in the first migration.
- Note: platform work takes most of this iteration's capacity. Product feature work starts in It3.

**Iteration 3 (REL-1) — Submit and evaluate**
- Staff submit with idempotency and server-built context.
- Policy engine with placeholder rules (non-production), precedence table and decision-table suite.
- Reviewer queue with branch scoping.
- Test environment by the end of the iteration.

**Iteration 4 (REL-1) — Decide, escalate, resubmit**
- Reviewer decisions with concurrency and per-object separation of duties.
- Escalation, resubmission (always to a human), cancellation.
- Users and roles with the conflict matrix and two-person grants.
- REL-1 demo in test.

**Iteration 5 (REL-2) — Governance**
- Rule drafts, approvals bound to content hash, simulation, publishing a policy version.
- Pause and resume with the commit-time guard; guardrail policy.

**Iteration 6 (REL-2) — Shadow and notifications**
- Shadow agreement report; real draft rules in shadow in test.
- In-app inbox notifications; step-up MFA; Front Door + WAF in test; anchor job.
- Decide AZ-5 (RTO/RPO), AZ-13 (operating model) and NFR-10 retention.

**Iteration 7 (REL-3) — Production readiness**
- Production environment from IaC (zone redundancy, HA, geo backup); revision release and rollback drill.
- Velocity limits and completion reconciliation.
- SIEM integration; break-glass.

**Iteration 8 (REL-3) — Controlled automation**
- Load test on the perf profile; restore and chain-verification drills.
- Dashboards, sampled review, accuracy alert.
- First rule activation after two-person sign-off and compliance co-sign.
- Pilot go/no-go (§12).

## 7. First Implementation Iterations

Items E2, E3, E3a, E4 and E5 form the It2–It3 candidate. The earlier S1–S6 stories map to them as follows: S1 → E9; S2 → E4; S3 → E5; S4 → E6; S5 → E7; S6 → E3a. In the REL-1 demo, placeholder rules may auto-decide in test only (ADR-021).

Break each item into tasks with an owner, hour estimate, dependencies and completion criteria at iteration planning. Record actual effort and brief progress notes as work proceeds. Reduce scope if actual capacity cannot support the iteration goal, and show the capacity used by platform work explicitly.

## 8. Roles and Responsibility Model

Assign people after the team and product owner are confirmed. One person can hold several delivery roles in a small team, but **product roles must respect the conflict matrix** (`PRD.md` FR-60). For example, the same person cannot both write and approve rules.

| Responsibility | Accountable role | Typical contribution |
|---|---|---|
| Product scope and priority | Product owner / business sponsor | Confirms user value, policy decisions, acceptance and release priorities |
| Decision policy | Policy owner (business) with compliance | Defines criteria; co-signs activation of auto-approve rules |
| Guardrails and regulated classes | Compliance | Owns the guardrail policy and classification table |
| Delivery coordination | Project lead | Roadmap, dependencies, iteration goals, decision log, external requests |
| Domain discovery | Business analyst | Workshops, workflow mapping, terminology, traceability |
| User experience | UX lead | Staff and reviewer flows, prototypes, usability sessions |
| Architecture and data | Technical lead / architect | Boundaries, data model, ADRs |
| Platform owner | Named person (AZ-13) | Runs the Azure platform after pilot start: patching base images, alert triage, access reviews, incident response, cost |
| Web and backend development | Developers | Features, tests, adapters |
| Quality | QA lead | Decision-table and property suites, acceptance, quality gates |
| Security | Security owner | Design review, threat model upkeep, pen test, SIEM |
| Risk tracking | Project lead with all owners | Risk board and mitigations |

## 9. Risk Management Plan

Track risks in a shared register with these stages: **Identified → Analyzed → Mitigation Planned → Monitoring → Active → Resolved**. Each item records category, probability, impact, owner, mitigation, trigger, review date and status. Review at every iteration planning and review. Escalate active risks that threaten data safety, authorization, decision integrity or a release goal.

| ID | Category | Risk | P / I | Owner | Mitigation and trigger |
|---|---|---|---|---|---|
| R1 | Product | Actual approval process differs from assumptions | High / High | Business analyst | Validate in It1. *Trigger:* conflicting workflows or missing decision owner |
| R2 | Product | Business rules incomplete or vary by branch or request type | High / High | Policy owner | Rules are business-owned data; `appliesTo` scoping. *Trigger:* unresolved routing or authority rules |
| R3 | Product / Security | More personal or financial data collected than necessary | Medium / High | Privacy | Minimal fields; synthetic data; PII kept out of audit. *Trigger:* request to add sensitive fields |
| R4 | Technical | Duplicate or concurrent actions produce conflicting decisions | Medium / High | Tech lead | `expectedVersion`, unique cycle constraints, idempotency keys. *Trigger:* concurrency test failures |
| R5 | Technical / Operations | Notifications fail or are delayed | Medium / Medium | Tech lead | Outbox with always-on relay; queue is the source of truth; outbox-lag alert |
| R6 | External dependency | Rate information cannot be used as planned | Medium / Medium | Product owner | Optional feature. *Trigger:* no permitted source |
| R7 | Delivery | Existing-system integration expands scope | Medium / High | Project lead | Defer until need is known. *Trigger:* MVP depends on undocumented access |
| R8 | Adoption | Staff see the app as extra work | Medium / High | UX lead | Prototype with users; NFR-11. *Trigger:* repeated feedback |
| R9 | Business | No business owner available to decide policies or accept pilot | Medium / High | Sponsor | Identify early. *Trigger:* unowned policy questions after It1 |
| R10 | Operations | Hosting, support or cost constraints prevent a viable deployment | **Medium** / High | Project lead | Option 2 with App Service fallback; cost ranges before go/no-go. *Trigger:* IT rejects Option 2 |
| R11 | Product / Risk | An automated rule wrongly approves or declines | Medium / High | Policy owner | Shadow, replay, specificity test, guardrail, sampled review, accuracy alert, safe pause. *Trigger:* disagreement or overturned decision |
| R12 | Compliance | Regulation restricts automation for some request types | **High** / High | Compliance | Guardrail policy over all outcomes and regulated classes; link to R27 and R29. *Trigger:* compliance objection |
| R13 | Governance | Rule changes made without proper approval | Medium / High | Policy owner | Content-hash approvals, two-person activation, role conflicts, audit, alerts. *Trigger:* unattributed change |
| R14 | Delivery | Policy criteria not supplied in time | High / Medium | Project lead | Placeholder rules outside prod; workshops in It1. *Trigger:* no criteria by REL-2 |
| R15 | External dependency | Subscription, network or DNS provisioning by IT takes longer than one iteration | High / High | Project lead | Request in It1 week 1; sandbox spike meanwhile; escalate via sponsor. *Trigger:* no subscription by start of It2 |
| R16 | Delivery / Skills | Team lacks Azure platform depth; foundation work crowds out features | Medium / High | Tech lead | Minimal platform scope; pairing with IT cloud team; short-term platform contractor. *Trigger:* minimal platform not done by end of It2 |
| R17 | Architecture | Role source decided late or changed mid-REL-1 | Low / High | Architect | Decided: roles in the app database (AZ-10, ADR-015). *Trigger:* IT insists on Entra groups as the source of truth |
| R18 | Operations | No named owner for platform operations after pilot start | Medium / High | Sponsor | Decide AZ-13 by It6; pilot entry criterion. *Trigger:* REL-4 planning without an on-call owner |
| R19 | Cost | Fixed Azure costs exceed the approved budget, especially in non-prod | Medium / Medium | Project lead + finance | Budget in REL-0; budgets and alerts per environment; defer edge and Defender in dev. *Trigger:* forecast > 120 % |
| R20 | Technical | A creation-time setting is set wrong and forces a rebuild | Medium / High | Tech lead | "Decide before creation" list; reviewed IaC; immutability unlocked until retention is set. *Trigger:* any prod change needing replace |
| R21 | Licensing / Identity | Entra P1/P2 or Defender licences not available | Medium / High | Project lead + identity team | Confirm in REL-0 (AZ-14); fallback app-side step-up. *Trigger:* licence gap after It1 |
| R22 | Architecture | Ports leak host assumptions (for example session-level locks) and one host silently diverges | Medium / Medium | Tech lead | Conformance matrix; PgBouncer container in every run; port rules. *Trigger:* a conformance failure on a port rule |
| R23 | Delivery | Functions cannot meet 2 s p95 or the 10 s relay bound without paid warm instances | Medium / Low while Option 3 is not chosen | Tech lead | Spike P21 with numeric pass criteria. *Trigger:* spike misses a criterion |
| R24 | Delivery | Three hosts and the restricted channel slow REL-1 | High / Medium | Project lead | Provisional six-iteration REL-1; re-baseline at end of REL-0; revisit ADR-023 scope if REL-1 slips more than one iteration. *Trigger:* REL-1 slips |
| R25 | Technical | Pool exhaustion on scale-out | Medium / High | Tech lead | P22; pool caps; connection-saturation alert |
| R26 | Delivery | CI time and conformance maintenance exceed capacity; flaky race tests muted | Medium / Medium | Tech lead + QA | Deterministic barrier failpoints; nightly full suite; no muting without owner sign-off |
| R27 | Compliance | Province or regulator profile unknown or changes, forcing rework of retention, privacy, hosting or reason text | High / High | Compliance + sponsor | Regulatory profile as configuration; DL-N09 in REL-0 exit. *Trigger:* DL-N09 unanswered at end of It1 |
| R28 | Compliance / Delivery | Compliance officer, privacy officer or counsel unavailable; regulatory questions and research verification stall | High / High | Sponsor | Tiered questions; named officers in REL-0 exit; counsel review scheduled. *Trigger:* Tier 1 unanswered after It2 |
| R29 | Compliance | No owner for a reportable trigger; a statutory deadline missed after a request passes through ExchangeFlow | Medium / High | Compliance | Default "ExchangeFlow does not file"; documented handoff in pilot go/no-go. *Trigger:* DL-N15 unanswered by REL-2 |
| R30 | Delivery / Integration | Screening source unavailable or late; no safe auto-approve in REL-3 | Medium / High | Compliance + project lead | Tri-state fact with provenance; approvals stay human-reviewed if no source. *Trigger:* DL-N19 unanswered at start of REL-3 |
| R31 | Security / Compliance | Tipping-off or restricted-topic leakage via reason text, staff UI, notifications, telemetry or metadata | Medium / High | Security owner | Projection, approved reason text, canary tests, E19. *Trigger:* any restricted term in a general field |
| R32 | Compliance | Legislation moves (penalty amendments, FINTRAC enrolment, Bill C-36) after design decisions | Medium / Medium | Compliance | Parameters not literals; re-read the research each release. *Trigger:* new regulator notice |

### Risk review cadence

- At iteration planning: review probability, impact, owners and mitigations relevant to the goal.
- During the iteration: update an item when a trigger occurs, a mitigation completes, or exposure changes.
- At iteration review: record status and next action; close only when the risk is no longer relevant or has been addressed.
- Before any pilot: review security, privacy, business approval, data handling, support and rollback risks with the responsible stakeholders.

## 10. Quality and Release Management

- Define acceptance criteria before implementation begins.
- Run the quality gates in `azure-architecture-proposal.md` §10.4 on every release. They cover:
  - the decision-table suite, property tests and replay;
  - security, accessibility and performance;
  - migration rehearsal with the previous version on the new schema;
  - signature verification, and a manual gate by someone other than the change author.
- Verify authorization at the backend boundary against the machine-readable permission matrix.
- Use synthetic data in every non-production environment. Placeholder rules may auto-decide only there.
- Require these before any rule is activated:
  - two-person sign-off and the agreement threshold;
  - the specificity test and the minimum shadow period;
  - compliance co-sign for regulated classes;
  - a rollback plan (publishing the previous policy version).
- Keep configuration and secrets out of source code.
- Maintain a known-issues list, release notes and rollback instructions.
- Do not label a build production-ready until security, privacy, operational and integration requirements have been reviewed and accepted.

## 11. Project Tracking and Reporting

Use one shared project workspace with:
- a prioritized backlog grouped by use case and platform package;
- iteration boards with owners, points, hours and status;
- the risk register with review history;
- the decision log (`reviews/ba-review.md` §4) and ADRs (`docs/adr/`);
- the release roadmap and current iteration goal.

At each iteration review, report:
- the goal and completed outcomes;
- incomplete items and why;
- capacity spent on platform work versus features;
- actual effort against the estimate;
- new decisions and top risks;
- the next iteration's goal.

Split partially completed work into a traceable completed outcome and a separate backlog item.

## 12. Go/No-Go Checkpoints

**End of REL-0: start building**
1. IT confirms that Option 2 is permitted and gives lead times for subscriptions, network and identity.
2. The non-prod budget for REL-1 to REL-3 and the licences (AZ-14) are approved.
3. AZ-1, AZ-3, AZ-4, AZ-6, AZ-9, AZ-10 and AZ-12 are decided and recorded as ADRs.
4. A product owner, a policy owner and (provisionally) a platform owner are named.
5. The plan shows REL-1 is achievable at the confirmed team size.
6. A cost range per environment exists.
7. The province and regulatory status (DL-N09) are confirmed, and a compliance officer and a privacy officer are named (DL-N10, DL-N26).
8. Tier 1 regulatory questions are answered or a signed default is accepted; a counsel or compliance review of the research is scheduled with a date.
9. ADR-023 is accepted or its scope is explicitly revisited against the REL-1 capacity estimate.

**End of REL-3: start the pilot**
1. AZ-2 residency is confirmed by compliance; NFR-10 retention is set; the privacy impact assessment is approved.
2. AZ-5 (RTO/RPO) and AZ-13 (operating model, on-call) are decided.
3. Load test, restore drill, chain verification and kill-switch drill have passed.
4. SIEM integration and break-glass accounts are working.
5. The pen test is booked.
6. Every active rule has two-person sign-off, a met agreement threshold, and compliance co-sign where regulated.
7. Reporting ownership is documented per trigger (large cash, electronic funds transfer, suspicious transaction, listed-person property), with handoff times.
8. The source and provenance of every guardrail fact is documented and a screening source is named; otherwise approvals stay human-reviewed.
9. The restricted compliance channel is live, the refer route exists on every decline path, and the canary test passes.
10. Retention (NFR-10) is set with provincial rules checked; the region decision (AZ-2, AZ-15) is final, including any Quebec decision.
11. Conformance scenarios for the pause race (1,000 iterations), outbox relay and log canary pass on every deployed host.

**End of REL-4: production**
- Pilot metrics are measured against the baseline.
- The pen test is remediated.
- Support handover is done.
- Business, security, privacy and compliance approve.
- Counsel signs off the pilot scope; the effectiveness-review plan covers the engine.

## 13. Open Questions

All open questions are tracked in the single decision log (`reviews/ba-review.md` §4), with an owner and a default for each. The main ones are summarised in `PRD.md` §13 and `azure-architecture-proposal.md` §14.

Until they are answered, the roadmap is a relative plan. The initial delivery assumption is a standalone, synthetic-data workflow with no money movement.
