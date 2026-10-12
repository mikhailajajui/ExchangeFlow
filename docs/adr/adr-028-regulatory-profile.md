# ADR-028: Regulatory profile as configuration

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** research §2; `reviews/regulatory-manager.md` REG-MGR-01; `reviews/regulatory-architect.md` REG-ARCH-08

## Context

The target organization is a Canadian credit union. Province and federal or provincial status decide the privacy regime, outsourcing guidance, deposit insurer, retention and hosting region. Working assumption (2026-10-01, from public web search, to be confirmed by compliance): Alterna Savings, an Ontario credit union regulated provincially by FSRA; Quebec members not expected.

## Decision

- A `regulatoryProfile` configuration object (province, federal or provincial, regulator, deposit insurer, privacy regime, language requirements, retention table) is loaded at start-up, one profile per deployment, versioned, and recorded on each decision record.
- No province-specific rule is hard-coded. Quebec-specific items (member notice for automated decisions, cross-border impact assessment, French reason text) are conditional on DL-N24.
- FINTRAC duties are identical for any profile and are expressed as compliance parameters, not literals.

## Consequences

- The Ontario assumption is recorded in DL-N09 as provisionally answered.
- Changing the profile is a controlled, audited configuration change (two-person for compliance parameters).
