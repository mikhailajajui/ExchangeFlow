# Delivery review: `docs/core-engine-plan.md` v0.1 (manager)

**Reviewer:** manager (delivery lead). **Date:** 2026-10-01. **Snapshot review**; does not edit the plan.
**Compared with:** `application-project-plan.md` v0.3 (§5 backlog, §6 releases, §9 risks, §12 go/no-go), `application-elaboration-plan.md`, `azure-architecture-proposal.md`, CLAUDE.md settled decisions.

**Estimation assumptions (all flagged, none confirmed):** team 2–3 people (project plan §1); iteration 2 weeks (§4); 1 story point is about 1 to 1.5 person-days (the plans give no velocity); focus factor 70 percent; REL-1 platform work is 6 to 9 person-weeks of the 13 to 18 to pilot (front-loaded; the plan says It2 is mostly platform, §6). Treat every number below as a planning prompt, not a commitment.

## Verdict

The core design (ports, invariants, conformance suite on one host) is sound and mostly protects the project. The **sequencing is not feasible as written** for a 2–3 person team, and the **multi-host matrix should be deferred** except for cheap static guards. REL-1 is already tight before this plan; this plan adds roughly 14 to 22 points to it.

## Findings

### CE-MGR-01 · High · Plan §9 contradicts the project plan's iteration placement and overloads It2

- **Evidence:** `core-engine-plan.md` §9 puts E2, E2a, E3a, E3 in "It1–It2" and E4, E9, E6 in "It2–It3". `application-project-plan.md` §6 and §7 put E2/E3 in It2, E3a/E4/E5 in It3, E6/E7/E9 in It4, and say It2 "takes most of this iteration's capacity" for platform. It1 is REL-0 (discovery; no build).
- **Why it matters:** about 44 points sit in REL-1 (E2 3, E3 5, E3a 8, E4 5, E5 5, E6 8, E7 5, E9 5). Under the assumptions above, 3 iterations give about 52 person-days (2.5 FTE) to 63 (3 FTE) after focus factor, of which 30 to 45 go to REL-1 platform. That leaves roughly 10 to 33 person-days for 44 to 66 person-days of features. This risk already exists (R16), but the plan moves more work earlier and adds E2a.
- **Fix:**
  1. Do not adopt §9 iteration placement. Keep the project plan's placement and add E2a inside E2 (It2), not as a separate pre-requisite.
  2. Make the REL-0 go/no-go item 5 ("REL-1 achievable at confirmed team size", §12) a real capacity calculation using the table in this file, and re-baseline after It2 velocity is known.
  3. Plan for REL-1 as It2–It5 (4 iterations) if the team is 2 people, or keep 3 iterations only with 3 full-time developers or the platform contractor already named in R16.

### CE-MGR-02 · High · REL-1 scope growth hidden inside "invariants" and "conformance"

- **Evidence:** §5 and §7.1 assign INV-TX-1, INV-CTRL-1, INV-IDEM-1, INV-PLACEHOLDER-1, INV-AUD-1, INV-LOG-1 and scenarios S-01 to S-13 to items that are REL-1. INV-CTRL-1 and the S-05 race (§9 row 5 and row 9) belong to pause and the control row (E12, REL-2 in project plan §5B). INV-LOG-1 canary test (S-11) and the INV-PLACEHOLDER-1 Sev-1 self-check need alerts (P8, REL-1–2). INV-OUT-1/S-08 is E8 (REL-2). Anchoring needs `AnchorWriter` and `adapter-azure` (P12, REL-2).
- **Fix (REL-1 conformance subset):** S-01, S-02 (transaction fault injection), S-03 (idempotency), S-04 (resubmission floor), S-06 (concurrent decisions), S-07 (escalation once), S-13 (SoD), S-10 (grants and chain) and the INV-PLACEHOLDER-1 start-up refusal (cheap; required by ADR-021). Add a control row with `lockShared` in E4 so the commit-time guard has its table, but move S-05 (1,000 iterations) to REL-2 with E12. Defer S-08, S-11, S-12, `AnchorWriter` and `adapter-azure` to REL-2. State this subset explicitly in the plan.

### CE-MGR-03 · High · The multi-host matrix adds cost that should be deferred

- **Evidence:** §6, §7.2, §7.3 and §9 rows 12 to 14. Functions needs its own HTTP translation, a route-manifest generator, a timer-driven relay loop (pg-boss "not run inside Functions", §6.1), APIM, `func` Core Tools plus Azurite in CI, an always-ready plan to meet NFR-01 and INV-OUT-1 (§6.2), and a separate migration step. The VM leg is the same image with wrappers. CLAUDE.md and ADR-AZ-1 settle Container Apps; Functions was compared and not recommended. §1 itself says the decision is not reopened.
- **Cost estimate (assumption):** `hosts/functions` plus `HostDriver` for it plus Functions-specific job scheduler shim: 6 to 10 person-weeks; recurring CI maintenance about 5 to 10 percent of one developer; feasibility spike P-new-1: 2 to 3 person-weeks; VM wrappers (P-new-3): 1 to 2 person-weeks. A cross-host equivalence check is meaningless with one deployed host.
- **Fix:**
  1. Keep the ports, dependency-cruiser rules, the ban on session-level Postgres features, Clock/IdGenerator injection, and the PgBouncer test container. These are cheap and deliver most of the portability.
  2. Defer `hosts/functions`, the Functions CI leg, the nightly Functions run, P-new-1 and P-new-3 until a **trigger** occurs (IT rejects Option 2 and App Service; cost review fails; sponsor request). Record the triggers in ADR-023.
  3. Remove the `vm` matrix leg (identical image to ACA) and the cross-host equivalence gate until a second host exists.
  4. Treat the `JobScheduler` port (with `withLease` and a timer shim) as ACA/pg-boss only for now; add the shim when the trigger fires.
  5. Replace R24's mitigation ("other hosts run nightly") with "other hosts do not exist until triggered".

### CE-MGR-04 · Medium · Package and port count is heavy for 2–3 people

- **Evidence:** §2 lists 8 packages, 3 hosts, 1 app; §4 lists 14 ports and types; dependency rules for each.
- **Fix:** start with four deployable units: `policy-core` (hard boundary, pure), `workflow-core`, `app-services` (with `ports` as a folder), and one `adapter-postgres` plus `adapter-http`. Split `adapter-azure` and `ports` into packages only when the second implementation arrives. Keep the lint rules and dependency-cruiser from day one. Saves an estimated 3 to 5 points of setup in E2 and avoids pnpm-workspace build overhead.

### CE-MGR-05 · Medium · E9 is ordered after E4 but E4 needs an authenticated actor

- **Evidence:** §9 puts E4 at 5 and E9 at 6 with "Needed before E5/E6". `submit` calls `Authorizer` and `IdempotencyRepository.begin(submitterId, ...)` (§3, §4). Project plan §6 places E9 in It4.
- **Fix:** add a thin "actor stub" (test OIDC token, roles from seeded app DB) at the start of It3 and say so. Keep full E9 (conflict matrix, two-person grants) in It4. Otherwise E4 cannot be demonstrated in the test environment.

### CE-MGR-06 · Medium · Opportunity: start the pure core while IT provisioning is pending

- **Evidence:** R15 (provisioning takes longer than an iteration, High/High); §9 says E3a "Pure; no dependency on E2a adapters"; §7.2 shows all conformance runs locally with Testcontainers.
- **Fix:** begin E3a (policy-core, DT vectors) and the E3 transition table in It2 on local infrastructure, paired with the platform work, rather than waiting for the dev environment. This is the single sequencing change that helps. It does not need Azure and it de-risks R15. It needs DL-N06 (per-currency thresholds) and the DT vector set to be settled; check with architect.

### CE-MGR-07 · Medium · P5 (CI/CD) grows from M–L to L with the conformance gate

- **Evidence:** §7.3 adds a conformance matrix, PgBouncer container, replay gate, cross-host equivalence; S-05 100 iterations per PR.
- **Fix:** In REL-1, P5 runs unit, policy-core vectors, and the ACA-image conformance subset (CE-MGR-02) per PR; replay gate when E3a vectors exist; the 1,000-iteration S-05 nightly from REL-2. Re-size P5 as L in the board. Budget about 1 extra person-week.

### CE-MGR-08 · Medium · Risks R22–R25 are incomplete

- **Evidence:** §9.2 gives no probability, impact, owner or trigger; the project plan's register (§9) requires them. R24's mitigation depends on the nightly runs recommended against in CE-MGR-03.
- **Fix:** add owner (tech lead), P/I (suggested: R22 Medium/Medium, R23 Medium/Low while Option 3 is not chosen, R24 High/Medium, R25 Medium/High) and triggers (R22: a conformance failure on a port rule; R24: REL-1 slips more than one iteration). Add **R26** "CI time and conformance-suite maintenance exceed capacity; flaky race tests are muted" (Medium/Medium, tech lead + QA). Reserve R27 onward for the regulatory risks (see `reviews/regulatory-manager.md`, REG-MGR-08) so IDs do not collide.

### CE-MGR-09 · Medium · New IDs collide with existing ones

- **Evidence:** the plan's scenarios "S-01 to S-13" reuse the ID style of the S1–S6 stories (`application-project-plan.md` §7) and of the question IDs S-03 in `reviews/ba-review.md` (line 458, "May real historical decisions…"). "P-new-1/2/3" sit beside P1–P20 (platform) and P5/P7/P14.
- **Fix:** rename scenarios `CS-01`…`CS-13` (conformance scenario) and the spike and tests as P21–P23 on the platform backlog. Do this before other documents cite them.

### CE-MGR-10 · Medium · No go/no-go criteria or release exits tied to the plan

- **Evidence:** §9 has sequencing and risks only; project plan §12 has no item about the core.
- **Fix:** add to REL-0 go/no-go: ADR-023 accepted (or explicitly deferred) and the Functions/VM triggers recorded. Add to the REL-1 exit: the conformance subset (CE-MGR-02) is green against the production container image through PgBouncer; dependency-cruiser and clock/UUID lint gates are on. Add to the pre-pilot go/no-go: S-05 at 1,000 iterations and S-08 pass; no unresolved R22 findings.

### CE-MGR-11 · Low · ADR-024 (no Durable Functions) is fine but should be cheap to accept

- **Evidence:** §6.3; `azure-architecture-proposal.md` §6 shows a Durable task hub for Option 3 only.
- **Fix:** accept as a one-paragraph ADR that narrows the Azure proposal; it blocks nothing and costs nothing. Do not let it drive any REL-1 work.

### CE-MGR-12 · Low · Open items in §10 should be closed by decision, not left

- **Evidence:** "whether non-deployed hosts gate PRs or run nightly" and "ownership of the spike".
- **Fix:** both disappear under CE-MGR-03 (no non-deployed host in CI; spike deferred). Ownership of ADR-023 stays with the technical lead.

## Rough effort delta (assumptions above)

| Item | Points / effort | Where it lands | Recommendation |
|---|---|---|---|
| E2a ports, conformance harness, Testcontainers PG16 + PgBouncer | 5 pts | It2, inside E2 | Keep |
| Conformance subset CS-01..04, 06, 07, 10, 13 | 5 to 8 pts spread over E4, E6, E7 | It3–It4 | Keep (counts toward each item) |
| Control row and `lockShared` in E4 | 1 to 2 pts | It3 | Keep |
| P5 gate growth | about 1 person-week | It2–It3 | Keep, re-size P5 |
| `hosts/functions` + driver + shim | 6 to 10 person-weeks | Not scheduled | Defer on trigger |
| P-new-1 Functions spike | 2 to 3 person-weeks | Not scheduled | Defer on trigger |
| P-new-3 VM wrappers | 1 to 2 person-weeks | Not scheduled | Defer on trigger |
| CS-05, CS-08, CS-11, CS-12, anchor adapter | 4 to 6 pts | REL-2 (with E12, E8, P12) | Move |
| **REL-1 net addition** | **about 12 to 17 pts plus 1 person-week CI** | | Re-baseline at end of It2 |

## Recommended release, risk and dependency changes (core plan only)

| Area | Change |
|---|---|
| REL-0 | Record ADR-023 and the host-trigger list; add capacity calculation to go/no-go item 5 |
| REL-1 | Add E2a (5) to E2; conformance subset; control row; actor stub in It3; start E3a/E3 early on local infra (It2); likely It2–It5 at 2 people |
| REL-2 | S-05 blocking (E12), S-08 (E8), S-11, S-12, anchor adapter (P12), `adapter-azure` extraction |
| REL-3, REL-4 | No change; no second host. P14 load test on the ACA host only |
| Risks | R22–R25 with owner, P/I, trigger; R26 CI cost; R24 re-worded |
| Dependencies | E4 needs actor stub (E9-lite); E12 needs control row from E4; P12 needs `AnchorWriter`; Functions/VM work needs a recorded trigger |

## Decisions the product owner must make

1. Confirm the team size (2 or 3 developers, platform contractor yes or no) so REL-1 can be sized: accept 4 iterations (It2–It5) or add capacity.
2. Defer `hosts/functions`, the Functions CI leg and the spike until a named trigger (IT rejects Container Apps and App Service, cost, sponsor request). Yes or no.
3. Accept the REL-1 conformance subset and move S-05, S-08, S-11, S-12 and the anchor adapter to REL-2.
4. Accept the smaller package layout (four units to start) or require the full layout of §2 now.
5. Approve renaming the scenario IDs to CS-xx and the new platform items to P21–P23.
6. Accept ADR-024 (no Durable Functions) now, as a low-cost narrowing decision.
