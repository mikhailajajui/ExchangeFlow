# ADR-025: Compliance guardrail covers all automated outcomes and reads compliance facts

- **Status:** Accepted (product owner, 2026-10-01)
- **Date:** 2026-10-01
- **Sources:** `docs/research/canada-credit-union-fx-requirements.md`; `reviews/regulatory-architect.md` REG-ARCH-01/02/03; `reviews/regulatory-qa.md` REG-QA-01; `reviews/regulatory-ba.md` REG-BA-05

## Context

The guardrail (design §4.3 row 9) could only downgrade an auto-approve. A request that a compliance rule says must be seen by a person (for example a potential screening match) could still end as an auto-decline that no one reviews. FR-16 forbids rules from reading individual-level fields.

## Decision

- The guardrail applies to **every** automated outcome. It can turn `AUTO_APPROVE` or `AUTO_DECLINE` into `HUMAN_REVIEW`, never the reverse (property P7 extended).
- The guardrail may read **compliance facts**: categorical values (booleans or codes) supplied by compliance-owned systems, such as identity-verified, PEP/HIO flag, screening result, directive-country flag, cash flag, entity flag, compliance hold. Ordinary rules may not read them.
- Each fact is tri-state (true, false, UNKNOWN) with provenance (source, actor, timestamp, time to live). Missing or stale means UNKNOWN. UNKNOWN for a fact the guardrail requires means `HUMAN_REVIEW`.
- Compliance facts are stored with the evaluation input for replay, in the restricted partition (ADR-026).
- FR-16 is clarified accordingly; the D7 default (no customer identity data in rules) stands for rules.

## Consequences

- New fallback cause `COMPLIANCE_GUARDRAIL`, recorded only in the restricted partition; general readers see the generic `GUARDRAIL`/`HUMAN_REVIEW` presentation.
- Thresholds (for example the identity-verification amount) are compliance parameters in the guardrail version, never literals in code; values come from compliance, not from the research.
- Amends `policy-engine-design.md` §4.1, §4.3, §6.1.
