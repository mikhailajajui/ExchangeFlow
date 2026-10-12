# Security review: `docs/core-engine-plan.md` v0.1

**Reviewer:** security-reviewer agent. **Saved by:** main session (the agent has no write tool). **Date:** 2026-10-01.
**Scope:** §1 design rules, §3 ports, §4 invariants, §5 host table and notes, §7 HostDriver, §8 conformance. Compared with the SEC-nn IDs in `reviews/security-review.md`. `azure-architecture-proposal.md` §3 and `reviews/azure-security-validation.md` were not re-read line by line, so no AZ-nn IDs are cited.
**Overall:** sound. INV-PLACEHOLDER-1, INV-AUD-1 and INV-LOG-1 are present and `validate-jwt` is correctly rejected for browser sessions. The gaps are mostly host-divergence and test-surface risks.

*Point-in-time snapshot: do not edit after consolidation.*

## Findings

### CE-SEC-01 (High): test-only clock and crash endpoints are guarded only by "disabled in prod builds"
- **Evidence:** §7 `HostDriver.setClock` and `crashAfter`; the Functions `runJob` admin endpoint used in tests.
- **Risk:** `setClock` defeats `asOf`, effective dating, expiry (SEC-20) and the escalation window. `crashAfter` is a denial-of-service lever. A deployed Functions admin endpoint is a job-trigger backdoor.
- **Fix:**
  - Compile failpoint and clock code out of the production artifact; add a CI grep of the prod bundle for these symbols.
  - Make the `fixed` clock and failpoints impossible when `environment=prod`, in the same start-up check as INV-PLACEHOLDER-1.
  - Bind the test control plane to loopback or an in-process driver. No HTTP route.
  - Disable the Functions admin and master-key trigger surface in deployed apps.
  - S-09 probes for these routes in the prod-configured build.

### CE-SEC-02 (High): software `KeySigner` is only "flagged non-production"
- **Evidence:** §3 `KeySigner`; §8 Keys.
- **Risk:** a misconfigured staging or prod environment silently signs audit anchors with an exportable key, undermining SEC-10.
- **Fix:** refuse to start unless `environment=prod` implies the Key Vault HSM signer; put signer type and key ID in each anchor; verifier rejects software-key anchors in prod; distinct key-ID prefix for the software signer; document that software-key evidence is untrusted.

### CE-SEC-03 (High): placeholder guard on Functions relies on a "warm-up function and first invocation"
- **Evidence:** INV-PLACEHOLDER-1, host column.
- **Risk:** no guaranteed start-up hook; a cold-start race can serve a request before the check runs.
- **Fix:** run the check as module initialisation that throws before any trigger registers; also assert at publish, activate and at decision commit (reject a `nonProduction` rule in a prod transaction); test the cold-start path in S-09 on Functions; do not rely only on the Sev-1 self-check.

### CE-SEC-04 (High): CSRF and session handling on Functions and APIM are described, not specified
- **Evidence:** §5 "BFF session on Functions"; Azure proposal §6.
- **Gaps:** CSRF mechanism not named; no Origin or Fetch-Metadata check; APIM risks (caching authenticated responses, forwarding `X-Forwarded-*`, trusting spoofable client-IP headers for rate limits, SEC-34); function-level keys could bypass APIM if the app is publicly reachable; no cookie baseline.
- **Fix:** pin cookie attributes (`__Host-`, Secure, HttpOnly, SameSite) and CSRF in `adapter-http` and test identically on each host (SEC-24); restrict the Function App to APIM or Front Door and validate `X-Azure-FDID`; disable APIM caching on authenticated routes; rate-limit keys from session and trusted-proxy IP only; add a conformance case "direct call bypassing APIM is refused".

### CE-SEC-05 (Medium): relay and jobs have a lease but no stated identity or authorization boundary
- **Evidence:** §3 `withLease`; §5 relay; `runJob`.
- **Risk:** one managed identity for web and jobs violates least privilege; a lease row can be stolen or starved; a relay loop in a 1-minute timer can overlap.
- **Fix:** separate identities and DB roles for web, worker, migrator, anchor-signer; lease rows with expiry and fencing token; keep idempotent consumers and test overlap; disable manual job trigger in prod or require a privileged audited identity.

### CE-SEC-06 (Medium): audit-chain grants asserted for "the application role" only
- **Evidence:** INV-AUD-1.
- **Risk:** migrator, owner or pg-boss roles can alter audit tables.
- **Fix:** distinct owner role; revoke TRUNCATE as well as UPDATE and DELETE; block triggers and DDL on audit tables for runtime roles; separate admin identity with break-glass (SEC-40); anchor the head to immutable Blob and alert when it does not advance; S-10 enumerates every role.

### CE-SEC-07 (Medium): telemetry allow-list cannot cover host loggers and exception paths
- **Evidence:** INV-LOG-1; `Telemetry` port; §5 host table.
- **Risk:** the Functions host logger, App Insights auto-collection of URLs and query strings, dependency telemetry (SQL text), exception messages and APIM diagnostic logs bypass the port.
- **Fix:** disable auto-collection and add a global telemetry processor that drops unknown keys; never log bodies, headers or SQL parameters; configure APIM diagnostics to omit headers and bodies; extend S-11 through APIM and to exception and 500 paths (SEC-31).

### CE-SEC-08 (Medium): config and secrets handling differs by host
- **Evidence:** §5 "Config and secrets".
- **Risk:** Key Vault references in Functions app settings are visible in the portal and Kudu to Contributors; ACA secrets store holds copies; a systemd drop-in is world-readable by default.
- **Fix:** prefer runtime fetch by managed identity; restrict Kudu and SCM; file mode 0600 on VM drop-ins and separate config from secrets; rotation test without redeploy; SEC-35 per environment with scoped CI OIDC claims.

### CE-SEC-09 (Low): Functions per-route handlers generated from a route manifest can drift
- **Fix:** the manifest is the single source of authz metadata; the build fails if a route lacks an `Action`; deny-by-default test per host enumerating registered triggers (SEC-12).

### CE-SEC-10 (Low): the restricted compliance channel has no port
- **Evidence:** §3 has no restricted-field store, screening port or read-audit port (the gap behind REG-SEC-01 and REG-SEC-04).
- **Fix:** add placeholder ports `RestrictedStore` and `ScreeningFacts` now so hosts need no re-plumbing.

## Decisions the product owner must make

1. May test control endpoints exist as deployed code in any non-dev environment (CE-SEC-01)?
2. May non-production environments with software signers hold realistic audit evidence, or are they strictly synthetic (CE-SEC-02)?
3. Must Option 3 (Functions) be reachable only through private networking and APIM, and is the cost accepted (CE-SEC-04)?
4. Do web, worker and migrator get separate identities and DB roles from REL-0, or only before REL-1 (CE-SEC-05, CE-SEC-06)?
5. Who holds break-glass access to audit-table ownership, and what is the approval rule (CE-SEC-06)?
6. Does the nightly conformance matrix for non-deployed hosts include the security cases (CE-SEC-04, CE-SEC-07)?
