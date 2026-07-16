# ADR-009: Clinical Knowledge Platform

**Status:** Accepted  
**Date:** 2026-07-14  
**Deciders:** Clinical Engineering, Platform Engineering

---

## Context

MyOrtho.tech's AI recommendations, treatment proposals, and QA checks reference implicit clinical logic embedded in code. There is no structured way for clinical directors to define, version, approve, or retire clinical protocols; no library of standard materials with their properties; and no manufacturing profiles capturing validated printer/resin/cure combinations. This makes audit trails incomplete and prevents non-engineers from managing clinical content.

## Decision

Introduce a **Clinical Knowledge Platform** with three artifact types: clinical protocols, material libraries, and manufacturing profiles.

**Clinical Protocols (`clinical_protocols`)**
- Versioned (integer version column; unique on `(org_id, code, version)`).
- Lifecycle: `draft → active → archived`.
- Evidence level (`A/B/C`) encodes the strength of evidence behind each protocol per standard clinical classification.
- `content_json` is a flexible schema allowing different protocol types (treatment steps, consent requirements, referral criteria) without schema migrations.

**Material Libraries (`material_libraries`)**
- Tracks resins, wires, brackets, composites, adhesives.
- `compatible_printers` is a text array of printer model strings, deliberately denormalized for query simplicity.
- `properties_json` stores material-specific properties (viscosity, Shore hardness, biocompatibility rating, etc.) without requiring a separate properties table.

**Manufacturing Profiles (`manufacturing_profiles`)**
- Captures validated print parameter sets: layer height, exposure time, support geometry, post-cure protocol.
- `is_default = TRUE` triggers a single-row constraint enforced at the application layer (update all others to FALSE before setting a new default).

## Consequences

**Positive:**
- Clinical content is now versionable, auditable, and manageable without code changes.
- Evidence levels enable the platform to surface protocol confidence to clinicians.
- Separates validated manufacturing parameters from ad-hoc per-job overrides.

**Negative:**
- `content_json` schema is not enforced at the database level. Validation is the responsibility of the application layer and must be documented separately for each protocol type.
- Protocol versioning is append-only — editing an active protocol requires creating a new version. This is intentional (immutable audit trail) but requires UI support to present the current version cleanly.

## Alternatives Considered

- **Embedded in code**: Current state. Does not support clinician-managed content.
- **External CMS (Contentful/Sanity)**: Adds external dependency; overkill for structured clinical data that must be org-scoped and version-controlled alongside the database.
