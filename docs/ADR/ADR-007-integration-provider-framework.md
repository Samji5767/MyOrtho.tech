# ADR-007: Integration Provider Framework

**Status:** Accepted  
**Date:** 2026-07-14  
**Deciders:** Platform Engineering

---

## Context

MyOrtho.tech needs to connect with a variety of external systems: DICOM/PACS archives, HL7/FHIR endpoints, practice management systems (PMS), 3D scanners, 3D printers, payment gateways, email/SMS providers, and calendar systems. Each integration has its own connection parameters, health state, and capability surface. Without a central registry, integration configuration is scattered across environment variables and ad-hoc code, making health monitoring and multi-provider scenarios difficult.

## Decision

Introduce a database-backed **Integration Provider Registry** as the single source of truth for all external integrations per organization.

**Key design choices:**
- One row per provider instance (an org can have multiple instances of the same type, e.g., two PACS servers).
- `config_json` stores connection parameters; it is intentionally opaque — the integration module that owns a given `provider_type` interprets its contents.
- `health_status` is a denormalized cache updated by periodic health-check calls. Raw health-check history lives in `integration_health_logs`.
- `capabilities_json` is a free-form list of feature tags the provider supports (e.g., `["segmented_export", "real_time_stream"]`).
- The registry does **not** store credentials — credentials belong in the runtime secret manager (environment variables / Vault). `config_json` may store non-secret references (host, port, dataset ID) only.

## Consequences

**Positive:**
- Centralized health dashboard across all integrations.
- Org-scoped: one registry entry per tenant, with full organization isolation via `organization_id`.
- Easy to add new `provider_type` values without schema changes.

**Negative:**
- Integration modules must look up their provider config from the database on startup or on first use; adds one DB query per integration initialization.
- `config_json` schema is not enforced at the database level — each integration module must validate on read.

## Alternatives Considered

- **Environment variables per integration**: Already done for the scanner module. Does not scale to multi-tenant or multi-instance scenarios.
- **External config server (Consul/etcd)**: Introduces additional infrastructure dependency; premature at current scale.
