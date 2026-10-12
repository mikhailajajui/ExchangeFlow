# ADR-AZ-5: Identity on Azure

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** azure-security-validation F-ID-01..07; azure-qa-validation QA-AZ-09 (in `reviews/`)

## Context

Implements ADR-014 and ADR-015 on Entra ID.

## Decision

- Single-tenant confidential client per environment; certificate in Key Vault.
- Conditional Access: baseline MFA, phishing-resistant MFA for privileged roles, authentication context for step-up, guests blocked.
- Two break-glass accounts; separate non-prod tenant or registrations for test identities.

## Consequences

- Needs Entra ID P1; PIM for Azure-plane admin needs P2 or Governance (AZ-14).
