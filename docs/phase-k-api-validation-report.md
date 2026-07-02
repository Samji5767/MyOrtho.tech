# Phase K — API Validation Report

**Date**: 2026-07-02  
**Branch**: `claude/myortho-production-validation-dlmvsi`  
**Method**: Full source code audit of all controller and service files in `backend/src/`.

---

## K1 — Authentication

**Pattern**: `@UseGuards(AuthGuard)` applied at controller class level in virtually all controllers.

`AuthGuard` (`backend/src/auth/auth.guard.ts`):
- Reads `mo_session` cookie or `Authorization: Bearer` header
- Verifies JWT signature with `auth.service.verifyToken()`
- Sets `req.user = { id, email, role, name, orgId, isOnboarded }`
- Returns 401 `UnauthorizedException` on missing or invalid token

All public endpoints (`GET /billing/plans`, `POST /api/auth/login`, `GET /health`) correctly omit `@UseGuards(AuthGuard)`.

**Finding (K1-F1) — Fixed this session**: `BillingController` had `@UseGuards(AuthGuard)` at class level, which blocked `POST /billing/webhook/stripe`. Stripe sends no JWT; all webhook requests received HTTP 401. **Fixed**: Extracted `BillingWebhookController` as a separate class with no `@UseGuards`.

---

## K2 — Authorization (RBAC)

`PermissionsGuard` is opt-in via `@RequirePermission()` decorator. When no decorator is set, the guard passes through — auth is enforced but not RBAC.

### Endpoints with authorization gaps (fixed or documented)

| Endpoint | Issue | Status |
|----------|-------|--------|
| `GET /billing/analytics` | No role check — any authenticated user can view platform-wide revenue | **Fixed**: now requires `admin` or `super_admin` role |
| `POST /api/credits/grant` | Any authenticated user could grant credits to their org | **Fixed**: now requires `admin` or `super_admin` role |
| `POST /api/features/:flagName` | Any authenticated user could toggle feature flags | **Fixed**: now requires `admin` or `super_admin` role |
| `GET /api/photos/*`, `DELETE /api/photos/:id` | No `@RequirePermission`; any authenticated user can access PHI photos | **Documented** — not fixed in this session |
| `GET /api/segment-jobs/:jobId` | No `@RequirePermission('cases:read')` | **Documented** |

### Endpoints with correct RBAC

`AdminController` manually enforces `super_admin` role via `requireSuperAdmin()` helper on all methods. `CasesController`, `PatientsController`, `TreatmentPlansController` all use `@RequirePermission()`. `AuditController` uses `@RequirePermission('admin:audit')`.

---

## K3 — Request Field Name Bugs (Fixed this session)

`AuthGuard` sets `req.user.orgId` and `req.user.id`. Three controllers used wrong field names, causing tenant isolation to silently return `undefined`:

| Controller | Wrong field | Correct field | Fix status |
|-----------|------------|--------------|------------|
| `NotificationsController` | `req.user.organizationId` (5 usages) | `req.user.orgId` | **Fixed** |
| `ReportingController` | `req.user.organizationId` (3 usages) | `req.user.orgId` | **Fixed** |
| `AiProposalController` | `req.user.organizationId`, `req.user.sub` (4 usages each) | `req.user.orgId`, `req.user.id` | **Fixed** |
| `BillingController` | `req.user.organizationId` (all methods) | `req.user.orgId` | **Fixed** |

**Impact before fix**: All notifications, case reports, and AI proposals returned data without org scoping — any user could see any org's data (or see undefined org results). This was a multi-tenant data leak.

---

## K4 — Input Validation

Global `ValidationPipe` is configured in `main.ts`:
```typescript
new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false })
```

- `whitelist: true` — strips unknown properties from request body
- `transform: true` — auto-converts primitive types
- `forbidNonWhitelisted: false` — extra properties are silently stripped rather than rejected with HTTP 400

**Finding (K4-F1)**: `forbidNonWhitelisted: false` means a client sending unexpected fields gets a 200, not a 400. This is a low-risk issue (whitelist still strips the data) but makes API contracts harder to enforce.

**Finding (K4-F2)**: Several controllers use untyped `@Body() body: { field?: string }` without DTO classes, bypassing `class-validator` decorators entirely. These endpoints perform no type or format validation beyond what TypeScript infers at compile time (which is erased at runtime). Affected controllers include `BillingController`, `SegmentationController`, and `ScanController`.

---

## K5 — Pagination

| Endpoint | Pagination | Defaults | Max |
|----------|-----------|---------|-----|
| `GET /api/patients` | `LIMIT $2 OFFSET $3` | 100 | Not enforced |
| `GET /api/cases` | `LIMIT $2 OFFSET $3` | 100 | Not enforced |
| `GET /api/ipr-planner/items` | `LIMIT $2 OFFSET $3` | 200 | 500 |
| `GET /api/notifications` | `LIMIT $2` | 50 | Not enforced |
| `GET /billing/analytics` | No pagination | — | N/A (aggregate) |
| `GET /api/admin/users` | No pagination | — | COUNT only |

Pagination is implemented on the highest-volume clinical list endpoints. The admin user list is unbounded — on large deployments this will be a full table scan.

---

## K6 — Error Handling and Response Consistency

`AllExceptionsFilter` is registered globally and:
- Returns a consistent `{ statusCode, message, timestamp, path }` envelope for all errors
- Strips stack traces from client responses in production
- Logs 5xx errors server-side with stack traces

**Finding (K6-F1)**: The error response includes `path: request.url`, which may contain patient IDs or case IDs in the URL path or query string. These are logged to the client on server errors.

**Finding (K6-F2)**: Some service methods throw raw PostgreSQL errors (e.g., `db.query(...)` without try/catch in `admin.service.ts`). The filter catches these but the raw Postgres error message may leak table names or column names in the `message` field.

---

## K7 — Rate Limiting

| Scope | Config | Implementation |
|-------|--------|---------------|
| Global | 100 req/60s per IP | `ThrottlerModule` + `ThrottlerGuard` in `app.module.ts` |
| Login | 10 attempts/60s per IP | Redis-backed, in-memory fallback in `auth.service.ts` |
| AI engine | 30 req/min per `(org_id, endpoint)` | In-memory only — resets on restart |

`@SkipThrottle()` is correctly applied to `BillingWebhookController.stripeWebhook` (Stripe sends bursts).

**Finding (K7-F1)**: Rate limiting trusts `X-Forwarded-For` at face value without verifying the proxy chain. An attacker can forge this header to bypass IP-based rate limiting.

---

## K8 — Audit Logging

`AuditService.log()` is called in:
- `patients.service.ts` (create, update, delete)
- `cases.service.ts` (create, status change)
- `admin.service.ts` (user management)
- `scans.service.ts` (upload)

**Gap**: `auth.controller.ts` does NOT call `AuditService` for login, failed login, or logout events. Auth events are stored only as `last_login_at` on the user record, not in the structured `audit_events` table. This is a HIPAA audit trail gap.

---

## K9 — Controller Prefix Consistency

| Controller | Prefix | Notes |
|-----------|--------|-------|
| All auth | `api/auth` | Correct |
| Patients, Cases, Scans | `api/...` | Correct |
| Credits, Features, Notifications | `api/...` | Correct |
| BillingController | `billing` | **Missing `api/` prefix** |
| AiProposalController | (inline `api/cases/...`) | Correct |

`BillingController` routes at `/billing/...` instead of `/api/billing/...`. This is inconsistent with all other controllers. Changing it now would break frontend calls to `/billing/*`.

---

## K10 — HTTP Status Codes

Generally correct:
- `@HttpCode(HttpStatus.CREATED)` on POST-create endpoints
- `@HttpCode(HttpStatus.NO_CONTENT)` on mark-read / dismiss notifications
- `@HttpCode(HttpStatus.OK)` on login

**Finding**: `DELETE` endpoints in several controllers return `200 OK` instead of `204 No Content`. This is a minor convention violation.

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Authentication | PASS | AuthGuard enforced on all appropriate endpoints |
| Stripe webhook auth bypass | **FIXED** | BillingWebhookController extracted |
| Field name bugs (orgId/id) | **FIXED** | 4 controllers corrected |
| Analytics role check | **FIXED** | Admin role required |
| Credits grant role check | **FIXED** | Admin role required |
| Feature flag admin check | **FIXED** | Admin role required |
| Photos missing PermissionsGuard | DOCUMENTED | Not fixed |
| Input validation | PARTIAL | Global pipe present; some endpoints use untyped bodies |
| Pagination | PARTIAL | Clinical lists paginated; admin lists unbounded |
| Rate limiting | PARTIAL | IP-based; forged X-Forwarded-For bypasses it |
| Audit logging | **GAP** | Auth events (login/logout/failure) not in audit_events |
| Error responses | PARTIAL | URL path leaked in 5xx envelope |
| Status codes | MOSTLY CORRECT | Minor DELETE → 204 violations |

**API Readiness Score**: 68/100  
Rationale: Authentication is solid. Critical field-name bugs fixed. RBAC partially enforced. Auth audit logging gap is a HIPAA concern. Stripe webhook was fully broken (now fixed).
