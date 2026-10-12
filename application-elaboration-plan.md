# ExchangeFlow Application Elaboration Plan

**Status:** Draft v0.3, revised after the core-engine and regulatory reviews in `reviews/` (v0.2 followed the earlier reviews). REL-1 is provisionally six iterations (It2 to It7): see `application-project-plan.md` §5 and §6, which take precedence. The detailed engine design is `policy-engine-design.md`; requirements are `PRD.md`; hosting is `azure-architecture-proposal.md`; decisions are in `docs/adr/`. Where this plan and those documents differ, they take precedence. This plan covers releases REL-0 and REL-1.

## 1. Purpose

This plan turns the ExchangeFlow proposal into an initial architecture and implementation plan. The elaboration phase should settle the key design decisions, model the most important workflows, and produce a small working increment that demonstrates the application foundation and a complete approval flow.

ExchangeFlow decides, routes and records exchange requests. A policy engine classifies each request as **auto-approve**, **auto-decline** or **human review**; authorized head-office reviewers decide the human-review cases. Policy criteria are business-owned, versioned configuration collected from stakeholders, and any request not clearly covered by a rule goes to a human. ExchangeFlow does not settle currency exchanges or replace existing transaction, identity-verification, or compliance systems.

## 2. Elaboration Objectives

By the end of the initial elaboration iteration, the team should have:

1. Validated the core request and approval workflow with representative users, or documented the assumptions that remain unvalidated.
2. Defined the system boundary, user roles, request lifecycle, and initial functional requirements.
3. Selected and documented an architecture that supports desktop web access, shared cloud state, access control, and an auditable decision history.
4. Designed the key interactions and deployment arrangement.
5. Delivered a working, demonstrable increment using synthetic data: a staff member submits a request, a reviewer records a decision, and the staff member can see the updated status and history.
6. Updated the backlog, effort estimates, risks, and next-iteration priorities based on what was learned.

## 3. System Type and Architecture Direction

### System type

ExchangeFlow is primarily a **workflow and information management system**. It manages requests through defined states, assigns work to authorized users, and maintains records of actions. It also has a transaction-processing aspect because users submit commands that change request state, but it does not process or transfer money.

### Reference application architecture

Use a **workflow / transaction-processing** structure as the reference. It provides a useful checklist for request intake, validation, routing, state transitions, notifications, and durable recording. The system must make each allowed transition explicit and preserve who made a decision and when.

### Architectural pattern

Use a **layered modular monolith** (ADR-001):

- **Desktop web client:** a React single-page app, served by the backend from the same origin.
- **Application/API layer:** a backend-for-frontend session (ADR-014), request use cases, and workflow coordination.
- **Domain layer:** request states as a transition table, per-object authorization, and a pure policy engine.
- **Infrastructure layer:** PostgreSQL (data, outbox and job queue), identity provider integration, and an optional rate adapter.

It keeps business rules testable and central. Separate microservices would add operational complexity without a demonstrated need. The stack is TypeScript, NestJS and PostgreSQL, hosted on Azure Container Apps (provisional, AZ-1).

## 4. High-Level Design Model

### System decomposition

```text
Desktop Web Application (browser)
  ├── Staff experience
  ├── Reviewer experience
  └── Session and API client
             │ HTTPS / JSON
             ▼
Backend Application
  ├── Identity and authorization
  ├── Request management
  ├── Workflow and routing
  ├── Decision policy engine (rules, versions, shadow mode, kill switch)
  ├── Decision and audit history (insert-only, hash-chained)
  ├── Notification coordination (outbox → in-app inbox)
  └── Optional indicative-rate adapter
             │
             ├── PostgreSQL (data, outbox, job queue, sessions)
             ├── Identity provider (Microsoft Entra ID)
             └── Optional approved rate provider
```

### Subsystems and responsibilities

| Subsystem | Main responsibilities | Public boundary / interface |
|---|---|---|
| Web client | Sign-in, request submission, staff request list/detail, reviewer queue/detail, decision entry, status display | Browser interface and HTTPS API client |
| Identity and access | Authenticate users and enforce roles and permissions | Identity provider integration and authorization service |
| Request management | Create, retrieve, search, and update request information | Request API / application service |
| Workflow | Validate state transitions, route requests, manage pending review | Workflow application service and policy interface |
| Decision policy engine | Pure `evaluate(input) → Decision` following the precedence table in `policy-engine-design.md` §4.3: three-valued logic, shadow isolation, safe pause, guardrail; default to human | Evaluation port (no I/O) and rule administration interface |
| Decision and audit | Record decision records with their full input, review decisions, and audit events | Decision service; insert-only, hash-chained audit |
| Notification coordination | Write outbox rows in the decision transaction; an always-on relay writes the in-app inbox | Outbox table and inbox API (polled by the client) |
| Persistence | Store requests, revisions, roles, rules, policy versions, control state, decisions and audit events | Repository interfaces with explicit transactions and row locks |
| Rate integration (optional) | Retrieve and label indicative rates from a verified source | Rate-provider adapter; mock implementation for development |

### Main domain concepts

The full data model is in `policy-engine-design.md` §6.1. In summary:

- **ExchangeRequest** and **RequestRevision:** identifier, submitting branch and user, status, version, cycle, idempotency key; immutable values per revision.
- **DecisionRecord:** one per cycle; outcome, applied outcome, cause, deciding rule version, and the full evaluation input.
- **ReviewDecision:** one final decision per cycle; reviewer, type, reason; linked to the decision record it upholds or overturns.
- **RuleVersion** (immutable content), **PolicyVersion** (immutable manifest of rule versions and modes), **PolicyControl** (revisioned pause state), **GuardrailVersion** (compliance-owned).
- **AuditEvent:** sequence, previous hash, actor and roles, session, target, before and after hashes.
- **User / Role:** identity from Entra ID; roles and branch scope held in the app database (ADR-015).
- **RoutingPolicy:** business-configured criteria for assigning a request to a decision path and review queue. Exact criteria are not yet known and will be collected from stakeholders; the model must not hard-code them.

Sensitive customer information should be minimized. The precise request fields must be agreed with the business before implementation uses real data.

### Initial request lifecycle

The canonical lifecycle is `policy-engine-design.md` §3 (states listed in `PRD.md` §7.2):

```text
Draft ─ submit ─┬─ auto-approve ─→ Approved ─→ Completed / Expired
                ├─ auto-decline ─→ AutoDeclined ─(escalate once)─→ UnderReview
                │                        └─(window lapses)─→ Declined
                └─ human review ─→ UnderReview ─┬→ Approved
                                                ├→ Declined
                                                └→ MoreInfoNeeded ─(resubmit, always human)─→ UnderReview
Any non-terminal state ─→ Cancelled
```

"Submitted" and "Evaluated" are audit events, not states. Every transition records its actor (a named user, or a rule version) and is checked against the transition table. Timings for expiry, cancellation and the escalation window are TBD with stakeholders (BQ-3/4/5).

## 5. Interaction Model: Architecturally Significant Use Cases

### Use case A0: Evaluate request by policy

**Primary actor:** Policy engine (system). **Supporting actor:** Policy owner (defines rules).

1. On submission, the workflow builds the evaluation context on the server, reads the current policy pointer and the control row, and calls the engine.
2. The engine evaluates every active, shadow and paused rule in scope, using three-valued logic, and resolves the outcome by the precedence table in `policy-engine-design.md` §4.3. Several matching rules with the same outcome are fine; the lowest rule ID is recorded as deciding.
3. Shadow rules are evaluated in isolation. Their results are recorded and never change the outcome.
4. Human review results when: the engine is paused or errors; a human-review rule matches; a paused rule would have matched; data is missing; rules conflict; the guardrail rejects an approval; or nothing matches. The cause is recorded.
5. In one transaction, the workflow re-checks the control revision under a lock, then saves the request, the decision record with its full input, the audit event and the outbox row.

**Failure cases designed:** engine error or timeout (human review and alert), conflicting rules, rule published mid-evaluation (pinned version), pause between evaluation and commit (re-evaluate, else human review), database unavailable (503, client retries with the same idempotency key).

### Use case A: Submit and route request

**Primary actor:** Front-line staff.

1. Staff signs in and opens a new request.
2. Client collects the required fields and submits them to the API.
3. API checks the session, loads roles and branch from the database, validates the body against a strict schema, and checks the idempotency key.
4. Workflow service calls the policy engine (use case A0) and applies the returned path (`Approved`, `AutoDeclined` or `UnderReview`).
5. The request, revision, decision record, audit event and outbox row are saved in one transaction.
6. The worker relays the outbox row to the in-app inbox of the reviewer queue or the staff member.
7. API returns the request identifier, status, outcome and generic reason; the client displays confirmation.

**Failure cases designed:** invalid fields (422, data kept), unauthorized user (403), duplicate submission (same response replayed), unavailable database (503, nothing saved), notification failure (decision kept; relay retries).

### Use case B: Review and decide

**Primary actor:** Authorized head-office reviewer.

1. Reviewer signs in and opens the pending queue.
2. Client requests requests visible to that reviewer.
3. Reviewer opens a request and selects approve, decline, or request information, including a reason where policy requires it.
4. API verifies reviewer permission, branch scope, and that the reviewer did not submit or edit the request.
5. Workflow service validates the transition against the transition table and creates the review decision and audit event.
6. They are saved atomically with `expectedVersion`; a stale request returns `409 STALE_REQUEST`, and `UNIQUE(request_id, cycle)` prevents a second final decision.
7. Notification service informs the submitting staff member.
8. Staff sees the result and the recorded history.

**Failure cases to design:** unauthorized decision, stale request, repeated decision submission, concurrent reviewers, and notification delivery failure.

### Use case C: Request clarification and resubmit

1. Reviewer marks the request as `More Information Needed` and records what is missing.
2. System records the reviewer and time, then notifies the submitting staff member.
3. Staff adds the requested information and resubmits, which creates a new request revision.
4. The system re-evaluates the new revision as a new cycle and records the engine result, but the applied outcome is always human review (decision on BQ-1). The request returns to the same queue and, where possible, the same reviewer.

Earlier values are kept as revisions, and the decision history is never overwritten.

### Use case D: Escalate an auto-decline

1. Staff escalates an `AutoDeclined` request once, within the escalation window, with a reason.
2. The system opens a new cycle in `UnderReview` without re-evaluating; the reviewer sees the original decision and its pinned policy version.
3. The reviewer's decision is linked to the original decision record, so overturned auto-declines count against the rule's accuracy.

## 6. Deployment Model

The deployment is specified in `azure-architecture-proposal.md` (recommended: Option 2, Azure Container Apps). In summary:

```text
Staff / Reviewer Workstation
  └── Desktop browser
             │ TLS HTTPS
             ▼
Azure Front Door Premium + WAF
             │ private link
             ▼
Container Apps environment (internal)
  ├── api: SPA + BFF session + API + policy engine
  ├── worker: outbox relay, in-app inbox
  └── jobs: migrate, audit anchor, expiry, sampling, self-checks
             │ private endpoints
             ▼
PostgreSQL Flexible Server · Key Vault · immutable Blob (audit subscription)
```

dev, test, perf and demo environments use synthetic accounts and data only. Production follows the go/no-go in `application-project-plan.md` §12.

## 7. First Product Increment

The initial increment should prove the architectural foundation and one end-to-end request lifecycle. It should be intentionally small and demonstrable.

### Included

- Entra ID sign-in with a server-side session, and distinct staff and reviewer test users (non-prod tenant).
- Staff request creation with a small, agreed set of non-sensitive fields.
- A policy engine with a small placeholder rule set flagged `nonProduction`. In dev, test and demo it shows all three paths (auto-approve, auto-decline, human review); in production such rules are blocked (ADR-021, decision of 2026-10-01).
- Escalation of an auto-decline, request for more information and resubmission (always back to a human), and cancellation.
- Backend API and persistent request storage.
- Reviewer queue and request detail.
- Approve, decline, and request-information actions with reason capture.
- Status history showing actor and timestamp.
- Basic staff status view after a decision.
- Synthetic seed data and a documented local/demo setup.
- Responsive handling for errors and unauthorized actions.

### Deferred unless discovery makes them essential

- Live currency-rate integration.
- Customer-facing account or tracking portal.
- Integration with point-of-sale, accounting, identity verification, or compliance platforms.
- Rule-authoring user interface, shadow-mode reporting, and sampled post-decision review (REL-2 and REL-3). The first increment loads placeholder rules from a seed file into the governed rule store, through the same code path as real rules (ADR-004); the rule source at runtime is always the database.
- Multiple human approval tiers.
- Real policy thresholds (placeholders only until stakeholders supply them).
- Analytics beyond basic counts and request aging.
- Real customer data, payment processing, and transaction execution.

### Increment acceptance checks

- A staff user can submit a valid request and see its identifier and status.
- In test, placeholder requests resolve to auto-approve, auto-decline or human review as configured, with the deciding rule version and full input recorded; replaying a stored decision gives the same result.
- A request that matches no rule, has missing data, or hits an engine failure goes to human review with the right cause.
- Publishing a `nonProduction` automated rule with the production flag set is rejected.
- A staff user can escalate an auto-decline once; a second escalation is rejected.
- A resubmitted request always lands in the reviewer queue.
- Submitting twice with the same idempotency key creates one request.
- An unauthorized role cannot access reviewer actions.
- An authorized reviewer can make one valid decision and cannot decide the same request again through a stale screen.
- Each state change is visible in the request history with actor and timestamp.
- The staff view reflects the persisted decision after refresh or a new session.
- Invalid input and server errors are communicated without losing already-saved request data.

## 8. Initial Backlog and Work Breakdown

The authoritative backlog, including the later items E11–E18 and the platform packages P1–P20, is `application-project-plan.md` §5. The table below covers REL-0 and REL-1. Story points are rough planning estimates, not commitments.

| ID | Product backlog item | Priority | Estimate | Initial dev-task breakdown |
|---|---|---:|---:|---|
| E1 | Define request fields, states, roles, and decision rules with users | Must | 3 points | Interview/observation; write workflow; confirm data minimization; capture unresolved policy questions |
| E2 | Establish project structure, environments, and API conventions | Must | 3 points | Select stack/provider; create repositories and configuration; document run/deploy flow |
| E3 | Create request domain model and persistent storage | Must | 5 points | Define entities and transitions; schema/migrations; repository; seed synthetic data |
| E3a | Decision policy engine with placeholder rules | Must | 8 points | Rule schema v1; pure evaluator with three-valued logic and scope; precedence table; shadow isolation; safe pause; decision record with full input; decision-table and property suites; non-production guard |
| E3b | Collect decision policy from stakeholders | Must | 3 points | Policy workshops with policy owner and compliance; classify request types into the three paths; record thresholds, owners and approval authority; log unresolved items |
| E4 | Submit request from staff web flow | Must | 5 points | Form and validation; API endpoint; authorization; confirmation and error states |
| E5 | Show pending queue and request detail to reviewer | Must | 5 points | Queue query; role restriction; sorting/filters as agreed; detail view |
| E6 | Record decision with audit history and concurrency protection | Must | 8 points | Decision API; transition rules; atomic persistence; version check; history display |
| E7 | Show decision status to submitting staff | Must | 3 points | Staff request list/detail; refresh behavior; empty/error states |
| E8 | In-app inbox notifications via outbox | Should | 3 points | Outbox in the decision transaction; always-on relay; inbox API; polling client (REL-2) |
| E9 | Users, roles and session | Must | 5 points | BFF session; roles and branch in DB; conflict matrix; two-person grants; logging allow-list |
| E10 | Validate optional exchange-rate source | Could | 2 points | Check source availability, terms, update frequency, and API access; otherwise document mock-data decision |

### Suggested iteration order

1. **REL-0 (It1):** E1, E3b, platform requests and decisions. Resolve the lifecycle timings, decision paths and data boundary.
2. **REL-1 (It2):** minimal platform, E2, E3.
3. **REL-1 (It3 onward, provisional through It7):** E2a, E3a, E4, E5, E6, E7, E9, E19, E20 and the host adapters P21 to P23. Demonstrate submission through automated or human decision, escalation, resubmission and staff visibility in test.
4. **REL-2 onward:** E8 and the governance items in the project plan; revisit E10 only if rates are a confirmed requirement.

For each backlog item, record acceptance criteria, owner, dev tasks, estimated hours, actual hours, progress notes, and completion status in the team's chosen project tracker.

## 9. Risks and Responses

| Risk | Impact | Initial response / validation |
|---|---|---|
| Actual approval workflow differs from the assumed flow | Rework or a poor operational fit | Interview staff and reviewers; validate states, fields, roles, and exception paths before fixing the model |
| Business rules are unclear or change by branch/request type | Incorrect routing or unsafe behavior | Keep policy ownership with business stakeholders; model rules explicitly and avoid hard-coded assumptions |
| Sensitive customer/financial information is collected unnecessarily | Privacy and security exposure | Minimize fields; use synthetic data during development; confirm access, retention, and handling requirements before real data |
| An automated rule wrongly approves or declines a request | Financial loss, customer harm, compliance breach | Business-approved transparent rules only; shadow mode, replay and specificity test before activation; guardrail policy; two-person activation; default-to-human; escalation; sampled review; accuracy alert; safe pause |
| Regulation or policy restricts automated decisions for some request types | Non-compliant automation | Review each rule category with compliance; keep restricted types on human review |
| Rule ownership and change control are unclear | Unapproved or drifting rules | Named owner, versioned and approved changes, audited activation |
| Policy criteria arrive late | Policy engine blocked | Configuration-driven engine with placeholder rules; escalate elicitation early |
| Duplicate or concurrent reviewer actions | Conflicting decisions or unreliable history | Enforce server-side state transitions, idempotency where appropriate, and version/concurrency checks |
| Notification provider is delayed or unavailable | Users may miss updates | Treat persisted queue state as authoritative; log delivery status and support retry/fallback |
| Existing system integration is more complex than expected | Scope growth and deployment delay | Keep initial scope standalone; discover integration requirements early and estimate separately |
| UExchange rate page is not a permitted or usable integration source | Rate feature cannot be delivered as assumed | Verify technical access and terms; keep rate display optional and provide clearly labelled mock data |
| Cloud/service costs or organizational deployment constraints | Demo or adoption blocked | Use a small development environment; identify provider constraints and expected costs before commitment |
| Staff adoption is low because of added steps | Limited operational value | Design with front-line users; avoid duplicate data entry where possible; observe a realistic workflow |

Review these risks during each iteration, add new risks as discovered, and record mitigation progress.

## 10. Decisions and Open Questions

All open questions are tracked, with owners and defaults, in the single decision log (`reviews/ba-review.md` §4). The list below is kept for context.

**Decided on 2026-10-01:** a resubmission is always human-reviewed (BQ-1). Placeholder rules may auto-decide only outside production (REL-1 demo scope, ADR-021).


1. **Target operation:** Is this for UExchange specifically, another exchange business, or a general proposal? The current rate-page reference alone does not establish the target organization.
2. **Browser and workstation support:** Which desktop browsers and workstation environments must be supported? Should staff and reviewers use the same web application with role-based views?
3. **Decision policy:** Which exchange scenarios are auto-approved, which are auto-declined, and which need head-office review? What criteria, thresholds and fields decide each, and who owns and approves changes to them?
3a. **Automation limits:** Are any automated approvals or declines restricted by regulation or compliance policy? How are auto-decisions sampled, audited, contested and paused?
4. **Transaction boundary:** After approval (automatic or human), does staff complete the transaction in a separate existing system, or must this application connect to it?
5. **Roles and authority:** Are there multiple reviewer levels, branch-specific permissions, or delegation/escalation rules?
6. **Exceptions and timing:** What happens when no reviewer responds, the request is urgent, or the customer changes/cancels the request?
7. **Notifications:** Which channels are expected (in-app, push, email, SMS), and are customer notifications in scope?
8. **Data and audit:** What customer data is necessary, what must be recorded, and what are retention/access requirements?
9. **Scale and availability:** Approximate branches, users, requests per day, operating hours, and connectivity conditions?
10. **Rates:** Is indicative rate display a required feature? Is UExchange the intended provider, and is an API or other approved access method available?

Until these are answered, the backlog remains provisional. The initial build is a standalone workflow using synthetic data, with placeholder rules that may auto-decide only outside production, no transaction execution and no dependency on live exchange-rate data.

## 11. Elaboration Exit Review

Before moving into broader feature development, review whether:

- The request lifecycle and roles have been validated with users or explicitly accepted as assumptions.
- The architecture, subsystem responsibilities, dependencies, and deployment model are documented and consistent with the implementation.
- The key sequence flows cover successful paths and important authorization, stale-update, and service-failure cases.
- The first increment demonstrates the staff-to-reviewer-to-staff workflow using synthetic data.
- The backlog reflects completed work, remaining work, estimates, and updated priorities.
- Risks and external dependencies have owners or concrete follow-up actions.
- The team has a clear decision on whether live rate information and existing-system integration belong in scope.
