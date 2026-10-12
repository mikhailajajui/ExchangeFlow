# ExchangeFlow: project guide for Claude

Read this first. It gives the whole context: what the product is, what exists, what is decided, what is still open, how the repo is organised, and how to work in it. Code-level guidance is in `exchangeflow/CLAUDE.md`.

## 1. What this is

ExchangeFlow is a desktop web application that decides, routes and records currency-exchange requests at a **Canadian credit union**. A rule-based policy engine sends each request down one of three paths:

- **auto-approve**: the request proceeds without a person;
- **auto-decline**: refused with a generic recorded reason, escalatable **once** by the teller;
- **human review**: a head-office reviewer decides (the safe default whenever the engine is unsure).

It **never moves money**. Staff complete the transaction in the existing system and record what they did. It is an industry-standard product project, not a course assignment.

**Users and roles** (roles and branch scope live in the app database; the identity provider only authenticates):

| Role | Does |
|---|---|
| Staff (teller) | Creates, submits, escalates, resubmits, cancels, completes requests for their own branch |
| Reviewer (head office) | Decides the review queue: approve, decline, request information. Cannot decide a request they submitted |
| Policy approver / Manager / Compliance | Engine panel (pause, resume); manager and compliance can open requests; policy approver cannot open requests |
| Administrator, policy author, policy owner | Designed (PRD, design §7) but not built in the local build |

**Target organization:** working assumption, **not confirmed**: Alterna Savings, an Ontario credit union regulated provincially (FSRA). It is recorded only as the provisional answer to DL-N09. The repo and the UI palette follow that assumption; brand use needs Alterna's sign-off (DL-N37). Treat every compliance value as `[TBD-Stakeholder]`. Do not invent regulatory thresholds. Do not cite a research claim as a requirement until counsel confirms it.

## 2. Status (2026-10-02)

| Area | State |
|---|---|
| Product docs | PRD v0.3, `policy-engine-design.md` v0.3, `azure-architecture-proposal.md` v0.3, `application-project-plan.md` v0.4, `docs/core-engine-plan.md` v0.2, ADR-001 to ADR-028. Draft level, reviewed by five agent roles |
| Regulatory research | `docs/research/canada-credit-union-fx-requirements.md`: a snapshot, advisory, read mostly through summaries, **not** checked by compliance or counsel |
| **Running code** | `exchangeflow/`: a local **walking skeleton** (not production): decision engine, workflow, PostgreSQL, API, teller and reviewer UI, live rate quote. About 157 passing tests |
| **Branch desk** (2026-10-12) | `exchangeflow/apps/teller-lite/`: interim one-page teller check-and-print tool on the shared engine, head-office JSON rules file, no database or sign-in, loopback only. ADR-029 (accepted; scoped deviation from ADR-021 for this tool only). 64 tests. Team review in `reviews/desk-*.md`; stakeholder PRD `docs/branch-desk-prd.md`; open items DL-N42 to DL-N49 |
| UI design | `docs/ui-design/`: "the slip and the ledger", Alterna palette and Inter, form refinements extracted from Alterna's contact page. Applied to the app except the latest form refinements (not applied; see section 8) |
| Cloud | None. No Azure resources, IaC or pipeline exist |

## 3. How to run the local build

```bash
cd exchangeflow && pnpm install && pnpm dev     # database 54320, API 3001, web 5173
```

Open http://localhost:5173 and pick a dev user (Teller Toronto or Ottawa, Head-office reviewer, Policy approver, Manager Toronto, Compliance officer). `pnpm test` runs engine and integration tests against a throwaway PostgreSQL. `pnpm db:reset` clears local data (stop dev first). No Docker is needed; PostgreSQL 16 binaries come from npm. Details in `exchangeflow/README.md`.

## 4. What the build does

- **Engine** (`packages/policy-core`): pure `evaluate(input) → Decision`: three-valued logic, rule scope, fixed precedence table, shadow isolation, pause, **guardrail over every automated outcome with tri-state compliance facts** (ADR-025), deterministic step budget, canonical hashing, resubmission floor.
- **Workflow**: transition table as data; strict request validation (decimal strings, minor units); context built server-side only.
- **Use cases** (`packages/app-services`): lock-first evaluation (control row `FOR SHARE`, ADR-027), decision, state, audit and outbox in one transaction, idempotent submit, per-object separation of duties, branch scope (out of scope is 404), pause and resume.
- **Database** (`packages/adapter-postgres`): schema, hash-chained insert-only audit with a head row, outbox relay into an in-app inbox, sessions, quotes, completions, seed.
- **Rate quote** (`packages/adapter-rates`): the amount the teller gives the member, from the uexchange.ca feed (see section 6).
- **API** (`apps/api`, NestJS): server-side session cookie, CSRF double-submit, RFC 9457 problems with stable codes, strict security headers.
- **UI** (`apps/web`, React + Vite): teller list, new-request form with live estimate, outcome docket, request detail with history, completion block; reviewer queue and decision; engine panel; notification bell.

**Not built:** restricted compliance channel and "refer to compliance" (ADR-026), Entra sign-in, policy administration and shadow reports, velocity limits, expiry and escalation-window sweeps (gated by BQ-3/4/5), Functions and VM hosts, Azure, French reason text, real rules and field list.

## 5. Source ranking

When documents disagree, the higher one wins:

1. Decisions recorded in `docs/adr/` with status **Accepted**, and dated decisions in the documents below
2. `policy-engine-design.md` (engine behaviour, data model, lifecycle, permission matrix)
3. `PRD.md` (requirements FR-xx / NFR-xx, release plan)
4. `azure-architecture-proposal.md` (hosting, platform, pipeline, security mapping)
5. `application-project-plan.md` (backlog E-xx / P-xx, iterations, risks R1 to R32, go/no-go)
6. `application-elaboration-plan.md` (REL-0/REL-1 view; defers to the above)
7. `docs/core-engine-plan.md` and `docs/ui-design/*` (derive from the above; they win only on their own topic: ports and invariants, visual design)
8. `project-brain-stoming.md` (original proposal)
9. `reviews/*.md`: **point-in-time review snapshots**. Use them for rationale and test vectors, not as current truth. Do not edit them, with one exception: `reviews/ba-review.md` §4 is the live decision log.
10. `docs/research/*` and `visual_design/*`: reference material with **no authority** over requirements or design.

`template/` holds course templates and an unrelated brief (`template/insiption_plan.md`). Ignore it for product work.

## 6. Settled decisions (do not re-litigate)

**Stack:** TypeScript modular monolith (NestJS), React + Vite SPA, PostgreSQL 16 (also outbox and job queue; pg-boss planned), in-house JSON-AST rule evaluator. ADR-001 to ADR-020.

**Engine:** `evaluate(input)` is pure over `{context, policy, control, asOf, engineVersion, compliance}`. Pause is monotonically safe. Fallback precedence is fixed (`policy-engine-design.md` §4.3). The full input is stored on every decision so it can be replayed.

**Accepted by the product owner:**
- ADR-021: placeholder (`nonProduction`) rules may auto-decide only outside production.
- ADR-022: a resubmission is re-evaluated for the record but always goes to human review.
- ADR-023 scope: build the full three-host layout (VM, Container Apps, Functions) behind one hosting-agnostic core. REL-1 is provisionally six iterations.
- ADR-025: the compliance guardrail covers every automated outcome and reads tri-state compliance facts that ordinary rules cannot use.
- ADR-026: a restricted compliance channel is built in REL-1 (scope accepted; design details proposed).
- **2026-10-02:** the rate source is the **uexchange.ca public feed, entry id 20 (USD)**; the **member's name is recorded** (overriding the references-only default DL-N11 for the name only); the amount to give is **rounded down to the cent**.

**Proposed, not yet accepted:** ADR-023 (core with ports), ADR-024 (no Durable Functions), ADR-027 (lock first, then evaluate), ADR-028 (regulatory profile as configuration).

**Auth:** Entra ID with a BFF server-side session cookie; roles and branch in the app database. Local build uses a dev picker (dev only, gated out of production builds).

**Hosting (proposed):** Azure Container Apps in Canada Central; App Service fallback. VMs and Functions compared, not recommended. Service Bus, Web PubSub and Static Web Apps removed in v0.2.

**Rate and quote rules:** the feed ignores its `id` parameter, so select entry `'20'` from the list. Entry 20 has `buy_value` and `sell_value` in CAD per 1 USD. Member sells CAD for USD: give = amount ÷ sell value. Member sells USD for CAD: give = amount × buy value. Only the CAD/USD pair has a quote. Rates are indicative, fetched server-side from an allow-listed host, stored with the request, and **never used in rule evaluation**. The feed's terms of use are unconfirmed (Q10, DL-N40). The feed's `round_up` field is undocumented; do not use it.

**Releases and IDs:** `REL-0` to `REL-4`. Risks `R1` to `R32`. Do not write "R1" to mean a release. Decision-log IDs: Q, D, BQ, DL-N01 to DL-N40.

## 7. Open decisions that matter now (live list: `reviews/ba-review.md` §4)

- **DL-N09** province and federal or provincial status (provisional: Ontario); **DL-N10** compliance officer and counsel review; DL-N26 privacy officer. These gate the rest.
- **DL-N33, DL-N34, DL-N36** block UI sign-off: wording for "refer to compliance", who approves the reason texts, the completion tolerance.
- **DL-N37** brand use and visual extras (dark theme, stamp animation, third font); **DL-N38** French interface scope.
- **DL-N39** retention and handling of the stored member name; **DL-N40** rate source terms, lock at submit versus refresh, rounding policy.
- BQ-3, BQ-4, BQ-5 (approval expiry, cancellation, escalation window) gate the sweeps and cancel timing; BQ-7 retention.

## 8. Next work

1. **REL-0 exit items:** confirm province and regulatory status, name the compliance and privacy officers, answer Tier 1 regulatory questions, schedule counsel review of the research, re-baseline REL-1 capacity (R24).
2. **Apply the latest form refinements** from `docs/ui-design/ui-design.md` hand-off checklist (`styles.css`, `ui.tsx`, `App.tsx`, `RequestForm.tsx`, six size tokens), then check in a browser (light, dark, narrow window, keyboard).
3. **Restricted compliance channel** (ADR-026): referral action, restricted store, compliance role, opaque audit, projection for general readers, canary tests.
4. **Regulatory research follow-up:** Ontario text (credit union act, FSRA guidance), SEMA, JVCFOA, UN Act regulations, Criminal Code s.83.08, FINTRAC directives. Keep a claim register.
5. **Accept or revise** ADR-023, 024, 027, 028; settle DL-N28 to DL-N30.
6. Then Entra sign-in, policy administration and shadow reporting, the other hosts, and infrastructure.

## 9. Repository map

| Path | What |
|---|---|
| `PRD.md`, `policy-engine-design.md`, `azure-architecture-proposal.md`, `application-project-plan.md`, `application-elaboration-plan.md`, `project-brain-stoming.md` | Main documents, each starting with a "Changes from vN" table |
| `docs/adr/` | ADR-001 to ADR-028, ADR-AZ-1 to AZ-8, and `README.md` (index) |
| `docs/core-engine-plan.md` | Hosting-agnostic core, ports, invariants (INV-*), conformance suite (`CS-xx`), sequencing |
| `docs/research/` | Canadian credit union FX regulatory research (advisory) |
| `docs/ui-design/` | `ui-design.md` (spec), `tokens.css`, `screens.html` (static reference), `alterna-ui-extraction.md`, `contrast.py`, `alterna-contrast.py` |
| `visual_design/` | The owner's own design references: Alterna and Tandia extractions and a COB calculator theme. Reference only. `app-ui.tokens.css` belongs to another project: do not merge its token names with ours. Tandia and the KPI/help files are out of scope |
| `reviews/` | Review snapshots: architecture, security, qa, ba, Azure validations, core-engine-*, regulatory-*, ui-* |
| `diagrams/` | `generate_azure_drawio.py` generates `azure-architecture.drawio` |
| `exchangeflow/` | The local build (pnpm workspace). See `exchangeflow/CLAUDE.md` |
| `.claude/agents/`, `agents/` | Agent definitions. `.claude/agents/` is the active set (includes `security-reviewer`); `agents/` is an older copy without it |
| `template/` | Course templates; ignore |

## 10. Conventions

- Documents are Markdown with **Mermaid** diagrams. Do not use Visual Paradigm.
- draw.io diagrams are generated, not hand-edited: edit and run `python3 diagrams/generate_azure_drawio.py`. Icon paths must exist under `img/lib/azure2/` in the jgraph/drawio repo; check with curl, because Python's SSL store fails here.
- New decisions go in a new ADR in `docs/adr/` and a row in `docs/adr/README.md`. Supersede an accepted ADR; do not edit it.
- The open questions and decision log live in one place: `reviews/ba-review.md` §4. Other docs reference it.
- Values the business must supply are tagged `[TBD-Stakeholder]`. Unconfirmed Azure facts and unverified research claims are tagged **verify**.
- Each revised document starts with a "Changes from vN" table that cites review finding IDs.
- **Money** is always a decimal string plus an ISO 4217 currency, never a float (display formatting only). **Times** are UTC instants; each branch has an IANA zone.
- **User-visible copy:** plain, sentence case, active verbs, consistent action names (the teller action after an auto-decline is "Escalate"). Never use the words suspicion, sanctions, PEP, FINTRAC or screening in any user-visible text. Reason text comes from an approved set. Raw routing codes are never shown.
- **Privacy:** the member name lives only in the request revision. It must stay out of rules, evaluation context, decision snapshot, audit rows, outbox and inbox text, logs, error bodies and URLs.
- **Web:** self-hosted fonts only (no Google Fonts or other third-party requests); no inline `style=` attributes; no `dangerouslySetInnerHTML`; status is never conveyed by colour alone; orange (Alterna accent) never carries a status meaning.
- **Security headers and production hardening** are in place; `EF_ENV` defaults to `prod` (fail closed).

## 11. How to work here

- **Team agents** (`.claude/agents/`):

| Agent | Use for | Notes |
|---|---|---|
| `architect` | Behaviour, data model, invariants before code | Writes reviews |
| `ba` | Requirements, traceability, stakeholder questions, owns the decision log | Writes reviews |
| `security-reviewer` | Threat models, security review of designs and code | **No write tool**: the main session saves its findings to `reviews/<name>.md` |
| `qa` | Testability audits, decision tables, contrast checks | Cannot run a browser |
| `manager` | Sequencing, feasibility, risks, go/no-go | Writes reviews |
| `sr-dev` | Implementing settled behaviour with tests | Edits only the paths it is given; cannot open a browser |
| `ui-designer` | Visual design, extraction of reference UIs, tokens | Writes only under `docs/ui-design/`; no product code |
| `doc-writer` | User manual and coverage reports | |

- **Pattern that worked:** run several agents in parallel, each writing only to its own file; the main session consolidates, asks the user to decide, applies the fixes, then **verifies independently** (run the tests, typecheck, and look in a real browser). Give each agent explicit file ownership so edits never collide, and write conflict resolutions into the prompt when a design and a review disagree.
- **Ask before** changing something the design settled, adding personal data, or publishing anything. Record every product-owner decision with its date in the decision log and the relevant document.
- **Verify, do not trust summaries.** Web-fetch summaries have been wrong (Alterna's accent colour was reported as teal; the raw CSS showed orange). Read raw CSS or JSON for values. A test vector in this project was wrong once (500.00 CAD at 1.4499 is 344.85, not 344.84); check arithmetic independently.
- **Honest reporting:** say what was not checked (for example, screens not viewed, no automated accessibility tests, third-party terms unconfirmed).

## 12. Environment gotchas

- No Docker and no system PostgreSQL. `embedded-postgres` needs its build script allowed in `exchangeflow/pnpm-workspace.yaml` (the `@embedded-postgres/*` entries) or the native libraries are missing.
- macOS `sed -i` differs from GNU; use Python or the Edit tool for in-place edits.
- The shell working directory resets between commands; use absolute paths.
- Vite hot reload resets React form state when a file is saved; do not edit web files while testing a form.
- The API runs with `tsx watch` and `EF_ENV=dev`; if it dies, `pnpm api` restarts it.
- The browser extension's tab group can change between turns; call `tabs_context_mcp` for fresh tab IDs.
