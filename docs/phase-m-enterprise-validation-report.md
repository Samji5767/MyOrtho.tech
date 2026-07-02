# Phase M — Enterprise Validation Report

**Date**: 2026-07-02  
**Branch**: `claude/myortho-production-validation-dlmvsi`  
**Method**: Source code audit of RBAC, multi-tenancy, billing, FHIR, webhooks, and SSO/SCIM modules.

---

## M1 — Multi-Tenancy

### Data isolation strategy

All clinical data tables are org-scoped:
- `patients`, `scans`, `segmentation_jobs`, `notifications`, `audit_events`, `feature_flags`, `print_jobs`, `lab_orders` — all have `organization_id UUID REFERENCES organizations(id)` with queries scoped by `WHERE organization_id = $1`
- `cases` — scoped via JOIN through `patients.organization_id` (denormalization gap documented in Phase J)

**Finding (M1-F1)**: Row-level security (RLS) is NOT enabled at the PostgreSQL level. Tenant isolation is enforced exclusively by application-layer `WHERE organization_id = $1` clauses. A bug in a service (like the wrong field name bug fixed in Phase K) can expose cross-tenant data without any DB-level barrier.

**Finding (M1-F2)**: No database-per-tenant or schema-per-tenant isolation. All orgs share the same PostgreSQL schema. Compliance frameworks (SOC2, HIPAA BAA) may require stronger isolation guarantees.

### Parent organization hierarchy

`organizations` table has `parent_id UUID REFERENCES organizations(id) ON DELETE SET NULL`, enabling hierarchical org structures (DSO / group practice). No backend service currently queries this hierarchy — parent-child rollup is not implemented.

---

## M2 — RBAC

### Role definitions

11 roles defined in `permissions.ts`:

| Role | Description |
|------|-------------|
| `super_admin` | Platform-level admin |
| `admin` | Org admin |
| `orthodontist` | Clinical lead |
| `resident` | Clinical trainee |
| `treatment_coordinator` | Case management |
| `lab_technician` | Manufacturing |
| `receptionist` | Scheduling |
| `patient` | Self-service |
| `billing_admin` | Financial |
| `compliance_officer` | Audit/compliance |
| `executive` | Read-only analytics |

### Permission matrix

15 permissions across 6 resource types (`cases`, `patients`, `treatment_plans`, `scans`, `reports`, `admin`). `PermissionsGuard` enforces `@RequirePermission()` decorator.

### Gap: PermissionsGuard is opt-in

As documented in Phase K, `PermissionsGuard` only runs when `@RequirePermission()` is explicitly applied. Endpoints without this decorator are authenticated but not RBAC-controlled. Most manufacturing, lab-order, and analytics endpoints lack `@RequirePermission`.

**Assessment**: RBAC framework is correctly designed. Enforcement coverage is incomplete.

---

## M3 — Billing

### Subscription model

Two parallel billing implementations:
1. `BillingService` (Stripe integration) — subscription plans, checkout sessions, webhook processing, usage metering, invoice generation
2. `CreditsService` — credit wallet with balance, transactions, and subscription plan activation

**Finding (M3-F1)**: Both billing systems exist and can create subscriptions independently. No reconciliation mechanism prevents a single org from having both a Stripe subscription and an active credits subscription simultaneously. The relationship between the two systems is undefined.

### Stripe integration

- Checkout session creation: implemented
- Webhook handling: implemented (Stripe signature verification via `stripe.webhooks.constructEvent`)
- Webhook auth bypass: **fixed in Phase K** (webhook now in separate controller without AuthGuard)
- Supported events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`

**Finding (M3-F2)**: Stripe test/live mode is not configurable at runtime — the Stripe client is initialized with `process.env.STRIPE_SECRET_KEY`. No guard prevents production keys being used in development.

---

## M4 — FHIR Integration

`FhirService` implements FHIR R4 resource export:

| Resource | LOINC Code | Implementation |
|----------|-----------|---------------|
| `Patient` | — | US Core Patient profile, `urn:myortho:patient` identifier system |
| `Observation` (CBCT) | 36643-5 (CT maxillofacial) | Basic observation with case reference |

All exports are persisted to `fhir_exports` table with `organization_id` scoping.

**Finding (M4-F1)**: FHIR export query for cases uses `c.organization_id` which does not exist as a column on `cases` (schema gap documented in Phase J). The CBCT observation export will fail at runtime with `column "organization_id" does not exist`.

**Finding (M4-F2)**: Only 2 of ~10 expected FHIR R4 resource types are implemented (Patient, Observation). Missing: `Condition`, `Procedure`, `DiagnosticReport`, `CarePlan`, `Appointment`. FHIR completeness is insufficient for EHR interoperability.

**Finding (M4-F3)**: No FHIR validation against official HL7 R4 profiles or US Core IG profiles. Resources are hand-assembled JSON objects — no conformance verification.

---

## M5 — Webhooks

`WebhooksService` dispatches events to registered endpoint URLs on clinical events (case status changes, scan uploads, report completion).

| Feature | Status |
|---------|--------|
| Endpoint registration | Implemented — stored in `webhook_endpoints` table |
| Signature (HMAC-SHA256) | Implemented — `X-MyOrtho-Signature` header |
| Retry on failure | Implemented — 3 retries with exponential backoff |
| Event filtering | Implemented — per-endpoint event type allowlist |
| Delivery log | Implemented — stored in `webhook_deliveries` table |

Webhook dispatch is called from `cases.service.ts` and `scans.service.ts` via NestJS `EventEmitter2`.

**Assessment**: Webhook implementation is solid. No critical issues found.

---

## M6 — SSO / SCIM

**Status: NOT IMPLEMENTED**

No SSO (SAML 2.0, OIDC) or SCIM (user provisioning) integration exists. There is no reference to `passport-saml`, `passport-oidc`, or any SCIM library in `package.json`. Authentication is username/password only.

Enterprise customers requiring single sign-on with their IdP (Okta, Azure AD, Google Workspace) cannot be onboarded.

---

## M7 — OpenTelemetry / Distributed Tracing

`ObservabilityService` initializes the OpenTelemetry Node.js SDK with service name `myortho-backend` but no exporter is configured. All traces are no-ops:

```typescript
this.sdk = new NodeSDK({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: 'myortho-backend' }),
  // No exporter — traces go nowhere
});
```

Span creation via `trackTraceSpan()` runs but emits to the no-op tracer. No Jaeger, Tempo, OTLP, or cloud trace destination is configured.

**Assessment**: Tracing infrastructure is wired correctly but produces no observable output.

---

## M8 — Audit Logging

`AuditService.log()` writes to `audit_events` table with: `organization_id`, `actor_id`, `action`, `resource_type`, `resource_id`, `ip_address`, `metadata`.

Covered: patient create/update/delete, case create/status change, scan upload, admin user management.  
Gap: auth events (login, logout, failed login) not written to `audit_events` — HIPAA gap documented in Phase N.

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Multi-tenancy (application layer) | PASS | All queries org-scoped |
| Multi-tenancy (DB layer / RLS) | NOT IMPLEMENTED | Application-only isolation |
| RBAC framework | PASS | 11 roles, 15 permissions, PermissionsGuard |
| RBAC enforcement coverage | PARTIAL | Manufacturing, analytics endpoints not guarded |
| Billing (Stripe) | IMPLEMENTED | Checkout, subscriptions, webhooks |
| Dual billing systems | DOCUMENTED | No reconciliation between Stripe and credits |
| FHIR R4 export | PARTIAL | 2/10 resource types; cases query broken |
| Webhooks | PASS | Signature, retry, delivery log |
| SSO / SAML / OIDC | NOT IMPLEMENTED | — |
| SCIM user provisioning | NOT IMPLEMENTED | — |
| OpenTelemetry exporter | NOT CONFIGURED | Traces are no-ops |
| Audit log | PARTIAL | Data events covered; auth events missing |

**Enterprise Readiness Score**: 55/100  
Rationale: RBAC framework solid; webhook integration well-built; Stripe billing integrated. Critical gaps: no SSO/SAML for enterprise IdP integration, no DB-level isolation (RLS), FHIR queries broken by schema gap, OTel produces no observable output, auth audit log missing.
