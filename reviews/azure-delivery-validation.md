# ExchangeFlow: Azure Architecture Proposal, Delivery Validation

| | |
|---|---|
| **Reviewed document** | `azure-architecture-proposal.md` (Draft v0.1, 2026-10-01) |
| **Read alongside** | `PRD.md` §8, §10, §11, §13; `application-project-plan.md` §5, §6, §8, §9, §12; `reviews/architecture-review.md` §1, §2, §6; `reviews/security-review.md` §2.4, §5; `reviews/ba-review.md` §0 |
| **Reviewer role** | Delivery lead |
| **Date** | 2026-10-01 |
| **Scope** | Feasibility for a small team, sequencing, external dependencies, effort and cost, delivery risks, and readiness for stakeholders. Technical correctness and security depth are covered by separate reviews, not this one. |

---

## Verdict: **Approve with changes**

Option 2 (Azure Container Apps) is the right direction. It matches the architecture review's stack recommendation (one container on a managed platform, managed PostgreSQL, no Kubernetes). It is also the cheapest of the three options for a small team to operate.

As written, though, the proposal is a **target-state production design with no delivery plan**. It does not say what gets built when, by whom, at what effort, or what has to be requested from IT, security, compliance and finance, and when. Building the full §10 design before R1 would use up most of a 2–3 person team's R1 capacity. Three choices also conflict with settled architecture-review recommendations (role source, SPA hosting, messaging and real-time). These need resolving before Iteration 2.

**Ready for:** architecture and IT review, which is the proposal's stated status.
**Not yet ready for:** a stakeholder go/no-go. See §6 for what is missing.

Severity counts: **High 6 · Medium 9 · Low 4.**

---

## 0. Assumptions used in this validation

| # | Assumption | If wrong |
|---|---|---|
| DA-1 | The team has 2–5 people. The baseline case is **3**: a technical lead (backend + DevOps), a full-stack developer, and a product/UX/BA person who is partly allocated. QA is shared or part-time. The two-person split in `application-project-plan.md` §8 is the lower bound. | At 2 people, platform work competes directly with R1 features (see F-01). At 5 people with a dedicated DevOps engineer, the minimal platform fits comfortably in Iteration 2. |
| DA-2 | The team is made up of TypeScript generalists (architecture review A1) with **working but not deep Azure experience**. No one has run Container Apps, private networking or Entra Conditional Access/PIM in production. | If someone has, reduce the learning multipliers in §4 by about half. |
| DA-3 | The organisation has an existing Entra ID tenant and a central IT or cloud team that controls subscriptions, networking (hub, DNS, firewall) and identity policy (AZ-6 as proposed). | If there is no central team, the project owns the landing zone. Add about 3–4 person-weeks (L) and make it a project deliverable. |
| DA-4 | Iterations last two weeks. Releases map to iterations as follows: R0 = It1; R1 = It2–4 (It2 is the plan's "Foundation"); R2 = It5–6; R3 = It7–8; R4 = It9+. Production readiness comes after R4. | This mapping is inferred because the PRD and the project plan disagree (BA review IC-03). Re-map if IC-03 is resolved differently. |
| DA-5 | Real customer data is used only from R4, and only after privacy and compliance approval (PRD §10, NFR-08). | If real data arrives earlier, the prod environment and its baseline controls move forward with it. |
| DA-6 | External lead times in §3 are typical ranges for a mid-sized regulated organisation. They are **not confirmed** with this organisation's IT. | Replace them with the actual service-level targets once IT is engaged (F-05). |

Effort sizes: **S** ≤ 3 person-days · **M** 1–2 person-weeks · **L** 3–4+ person-weeks. These assume an engineer who has done the task before. Apply the learning multiplier in §4.

---

## 1. Feasibility for a small team

### 1.1 Skills needed per option

The shared foundation (proposal §3) applies to every option and is the **largest** learning load. Choosing the compute option changes only the extra skills needed on top of it.

| Skill area | Option 1: VMs | Option 2: Container Apps | Option 3: Functions | Needed in R1? |
|---|---|---|---|---|
| **Shared: Bicep / IaC** (modules, parameters per environment, what-if, state of drift) | Yes | Yes | Yes | Yes |
| **Shared: Entra** (app registration, app roles, redirect URIs, managed identities, workload federation for CI; Conditional Access and PIM are usually IT-owned) | Yes | Yes | Yes | App registration + managed identity: yes. CA: yes for MFA. PIM: R3. |
| **Shared: PostgreSQL Flexible Server ops** (roles and GRANTs for insert-only audit, migrations under a migrator role, Entra auth for managed identity, PITR restore, connection limits/PgBouncer, major-version upgrades) | Yes | Yes | Yes | Yes (FR-44, SEC-10/11 are R1) |
| **Shared: private networking** (VNet, subnets, private endpoints, **private DNS zones**, hub peering, egress) | Yes | Yes | Yes | Recommended from dev onward (F-03) |
| **Shared: Azure Monitor / KQL, alerts, log redaction** | Yes | Yes | Yes | Basic in R1 (SEC-31) |
| Linux administration, image building (e.g. Packer), patching, VMSS, App Gateway, Bastion | **Yes, deep** | No | No | — |
| Docker/OCI images, ACR, Container Apps concepts (environment, workload profiles, revisions, ingress, KEDA scalers, jobs) | Light (if Docker on VM) | **Yes, moderate** | No | — |
| Functions isolated worker model, **Durable Functions determinism rules**, task hub state, API Management, Flex Consumption networking | No | No | **Yes, deep** | — |

### 1.2 Learning curve (under DA-2)

| Option | Extra ramp-up beyond the shared foundation | Ongoing burden | Delivery view |
|---|---|---|---|
| 1 | Medium. VM tooling is familiar, but doing it *well* (immutable images, zero-downtime VMSS rollouts, patch compliance) is not. | **Highest** (see §4.2) | Not recommended unless IT mandates it and **operates** the VMs. |
| 2 | **Low to medium.** Dockerfiles are standard for TypeScript teams. The Container Apps concepts take about a week to learn. Networking and zone-redundancy settings are the sharp edges (F-03). | Low to medium | **Realistic.** It is the best fit for a 2–5 person team. |
| 3 | High. It needs a re-design into functions, two sources of truth (proposal §6), and a different local-dev and testing model. QA's integration strategy (Testcontainers, fault injection at each commit step) is harder to apply. | Low for operations, **high** for design and test | Not recommended. It would also invalidate parts of the architecture review (modular monolith, single transaction). |

### 1.3 Is Option 2 realistic for R1?

**Yes, conditionally.** All of these must hold:

1. The **R1 platform is scoped down** to a "minimal viable platform" (§2.2). That means dev and test only, and no Front Door Premium, Service Bus, Web PubSub, PIM, prod environment, DR or Sentinel.
2. Subscriptions, network address space and the Entra app registration are **requested in R0**, not in Iteration 2 (§3).
3. AZ-1, AZ-3, AZ-4, AZ-6 and the new AZ-9/AZ-10/AZ-12 are decided **by the end of Iteration 1** (§3.2).
4. One person (normally the technical lead) is planned at **about 50–60% platform work in It2 and about 25% in It3–4**. With 2 people, this reduces R1 feature capacity by roughly a third, so the plan should show that (F-01).

If the team instead tries to build the §10 production design during Iteration 2 (as `application-project-plan.md` §6 currently implies by putting "environments … deployment path" in a single iteration), R1 will slip by an estimated 2–3 iterations.

---

## 2. Sequencing

### 2.1 Platform work mapped to releases and iterations

| Workstream | R0 (It1) | R1 (It2–4) | R2 (It5–6) | R3 (It7–8) | R4 (It9+) | Post-pilot / production readiness |
|---|---|---|---|---|---|---|
| **Decisions** | AZ-1, 3, 4, 6, 9, 10, 12 decided. AZ-2 provisional. Write the ADRs (update ADR-019). | AZ-11 (messaging) by end of It4 | AZ-5 (RTO/RPO), NFR-10 retention, AZ-13 (support model) | AZ-2 confirmed by compliance before prod is built | AZ-7 (SIEM) | AZ-8 (reservations) |
| **Landing zone / subscriptions** | Request non-prod and prod subscriptions (or RGs), management group placement, RBAC groups, budgets | Non-prod in use | — | Prod subscription live | — | — |
| **Networking** | Request IP ranges, hub peering and private DNS approach from the network team | Dev/test VNets, private endpoints, DNS resolution proven in It2 | Egress rules for any external calls | Prod VNet | — | DR-region network (if AZ-5 needs it) |
| **Entra** | Request the app registration and confirm Entra P1/P2 licensing | App roles, redirect URIs, managed identities, CI federated credential, CA (MFA) for test users | Role-conflict and two-person role changes (SEC-01/02) are app-side if AZ-10 = app DB | **PIM for approver/admin before any rule activation** (security gate) | Access recertification | — |
| **IaC (Bicep)** | Spike in a sandbox: hello-world container + PG + Entra sign-in (proposal §13 step 4) | Modules: CAE, ACR, PG, KV, Log Analytics/App Insights, Storage. Dev in It2, test in It3–4. | Front Door + WAF (test). Immutable Blob (unlocked). Service Bus/Web PubSub only if AZ-11 keeps them. | Prod parameter set: zone-redundant CAE, PG HA, geo backup | — | DR restore automation |
| **CI/CD** | Choose the platform (AZ-4); protected main branch | Build, unit and property tests, dependency scan, image build and scan, deploy to dev (It2); test deploy + E2E + manual gate (It3–4) | Decision-replay suite in pipeline; IaC scanning | Prod deploy with revision at 0% traffic, smoke test, traffic shift; rollback drill | — | — |
| **Environments** | — | dev (It2), **test by end of It3** so the R1 demo runs there | test gets the prod-like edge (Front Door/WAF) | **prod (empty, synthetic smoke only)** | Pilot with real data after approval | — |
| **Observability** | — | App Insights/OTel, redaction allow-list (SEC-31), basic NFR-14 alerts | Security alerts (SEC-37) routed to a security mailbox or channel; dashboards | Load test for NFR-01 in test; alert runbooks | SIEM feed (AZ-7) | Sentinel if chosen |
| **Security baselines** | — | Key Vault + managed identity, no public DB, Azure Policy baseline (allowed regions, private endpoints, diagnostics), secret scanning | Defender for Cloud plans on non-prod; WAF rules | Defender on prod; break-glass procedure (SEC-40); restore and hash-chain verification drill | **Independent pen test**, incident runbook, PIA/privacy sign-off | — |
| **Audit anchoring** | — | Insert-only DB role and hash chain (app; SEC-10/11) | External anchor to immutable Blob in **unlocked** mode (SEC R2) | Lock the immutability policy only after NFR-10 retention is decided (F-08) | — | — |
| **Resilience** | — | PITR enabled on every environment | — | Zone redundancy and HA in prod only. Geo-redundant backup set **at prod DB creation**. | Restore drill into Canada East (per AZ-5) | DR region capability; zone redundancy never in non-prod |
| **Cost** | Pricing Calculator estimate for Option 2 + the closest alternative (needs Q9) | Budgets + alerts per environment | Revisit with test-env actuals | Prod budget approved | Collect 1–2 months of usage | Reservations / savings plan (AZ-8) |

### 2.2 Must exist before R1 feature work (start of Iteration 3)

This is the "minimal viable platform". Without it, stories S1–S5 in the project plan's §7 cannot be demonstrated in a shared environment:

1. A dev environment created **from Bicep**, never by hand: Container Apps environment (no zone redundancy), ACR, PostgreSQL Flexible Server (small tier, **private networking**), Key Vault, Log Analytics/App Insights.
2. A pipeline that takes a PR through build, tests, image scan, push and deploy to dev, using OIDC federation (no stored cloud secrets).
3. Entra sign-in working end to end, with distinct staff and reviewer identities (S1) and the agreed role source (AZ-10).
4. Database roles (app, migrator, read-only) and **insert-only grants on audit tables** from the first migration (FR-44 is an R1 requirement).
5. A managed identity from the app to PostgreSQL and Key Vault.
6. Structured logging with the redaction allow-list, so customer-like fields are never logged, even synthetic ones.
7. A test environment (needed by end of It3 for the R1 demo and QA's acceptance runs).

### 2.3 Can be deferred, and to when

| Item | Defer to | Condition / note |
|---|---|---|
| Front Door Premium + WAF + private link | R2 (test), R3 (prod) | In dev, use Container Apps ingress restricted by IP or Entra. It must be in place before any real data (R4). |
| Service Bus | R2, or never | Only if AZ-11 rejects the architecture review's pg-boss outbox (F-04) |
| Web PubSub | R2, or never | FR-50/51 are *Should* priority and scheduled in R2. The architecture review recommends polling. |
| Immutable Blob anchoring | R2 | Matches the security review's sequencing |
| PIM | R3 | Must be live before the first rule activation (security gate) |
| Production environment | R3 (It7) | However, its **creation-time** settings (zone redundancy, geo backup, networking mode) must be decided earlier (F-03) |
| Zone redundancy and PostgreSQL HA in non-prod | Never | This is a cost lever, as the proposal already says |
| DR region (Canada East restore capability beyond geo backup) | R4 / post-pilot | Depends on AZ-5 |
| Microsoft Sentinel / SIEM (AZ-7) | R4 | Interim: Azure Monitor alerts to a security-owned channel (SEC-37) |
| Image *signing enforcement* | R3+ | Signing in CI is cheap, but the deploy step must actually verify it. Otherwise it gives no protection (F-17). |
| Reservations / savings plan (AZ-8) | After 1–2 months of pilot usage | As proposed |
| AKS variant | Not planned | Revisit only on evidence |

---

## 3. External dependencies and lead times

### 3.1 External parties

Lead times are assumptions (DA-6) and must be confirmed with each party.

| Party | What the project needs | Typical lead time | Latest request date | Blocks |
|---|---|---|---|---|
| Cloud / IT platform team | Subscriptions or RGs, management-group placement, RBAC, Azure Policy exemptions if needed | 2–6 weeks | **R0, week 1** | R1 (It2) |
| Network team | Address space, hub peering, private DNS zone integration, firewall egress | 2–4 weeks | R0, week 1 | R1 (It2) |
| Identity team | App registration + admin consent, Conditional Access for MFA, confirmation of P1/P2 licences; later PIM role configuration | 1–2 weeks (registration); 2–4 weeks (CA/PIM changes via change board) | R0 (registration, CA); R2 (PIM) | R1 (sign-in); R3 (activation gate) |
| Security | Design review of this proposal, Defender/Policy baseline agreement, pen test booking, SIEM onboarding | Review 2–4 weeks; pen test 4–8 weeks to book; SIEM 4–8 weeks | Review: R0; pen test: R3 start; SIEM: R3 | R1 (review), R4 (pen test, SIEM) |
| Compliance / privacy | AZ-2 residency confirmation; NFR-10 retention period; privacy impact assessment before real data | 2–6 weeks each; PIA 4–8 weeks | AZ-2: R0; retention: R2; PIA: R3 start | R3 (prod build, lock immutability); R4 (real data) |
| Finance / procurement | Azure consumption budget and cost centre; licence costs (Entra P2, Defender plans); later reservations | 2–6 weeks (budget); 2–4 weeks (reservation purchase) | Budget: R0; reservations: after R4 data | R1 (any spend), post-pilot |
| DNS / certificates | Custom domain and TLS certificate (or Front Door managed certificate approval) | 1–2 weeks | R2 | R3 (prod edge) |
| Change advisory board | Production change approvals | Organisation's cadence | R3 | R3/R4 |
| Business / operations | Q9 volumes and hours, needed for cost estimate and sizing; RTO/RPO (AZ-5) | Discovery (R0) for Q9; R2 for AZ-5 | R0 / R2 | Cost go/no-go; prod build |

### 3.2 Which decisions block which release

| ID | Decision | Blocks | Needed by | Note |
|---|---|---|---|---|
| AZ-1 | Hosting option | **R1** | End of It1 | Every IaC and pipeline task depends on it |
| AZ-2 | Regions and residency | **R1** (soft), **R3/R4** (hard) | Provisional by It1; compliance-confirmed before the prod build (It7) | Dev/test with synthetic data in Canada Central is low-risk. Moving prod later is costly. |
| AZ-3 | IaC tool | **R1** | End of It1 | Follow the org standard if one exists. Bicep and Terraform module investment is not transferable. |
| AZ-4 | CI/CD platform | **R1** | End of It1 | Also decides where federated credentials and approval gates live |
| AZ-5 | RTO and RPO | **R3** (prod creation), R4 (pilot) | It6 | Geo-redundant backup and HA mode are chosen when the prod DB is created (F-03) |
| AZ-6 | Identity tenant | **R1** | End of It1 | Needed for S1 (sign-in) |
| AZ-7 | SIEM integration | **R4** | It8 | Interim alert routing covers R2–R3 |
| AZ-8 | Reservation timing | None | After 1–2 months of pilot | No delivery impact |
| *AZ-9 (new)* | Environment topology: subscriptions vs resource groups; who owns the landing zone | **R1** | End of It1 | The proposal leaves this as "or" in §3 and §10 |
| *AZ-10 (new)* | Role source of truth: Entra groups vs app DB (ADR-015, FR-63) | **R1** | End of It1 | See F-02 |
| *AZ-11 (new)* | Messaging and real-time: Service Bus + Web PubSub vs pg-boss + polling (ADR-002, ADR-013) | **R2** | End of It4 | See F-04 |
| *AZ-12 (new)* | SPA hosting: Static Web Apps vs served by the API container (ADR-020, ADR-014 BFF) | **R1** | End of It1 | See F-04 |
| *AZ-13 (new)* | Operating model: who runs the platform, support hours, on-call, patch/CVE service levels | **R4** | It6 | See F-06 |
| *AZ-14 (new)* | Licensing and budget owner: Entra P1/P2, Defender plans, Azure spend cost centre | **R1** (CA, spend), **R3** (PIM) | R0 | See F-05 |

---

## 4. Cost and effort

### 4.1 Platform work breakdown (Option 2)

| # | Work package | Size | Release | Owner role | Notes |
|---|---|---|---|---|---|
| P1 | Landing zone / subscription requests, RBAC groups, budgets | S team effort, **L elapsed** | R0 | Project lead + tech lead | Waiting time dominates |
| P2 | Networking: VNets, subnets, private endpoints, private DNS, hub integration | M (L if the hub integration is new to IT) | R1 | Tech lead + network team | DNS resolution through the corporate hub is the most common blocker |
| P3 | Entra: app registration, app roles, managed identities, CI federation, CA request | S–M | R1 | Tech lead + identity team | |
| P4 | Bicep modules and per-environment parameters (CAE, ACR, PG, KV, monitoring, storage) | **L** | R1 | Tech lead | Reused for test and prod |
| P5 | CI/CD: build, test, scan, image, deploy dev/test, approval gate | M–L | R1 | Tech lead | |
| P6 | Container hardening: Dockerfile, non-root, pinned base image, health probes | S | R1 | Developer | |
| P7 | PostgreSQL: roles, insert-only grants, migration pipeline, Entra auth, PITR test | M | R1 | Backend dev | Shared with FR-44 work |
| P8 | Observability: OTel/App Insights, redaction allow-list, dashboards, NFR-14 alerts | M | R1–R2 | Backend dev | |
| P9 | Security baseline: Azure Policy, Defender plans, Key Vault, diagnostics, secret scanning | M | R1–R2 | Tech lead + security | |
| P10 | Front Door Premium + WAF + private link + custom domain | M | R2–R3 | Tech lead | |
| P11 | Service Bus + Web PubSub (only if AZ-11 keeps them) | M | R2 | Backend dev | Zero if pg-boss + polling |
| P12 | Immutable Blob anchoring + signed daily anchor job | M | R2 | Backend dev | |
| P13 | Prod environment from IaC (zone-redundant CAE, PG HA, geo backup) + release by revision traffic shift | M | R3 | Tech lead | |
| P14 | Load test for NFR-01 in test | M | R3 | QA + backend | Needs Q9 volumes |
| P15 | Restore, hash-chain verification and kill-switch drills | S–M | R3 | Tech lead + QA | |
| P16 | Runbooks, break-glass, incident procedure, support handover | M | R3–R4 | Tech lead + ops | |
| P17 | Pen test support and remediation | M (remediation unknown) | R4 | Whole team | |
| P18 | SIEM integration (AZ-7) | S–M | R4 | Security + tech lead | |
| P19 | DR restore runbook and test into Canada East | M | R4 / post-pilot | Tech lead | |
| P20 | Cost estimate, budgets, later reservations | S | R0, post-pilot | Project lead + finance | |

**Rough totals** (experienced engineer; multiply by **1.5–2×** under DA-2 for P2–P5, P9, P10, P13):

| Window | Packages | Estimate |
|---|---|---|
| Before R1 feature work (R0–It2) | P1–P7 core | About 4–6 person-weeks (6–10 with learning curve) |
| Rest of R1–R2 | P8–P12 | About 4–6 person-weeks (2–3 fewer if AZ-11 = pg-boss + polling) |
| R3–R4 | P13–P19 | About 5–8 person-weeks plus pen-test remediation |
| **Total platform effort to pilot** | | **About 13–20 person-weeks**, which is about 0.4–0.6 of one FTE over 9 iterations |

### 4.2 Recurring operational effort per option (after pilot start)

| Activity | Option 1 | Option 2 | Option 3 |
|---|---|---|---|
| OS patching, image rebuilds, VMSS rollouts | High (monthly + emergency) | None | None |
| Base image / dependency CVE triage and rebuild | Medium | Medium | Medium (runtime version upgrades) |
| Platform upgrades (runtime, environment, API versions) | Medium | Low | Medium (Functions runtime, Durable extension) |
| Scaling and capacity tuning | Medium (manual) | Low (KEDA rules) | Low (but always-ready tuning) |
| Workflow-state consistency checks (PG vs orchestration) | None | None | **Medium, ongoing** |
| Shared: PG maintenance and major upgrades, Entra access reviews, Defender/alert triage, Key Vault rotation, cost review, backup/restore drills | Same for all | Same for all | Same for all |
| **Indicative ongoing effort** | **0.4–0.6 FTE** | **0.15–0.3 FTE** | **0.2–0.35 FTE** |

These figures are indicative only, under DA-1 to DA-3. The shared row is about 0.1–0.15 FTE of each total. Option 2's advantage is real but moderate. **Choosing Option 2 does not remove the need for a named platform owner** (F-06).

### 4.3 Cloud cost

The proposal deliberately gives no prices (§8), which is reasonable for a draft. For delivery, there are two gaps:

- **Non-prod running cost from It2** is a real expense that needs a budget before anything is provisioned (F-05). Front Door Premium, Defender plans and log ingestion are fixed or semi-fixed costs that don't shrink with low volume. That is another reason to defer Front Door and Defender in dev (§2.3).
- A go/no-go needs at least a **range** per environment (F-10).

---

## 5. Findings

### High

**F-01 (High): No delivery plan for the platform. Iteration 2 cannot hold it.**
`application-project-plan.md` §6 gives "environments … authentication/role foundation … deployment path" to a single iteration. The proposal's §13 says only "build the dev environment before feature work starts in R1". Under DA-1/DA-2, the minimal platform alone is about 6–10 person-weeks (§4.1), which is more than one iteration of a 2–3 person team.
*Change:* Add a platform workstream across It1–It8 (use §2.1), with the minimal-platform exit criteria from §2.2. Show the capacity it takes from R1 features.
*Target files:* `azure-architecture-proposal.md` §13 (replace with a phased plan), `application-project-plan.md` §5B and §6 (Iteration 2 and a platform row per iteration).

**F-02 (High): The role source of truth conflicts with the architecture review and FR-63.**
The proposal maps app roles to **Entra groups** and uses **PIM** for approver/admin elevation (§3, §11). The architecture review (§2 AuthZ, ADR-015) recommends **roles held in the app DB**, so that role changes are audited in-app (FR-63) and separation-of-duties checks are per object. These two models give different R1 scope, different owners for user administration (IT service desk vs app administrator), and different IT lead times for every role change.
*Change:* Raise AZ-10 and decide it in R0 via architect. A hybrid is possible: Entra handles authentication and MFA, the app DB holds roles, and PIM applies only to Azure-plane admin access. Until AZ-10 is decided, FR-60/61/63 cannot be estimated.
*Target files:* `azure-architecture-proposal.md` §3, §11, §12; `reviews/architecture-review.md` ADR-015 (cross-reference only).

**F-03 (High): Settings fixed at creation time are not identified, so deferring them creates rework risk.**
Some choices can't be changed after resources are created, or need a rebuild and data migration to change. Examples: the Container Apps environment type (workload profiles) and its zone redundancy and VNet integration; the PostgreSQL Flexible Server networking mode and geo-redundant backup; Blob immutability once a policy is **locked**. Verify current Azure behaviour for each in a spike. The proposal presents zone redundancy, geo backup and private networking as tuning knobs.
*Change:* Add a "decide before creation" list with the decision owner. Use the same networking model in dev as in prod so that DNS and private-endpoint problems show up in It2, not It7. Tie AZ-5 to the date the prod DB is created.
*Target files:* `azure-architecture-proposal.md` §3, §10 (Environments, Resilience), §12.

**F-04 (High): The proposal adds infrastructure the architecture review explicitly avoided, without justification.**
The architecture review's settled recommendations are: one container serving API + SPA with a same-origin BFF cookie session (ADR-014, ADR-020), a pg-boss outbox with "no Redis, no new infrastructure" (ADR-002, ADR-013), and polling for in-app updates. The proposal instead adds **Static Web Apps** (a separate origin, which affects the cookie/BFF design), **Service Bus** and **Web PubSub**, each with private endpoints, IaC, monitoring and cost. For a small team, each service adds about 1 M work package plus ongoing operations.
*Change:* Default to the architecture review's choices, and add Service Bus or Web PubSub only when a measured need appears (AZ-11, AZ-12). If the proposal keeps them, it should say why the review's reasoning no longer holds. This needs architect review before any IaC is written.
*Target files:* `azure-architecture-proposal.md` §2, §3, §5, §10.

**F-05 (High): External dependencies, licensing and budget are not planned.**
The proposal lists AZ owners but gives no request dates, lead times or licence needs. Entra Conditional Access needs P1. PIM needs P2 or Entra ID Governance. Defender plans and Front Door Premium need a budget owner. Subscription vending and private DNS integration commonly take 2–6 weeks (§3.1). The PRD lists "Hosting environment approved by IT and security" only as a generic dependency.
*Change:* Add a dependency table like §3.1 with request-by dates tied to R0. Add AZ-9 and AZ-14. Submit the subscription, network and app-registration requests in R0 week 1.
*Target files:* `azure-architecture-proposal.md` §12–§13; `PRD.md` §11 (Dependencies); `application-project-plan.md` §9 (new risks, see §5.1 of this review).

**F-06 (High): No platform owner or operating model.**
The proposal's owner is "Technical lead (to be assigned)". `application-project-plan.md` §8 has a "DevOps/security owner" role, but no one is assigned and support hours are undefined (Q9/NFR-03). Option 2 still needs about 0.15–0.3 FTE of ongoing operations (§4.2). It is unclear whether central IT or the product team handles patching of base images, alert triage, access reviews and incident response.
*Change:* Name the accountable platform owner and decide AZ-13 (operating model, support hours, CVE fix service levels) before R4. Add it to the go/no-go criteria.
*Target files:* `azure-architecture-proposal.md` header and §12; `application-project-plan.md` §8.

### Medium

**F-07 (Medium): PRD releases and project-plan iterations are not mapped in the proposal.**
The proposal says "R1–R4". The project plan uses differently named phases (BA review IC-03). Without a shared mapping, "before R1 feature work" is ambiguous.
*Change:* Adopt the DA-4 mapping, or whatever IC-03 resolves to, and reference it.
*Target files:* `azure-architecture-proposal.md` §9, §13; `application-project-plan.md` §6.

**F-08 (Medium): The immutable audit storage lock depends on an undecided retention period.**
A locked time-based immutability policy can't be shortened or removed. NFR-10 retention is [TBD-Stakeholder]. Locking too early or too long is irreversible and has a cost.
*Change:* Use unlocked policies in non-prod and in prod until compliance sets NFR-10. Add "retention decided" as a prerequisite for locking.
*Target files:* `azure-architecture-proposal.md` §3 (Audit anchoring), §12.

**F-09 (Medium): The test environment is described as "production-like topology", but its timing and cost aren't set.**
QA's integration and E2E strategy and the R1 exit demo need test by end of It3. "Production-like" with Front Door Premium and Defender from day one costs money for no R1 benefit.
*Change:* Define the test environment in stages: R1 has a core topology with private networking; R2 adds the edge (Front Door/WAF); R3 adds load-test sizing.
*Target files:* `azure-architecture-proposal.md` §10 (Environments).

**F-10 (Medium): No cost range for the go/no-go.**
"Relative $$" is not enough for a finance decision. Q9 volumes are still open, but a range from low and high scenarios is possible now.
*Change:* Produce Pricing Calculator ranges per environment for Option 2 and the closest alternative under the architecture review's assumption A2 (low/high). Include fixed-cost items (Front Door Premium, Defender, PG HA, log ingestion).
*Target files:* `azure-architecture-proposal.md` §8, §13.

**F-11 (Medium): App Service (Web App for Containers) is missing as a lower-skill variant.**
The architecture review names "Azure Container Apps / App Service". For a 2-person team, App Service may be simpler, with fewer concepts (no environment, KEDA or jobs), and it runs the same container. The comparison should show why Container Apps was chosen over it, particularly for scheduled jobs and the queue-scaled worker.
*Change:* Add App Service to §7 as an Option 2 variant, with one line on what it does and doesn't give.
*Target files:* `azure-architecture-proposal.md` §5, §7.

**F-12 (Medium): The IaC and CI/CD choices are still "either/or", but they block It2.**
AZ-3 and AZ-4 hedge between "Bicep or Terraform" and "GitHub Actions or Azure DevOps". Each choice changes the skills needed, module reuse, and where the approval gate and federated credentials live.
*Change:* Set a decide-by date (end of It1) and a default if no org standard is found.
*Target files:* `azure-architecture-proposal.md` §12.

**F-13 (Medium): The risk register under-rates the hosting risk.**
`application-project-plan.md` R10 rates "hosting, support, or cost constraints" as Low/High. With an enterprise Azure landing zone, Entra licensing and private networking, the probability of delay is at least Medium. The new risks in §5.1 are not in the register.
*Change:* Re-rate R10 to Medium/High and add R15–R21 (§5.1).
*Target files:* `application-project-plan.md` §9.

**F-14 (Medium): PIM timing versus the security gate.**
The security review requires the activation two-person rule and SoD before any rule is ACTIVE (R3 gate). If AZ-10 keeps PIM in scope, its configuration is an identity-team change with 2–4 weeks' lead time.
*Change:* Request PIM configuration by the start of R2, and list it as an R3 entry criterion.
*Target files:* `azure-architecture-proposal.md` §11; `application-project-plan.md` §6 (Iteration 7).

**F-15 (Medium): The load test for the 2 s p95 target has no environment or time slot.**
NFR-01 is a key reason for choosing Option 2 (min replicas). No iteration includes proving it on the Azure topology. Front Door private link and Entra token validation add latency.
*Change:* Add P14 (load test in test, R3) with a Q9-based profile.
*Target files:* `application-project-plan.md` §6 (Iteration 8), §10; `azure-architecture-proposal.md` §10.

### Low

**F-16 (Low): The DR region is described before RTO/RPO exist.**
Geo backup plus restore into Canada East is a reasonable default. Present it as the *minimum* until AZ-5 is decided, and state that a warm standby is out of scope for R1–R4.
*Target files:* `azure-architecture-proposal.md` §10 (Resilience).

**F-17 (Low): Image signing has no verification step.**
Signing in CI gives assurance only if deployment verifies the signature. Either define the verification step (pipeline policy before deploy) or defer signing to R3 and record that in the supply-chain plan.
*Target files:* `azure-architecture-proposal.md` §5, §11.

**F-18 (Low): Next steps lack owners and dates.**
Each step in §13 should have an owner role and a release/iteration.
*Target files:* `azure-architecture-proposal.md` §13.

**F-19 (Low): Status and approval.**
The proposal has no approval table, unlike the PRD §15. Add one for the technical lead, IT, security, compliance and finance, so the go/no-go is recorded.
*Target files:* `azure-architecture-proposal.md` header or a new final section.

### 5.1 New risks to add to the register (`application-project-plan.md` §9)

| ID | Category | Risk | P / I | Owner role | Mitigation and trigger |
|---|---|---|---|---|---|
| R15 | External dependency | Subscription, network or DNS provisioning by central IT takes longer than one iteration, delaying the R1 foundation | High / High | Project lead | Request in R0 week 1; use a sandbox spike for local and hello-world work in the meantime; escalate via sponsor. *Trigger:* no subscription by start of It2. |
| R16 | Delivery / Skills | The team lacks Azure platform depth (private networking, Entra, PG ops), so foundation work overruns and crowds out R1 features | Medium / High | Technical lead | Minimal platform scope (§2.2); time-boxed training or pairing with the IT cloud team; consider a short-term platform contractor for It2. *Trigger:* minimal-platform exit not met by end of It2. |
| R17 | Architecture | The role source (Entra groups vs app DB) is decided late or changed mid-R1, causing auth rework | Medium / High | Technical lead (architect) | Decide AZ-10 in R0; record in an ADR. *Trigger:* S1 starts without an AZ-10 decision. |
| R18 | Operations | No named owner for platform operations after pilot start (patching, CVEs, alerts, access reviews) | Medium / High | Product owner / sponsor | Decide AZ-13 by It6; include in pilot entry criteria. *Trigger:* R4 planning without a named on-call owner. |
| R19 | Cost | Fixed and semi-fixed Azure costs (Front Door Premium, Defender, PG HA, log ingestion) exceed the unapproved budget, especially in non-prod | Medium / Medium | Project lead + finance | Budget approved in R0; budgets and alerts per environment from It2; defer edge and Defender in dev. *Trigger:* forecast > 120% of monthly budget. |
| R20 | Technical | A creation-time setting (zone redundancy, PG networking mode, geo backup, immutability lock) is set wrong and forces a rebuild or data migration | Medium / High | Technical lead | "Decide before creation" checklist (F-03); prod built from reviewed IaC; immutability unlocked until NFR-10 is decided. *Trigger:* any prod resource change needing replace. |
| R21 | Licensing / Identity | Required Entra P1/P2 or Defender licences are not available, delaying MFA/CA (R1) or PIM (R3 gate) | Medium / High | Project lead + identity team | Confirm licences in R0 (AZ-14); fallback: app-side step-up and SoD checks. *Trigger:* licence gap found after It1. |

Also: **re-rate R10** (hosting constraints) from Low/High to **Medium/High**.

---

## 6. Readiness for stakeholders and go/no-go

### 6.1 Is it ready to present?

- **To architecture, IT and security as a direction: yes.** The options analysis is clear and fair, and the recommendation is well reasoned.
- **To business stakeholders and finance for a go/no-go: no.** A go/no-go needs to answer "what will it cost, how long, who runs it, and what could stop us". The proposal currently answers only "what will it look like".

### 6.2 Missing for a go/no-go decision

| # | Missing item | Finding | Who produces it |
|---|---|---|---|
| 1 | Cost range per environment (low/high volume), including fixed-cost items, plus the non-prod monthly run-rate from It2 | F-10 | Technical lead + finance (needs Q9 or A2 assumptions) |
| 2 | Phased platform plan mapped to R0–R4 with effort and capacity impact on R1 | F-01, F-07 | Delivery lead + technical lead |
| 3 | Resolution of the conflicts with the architecture review (role source, SPA hosting, messaging/real-time) | F-02, F-04 | Architect |
| 4 | External dependency plan with request dates; licence and budget confirmation | F-05 | Project lead |
| 5 | Named platform owner and operating model (support hours, on-call, CVE service levels) | F-06 | Sponsor + IT |
| 6 | IT confirmation that Option 2 is permitted (no IaaS mandate, no existing shared AKS/App Service platform that must be used) and that an org IaC/CI standard exists or not | F-11, F-12 | IT |
| 7 | Compliance confirmation of residency (AZ-2), or explicit acceptance as an assumption until R3 | §3.2 | Compliance |
| 8 | Approval record | F-19 | Technical lead |

**Recommended go/no-go criteria.** Proceed with Option 2 if all of these hold:

1. IT confirms that Option 2 is permitted, and confirms subscription and network lead times.
2. The non-prod budget for R1–R3 is approved.
3. AZ-1, 3, 4, 6, 9, 10 and 12 are decided.
4. A platform owner is named.
5. The phased plan shows R1 still achievable within the agreed iterations at the confirmed team size.
