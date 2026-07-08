# MyOrtho.tech v1.0.0 Release Candidate Report

**Version**: 1.0.0-beta.1  
**Date**: 2026-07-08  
**Branch**: `claude/myortho-production-validation-dlmvsi`  
**Document type**: Capstone SDLC Engineering Report  
**Author**: Engineering team via Phase A–P sprint validation

---

## 1. Executive Summary

MyOrtho.tech is a cloud-based orthodontic practice management platform serving orthodontists, clinical staff, and — through a read-only portal — patients. The platform covers the full orthodontic case lifecycle: patient intake, 3D scan upload and segmentation, AI-assisted treatment planning, IPR and aligner staging, clinical report generation, and manufacturing job tracking. It is built on a NestJS backend (Node.js 20+), a Next.js 14 static frontend, a Python FastAPI AI engine (MONAI UNet-based tooth segmentation), and a PostgreSQL 16 database, orchestrated via Docker Compose.

The v1.0.0-beta.1 release represents the output of a 32-commit sprint across Phases A–P. The sprint delivered a working clinical workflow engine (cases, patients, treatment plans, copilot conversations, clinical reports), a 10-role RBAC system, a structured error code layer, rate limiting, correlation IDs, health and version endpoints, an audit trail, and SMTP-optional email notifications. All backend TypeScript (tsc --noEmit), all frontend TypeScript, and all CI jobs pass. Backend Jest: 75/75. Frontend Vitest: 98/98. AI Engine pytest: 9/9.

The platform is **not certified for production clinical use** in its current state. Two P0 blockers must be resolved before any deployment against real patient data: (1) PHI fields — patient name, date of birth, clinical notes — are stored in plaintext in PostgreSQL despite the presence of the ENCRYPTION_KEY environment variable; no AES encryption call exists in `patients.service.ts`. (2) The `clinical-analysis-deep` service inserts `Math.random()`-generated values for curve of Spee, midline deviation, overjet, overbite, and arch length measurements directly into the database as clinical data. These are not labeled as estimates or approximations; they are stored as if they were real measurements. Both issues represent HIPAA compliance and clinical safety failures at the data layer, not at the presentation layer, and require code-level fixes before any patient data can be processed.

---

## 2. Production Readiness Score

Scores are evidence-backed, drawn from Phase N (security audit), Phase O (operations/observability), Phase P (release certification), and the final RC validation report (2026-07-02). No score is inflated for work that was not verified.

| Dimension | Score /10 | Rationale |
|-----------|-----------|-----------|
| Authentication & Session Security | 7 | JWT HS256, bcrypt-12, SameSite=Strict cookie, 10 req/60s login rate limit (Redis + in-memory fallback), constant-time compare on unknown email. Gaps: JWT algorithm not pinned in `jwt.verify()` call; no revocation on logout (24h window remains valid). |
| Authorization (RBAC) | 6 | 10 roles, 15 permissions across 6 resource types, `PermissionsGuard` + `@RequirePermission()` framework correct. Gaps: guard is opt-in, not opt-out; `PhotosController` has no `@RequirePermission` — any authenticated user can list/delete PHI photos (`N-A01-1`); `SegmentJobsController` similarly unguarded. |
| Data Integrity & Migrations | 3 | 54 migration files exist; migration 054 is the latest. Critical gaps: migration 021 (`performance_indexes.sql`) aborts fresh installs with `ON_ERROR_STOP=1` due to references to non-existent columns; `organization_id` column does not exist on the `cases` or `scans` tables (30+ service queries reference it and will fail at runtime); PHI stored plaintext (P0). |
| API Design & Governance | 7 | Structured error code taxonomy (`error-codes.ts`, 30+ codes across AUTH/CASE/PATIENT/AI/MFG/RPT domains), correlation IDs via `CorrelationIdMiddleware`, `X-Response-Time` header on all responses, `ValidationPipe` with `whitelist: true`, per-resource rate limiting (auth: 5/60s, AI: 20/60s, global: 100/60s). API.md documents all endpoints. Gap: no OpenAPI/Swagger spec generated. |
| Error Handling & Observability | 5 | `GlobalExceptionFilter` returns `{ statusCode, errorCode, message, requestId, timestamp }` consistently for all exceptions. Real EMA response time (`α=0.1`), real request and error counters in `ObservabilityService`. Gaps: OpenTelemetry SDK initialized but no `SpanExporter` configured — all traces are no-ops; `/health/ready` always returns HTTP 200 even when `ready: false`; no Prometheus-format `/metrics` endpoint. |
| Clinical Safety (AI disclaimers, no fake outputs) | 4 | AI copilot responses carry clinical disclaimer (`CLINICAL_DISCLAIMER_POLICY.md` enforced at service layer). Segmentation fallback path sets `ai_version: '1.0.0-rule-based'` and `fallback: true` in DB. Critical gap: `clinical-analysis-deep.service.ts` stores `Math.random()`-generated values for curve of Spee, midline, overjet, overbite, and arch lengths as clinical measurements (P0 blocker). AI segmentation model has no trained weights — `weights_loaded: false` returned explicitly. |
| Test Coverage | 6 | Backend Jest 75/75 (unit + spec, covering auth, billing, IPR planner, treatment monitoring, cases controller, and exception filter). Backend E2E: 20 tests. Frontend Vitest 98/98 (mesh analysis, biomechanics vector math, CasePlanningContext). AI Engine pytest 9/9. Gaps: no unit tests for most service modules, no CAD/manufacturing tests, no browser E2E, no load tests. |
| Documentation | 7 | API.md (full endpoint table), ENV_VARS.md, CONFIG_MANAGEMENT.md, LOCAL_DEV.md, CLINICIAN_ONBOARDING.md, ENTERPRISE_ONBOARDING.md, CLINICAL_DISCLAIMER_POLICY.md, AI_READINESS.md, 15 phase audit reports. Gap: no OpenAPI spec; SECURITY_AUDIT.md does not exist (full detail is in `docs/phase-n-security-audit-report.md`); PERFORMANCE_AUDIT.md does not exist (detail in `docs/phase-o-operations-observability-report.md`). |
| Performance & Scalability | 6 | IPR planner N+1 eliminated (batched UNNEST INSERT, 4 queries total, verified by unit test). List endpoints paginated: patients (default 100), cases (default 100), IPR items (default 200, max 500). DB connection pool: max 20, connectionTimeoutMillis 5000, statement_timeout 30000. Redis: `--maxmemory 256mb --maxmemory-policy allkeys-lru`. Gap: no load test data; actual throughput ceilings unknown. |
| Operational Readiness | 4 | Config validation at startup (`config.validator.ts`): throws if `JWT_SECRET` < 32 chars in production; warns on missing admin password. `GET /health` (liveness, always 200) and `GET /health/ready` (readiness check against DB) are present. `GET /api/version` returns `{ app, api, buildDate, gitCommit, nodeVersion, environment }`. Gaps: `/health/ready` returns HTTP 200 even on failure (not 503); all three Dockerfiles (`backend/`, `ai-engine/`, `frontend/`) run as root — no `USER` directive; no automated backups; no container restart policies; no resource limits. |

**Overall Production Readiness Score: 55/100**

---

## 3. What Was Built (v1.0.0-beta.1 Feature Set)

### Core Clinical Platform
- Patient management: create, update, list (org-scoped, paginated), FDI notation throughout
- Case management: full lifecycle (intake → planning → treatment → complete), status transitions with guard enforcement, org-scoped queries
- Case creation with simultaneous new patient (`POST /api/cases/with-new-patient`)
- Treatment plans: plan stages, treatment goal tracking, plan approval workflow

### AI Copilot
- Dual-path engine: rule-based (always available) + LLM path (activated when `LLM_API_KEY` is set)
- Confidence scoring on all copilot responses
- Explainability fields: each suggestion carries a reasoning trace
- SSE streaming via `POST /api/cases/:caseId/copilot/conversations/:id/stream`
- Conversation persistence: conversations and messages stored in DB, fully retrievable
- Proactive suggestions: surfaced per-case via `GET /api/cases/:caseId/copilot/suggestions`, resolvable by clinician

### Clinical Modules
- Scan upload with 50 MB size limit enforced at the AI engine layer
- QC scoring for scan quality assessment
- Aligner staging and aligner generation pipeline
- IPR (interproximal reduction) planner: auto-recommend (Sheridan 1985 thresholds), per-tooth item CRUD, batched UNNEST insert for performance
- Bolton analysis: tooth-width discrepancy calculations based on Proffit 2018 norms, 16 unit tests
- Tooth segmentation: real MONAI UNet 3D pipeline (voxelization → forward pass → softmax → argmax → per-tooth label detection); GPU/CPU fallback; AI engine requires trained `.pth` checkpoint not included in repo
- Treatment simulations
- Clinical report generation: 3 report types — treatment summary, aligner progress, insurance pre-authorization

### Administrative
- RBAC: 10 roles, 15 permissions, `PermissionsGuard` enforced via `@RequirePermission()` decorator
- Audit trail: all case, patient, and auth-adjacent actions logged to `audit_events` table with actor, IP, resource type, resource ID, and timestamp; queryable by resource and actor
- User management: invite, role change, activate/deactivate (`POST /api/admin/invite`, `PATCH /api/admin/users/:id/role`)
- Organization management

### Notifications
- In-app notifications with per-user unread count
- SMTP email (optional): invite emails sent when SMTP env vars configured; nodemailer loaded via dynamic import at runtime — suppressed with a warning log when package is absent

### Patient Portal
- Compliance checklist for patients tracking their aligner wear
- Print support (HTML download with print CSS)

### Infrastructure
- Rate limiting: global 100 req/60s (ThrottlerGuard), login 10 req/60s (Redis + in-memory fallback), AI copilot 20 req/60s, uploads 10/60s
- Correlation IDs on all requests (`X-Request-ID` header → `req.correlationId`)
- 30+ structured error codes (`error-codes.ts`)
- Config validation at startup with environment-specific enforcement
- Health endpoint: `GET /health` (liveness), `GET /health/ready` (DB check), `GET /api/version` (version info)
- OpenTelemetry SDK initialized (no exporter configured — traces are no-ops in v1.0.0-beta.1)
- Webhooks: HMAC-SHA256 signature, 3-retry with exponential backoff, event filtering, delivery log

---

## 4. Technical Debt

Prioritized by risk to production stability and patient safety.

1. **No unit test coverage for most service modules (highest risk)**: The 75 backend unit tests cover 6 modules (auth, billing, IPR planner, treatment monitoring, cases controller, AllExceptionsFilter). The majority of service modules — copilot, clinical reports, scans, patients, notifications, audit, manufacturing — have no unit tests. Regressions in these modules will not be caught before deployment.

2. **`AllExceptionsFilter` left in place after replacement by `GlobalExceptionFilter` (dead code)**: Both `all-exceptions.filter.ts` and `global-exception.filter.ts` exist in `backend/src/common/`. The spec file `all-exceptions.filter.spec.ts` still tests the old filter. The old filter is no longer registered in `app.module.ts` (confirmed: `GlobalExceptionFilter` is the active filter), but the dead files add confusion and the spec tests dead code.

3. **No OpenAPI/Swagger documentation generated**: `@nestjs/swagger` is absent from `package.json`. The API is documented in `docs/API.md` (hand-maintained), which will drift from the actual implementation as the codebase evolves. There is no machine-readable contract for API consumers.

4. **Pagination not enforced on all list endpoints**: Core clinical endpoints (patients, cases, IPR items) are paginated. Several secondary endpoints — notifications list, audit event summary, clinical report list — do not enforce a hard `LIMIT` and will unboundedly grow with dataset size.

5. **`nodemailer` is a runtime-optional dependency with no `package.json` entry (fragile)**: `email.service.ts` uses a dynamic import pattern (`import(mod as string).catch(() => null)`) to avoid a hard build-time dependency. If `SMTP_*` env vars are set and an operator expects email delivery, silent suppression (a `logger.warn`) is the only failure signal. No alert mechanism exists.

6. **Frontend data adapters for AI Copilot, Analytics, and Scans return null/[] (unimplemented stubs)**: `frontend/src/lib/data/aiCopilotAdapter.ts`, `analyticsAdapter.ts`, and `scansAdapter.ts` export functions that return `null` or `[]`. The corresponding UI features show empty states. This is documented in `docs/final-rc-validation-report.md` (F6–F8).

7. **No Redis-backed session invalidation (stateless JWT, 24h revocation window)**: JWT tokens are validated statelessly. Logout clears the `mo_session` cookie client-side, but the token remains cryptographically valid for 24 hours. A stolen token cannot be invalidated before expiry. `ioredis` is in `package.json` and Redis is in Docker Compose, but it is not used for a token denylist.

---

## 5. Known Issues

Specific, verified issues that do not rise to P0/P1 blocker status but must be tracked for GA:

- **`SLOW_QUERY_THRESHOLD_MS` env var not documented in ENV_VARS.md**: `slow-query.logger.ts` reads `process.env.SLOW_QUERY_THRESHOLD_MS` and defaults to `500`. This variable is not listed in `docs/ENV_VARS.md`. Operators who want to tune or disable the slow query threshold have no documented path to do so.

- **SMTP email silently suppressed when `nodemailer` is not installed**: When `SMTP_HOST` is configured but nodemailer is absent, `EmailService` logs a `warn` and returns `undefined`. No exception is raised, no alert is emitted, and invite emails are silently dropped. Operators have no push notification that email delivery has failed.

- **`generateAlignerProgressReport` uses wall-clock date for estimated completion (not timezone-aware)**: The aligner progress report service uses `new Date()` for completion estimates without timezone context. Reports generated for patients in non-UTC timezones may show off-by-one day completion dates.

- **Insurance pre-authorization report does not include clinician signature capture**: The pre-auth report template generates HTML content but does not include a signature block. Clinicians are required to manually annotate the printed PDF before submission to payers.

- **`GET /health/ready` returns HTTP 200 when `ready: false`**: The readiness endpoint performs a live `SELECT 1` against PostgreSQL and returns `{ ready: false, checks: { databaseConnected: false } }` on failure — but the HTTP status code is always 200. Load balancers and Kubernetes readiness probes that rely on HTTP status will not correctly remove the instance from rotation on database outage.

- **OpenTelemetry SDK initialized but produces no traces**: `ObservabilityService` initializes `NodeSDK` with no `SpanExporter`. All `tracer.startActiveSpan()` calls in the codebase produce no-op spans. Operators who wire up an OTLP collector will receive nothing until an exporter is added to `NodeSDK` initialization.

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| PHI stored plaintext in production DB | High (already deployed if not caught) | Critical — HIPAA violation, potential civil/criminal liability | **P0 blocker**: add AES-256-GCM encryption in `patients.service.ts` before any patient data is written to production DB. `ENCRYPTION_KEY` env var and `CryptoService` already exist — the call site is missing. |
| `Math.random()` clinical measurements stored as real data | High (present in current build) | Critical — incorrect clinical decisions, malpractice exposure | **P0 blocker**: replace `randBetween()` calls in `clinical-analysis-deep.service.ts` with deterministic algorithmic calculations or require clinician input before storing. |
| LLM API key not set in prod | Medium | Medium (copilot degraded to rule-only, no LLM path) | Config validation warns at startup; rule engine still produces responses. Log message informs operator. |
| SMTP not configured | Medium | Low (invite emails suppressed; operator may not know) | SMTP is optional. In-app notifications still work. Operator must check startup logs for the `[EmailService] nodemailer not installed` warning. |
| Migration 021 aborts fresh install | High (anyone running `ON_ERROR_STOP=1`) | High (service fails to start on clean DB) | Apply migration 021 manually with error handling disabled, or patch the SQL to be idempotent before GA. |
| DB connection pool exhaustion under load | Low | High (all requests hang until timeout) | Pool configured at max 20, `connectionTimeoutMillis: 5000`, `statement_timeout: 30000`. Monitor pool wait times with `GET /api/observability/metrics`. |
| JWT secret rotation breaks all active sessions | Low | Medium (all users logged out simultaneously) | Plan rotation during a maintenance window. Coordinate with support team. |
| Default admin password `adminadmin` used in production | Medium | High (full super_admin access with known credential) | Startup logs a `console.warn` but does not block. Operators must set `MYORTHO_ADMIN_PASSWORD` env var before first launch. Gate on config validation in next patch. |
| Containers running as root | High (all 3 Dockerfiles have no USER directive) | Medium (container escape has full host access) | Add `USER node` (or equivalent non-root user) to `backend/Dockerfile`, `ai-engine/Dockerfile`, and `frontend/Dockerfile`. |
| Missing npm audit before GA | Medium | Medium (known CVEs may be present) | Run `npm audit` as a mandatory pre-release gate. No automated dependency scanning exists in CI as of 2026-07-02. |

---

## 7. Breaking Changes from Pre-Beta

- **Error response shape changed**: Prior to beta.1, unhandled exceptions returned NestJS default shape `{ statusCode, error, message, path, timestamp }`. The active `GlobalExceptionFilter` (registered since mid-sprint) returns `{ statusCode, errorCode, message, requestId, timestamp }`. Clients parsing the `error` field (e.g., `"Not Found"`) or the `path` field will receive `undefined`. API consumers must update their error parsers.

- **Frontend package.json version**: Internal version changed from `2.0.0` to `1.0.0-beta.1` to align with backend versioning. No public API change.

- **`req.user` field names standardized**: Prior to Phase K, several controllers read `req.user.organizationId` and `req.user.sub`. `AuthGuard` sets `req.user.orgId` and `req.user.id`. Affected controllers — `NotificationsController`, `ReportingController`, `AiProposalController`, `BillingController` — were fixed in Phase K. Any external code or tests that mock the old field names must be updated.

---

## 8. Security Assessment Summary

Full detail is in `docs/phase-n-security-audit-report.md`. No `docs/SECURITY_AUDIT.md` exists — the canonical security report is the phase N audit.

| Control | Status |
|---------|--------|
| Cookie-based auth: HttpOnly, SameSite:Strict, Secure in production | Confirmed |
| Password hashing: bcrypt, 12 rounds | Confirmed |
| Username enumeration prevention: constant-time fake compare on unknown email | Confirmed (`auth.service.ts:124`) |
| 10-role RBAC via `PermissionsGuard` | Confirmed (with noted gaps in photos and segment-jobs controllers) |
| Parameterized SQL throughout (no string interpolation with user input) | Confirmed — all queries use `$1`, `$2`, ... placeholders |
| Rate limiting: auth 10/60s (Redis), AI copilot 20/60s, global 100/60s | Confirmed |
| Helmet enabled (security headers) | Confirmed; CSP disabled (`contentSecurityPolicy: false`) — medium risk |
| CORS: allowlist only (`FRONTEND_URL`, `localhost:3000`, `localhost:3005`) | Confirmed |
| PHI encryption (patient name, DOB, clinical notes) | **ABSENT** — P0 blocker (see Section 6) |
| `npm audit`: automated dependency scanning in CI | **ABSENT** — no Snyk/Trivy/audit workflow |
| Penetration testing | **NOT CONDUCTED** — recommended before GA |
| JWT algorithm pinning in `jwt.verify()` | **ABSENT** — algorithm not restricted to HS256 |

---

## 9. Performance Assessment Summary

Full detail is in `docs/phase-o-operations-observability-report.md`. No `docs/PERFORMANCE_AUDIT.md` exists — the canonical performance report is the phase O report.

- Frontend: Next.js 14 static export — no SSR overhead; pages are pre-built HTML/JS
- Slow query logging: `slow-query.logger.ts` warns at `SLOW_QUERY_THRESHOLD_MS` (default 500ms); threshold configurable via env var (undocumented in ENV_VARS.md)
- IPR planner N+1 eliminated: `autoRecommend` previously issued up to 26 sequential INSERTs; now batched as a single UNNEST INSERT (confirmed by unit test asserting exactly 4 DB calls)
- Clinical report generation: 4–5 DB queries per report (patient + case + plan + report record); acceptable for v1 load
- Paginated list endpoints: patients default 100, cases default 100, IPR items default 200 / max 500
- DB connection pool: max 20 connections, 5s connection timeout, 30s statement timeout (`database.module.ts`)
- No query result caching: acceptable for v1 load; recommendation: add Redis caching for per-org patient/case lists at v1.1
- No load testing conducted: pagination limits prevent unbounded memory growth but actual request-per-second ceiling is unknown
- Recommendation before GA: add DB indexes on `notifications(user_id, created_at)`, `cases(patient_id)`, `audit_events(resource_type, resource_id)` — Phase O confirmed these are missing

---

## 10. Future Roadmap (v1.1 → v2.0)

### v1.1 (next quarter — prerequisite for clinical use)
- Unit test coverage for auth, case, copilot, and patient service modules
- OpenAPI/Swagger endpoint documentation (`@nestjs/swagger`)
- Redis-backed JWT denylist for session revocation on logout
- Pagination cursor implementation (replace offset-based pagination on high-volume tables)
- ESLint v9 config (`eslint.config.js`) — currently missing; `npm run lint` exits 0 without linting
- PHI encryption implementation in `patients.service.ts` using existing `CryptoService`
- Add `USER node` directive to all three Dockerfiles
- Fix migration 021 to be idempotent on fresh install
- Add `SLOW_QUERY_THRESHOLD_MS` to ENV_VARS.md
- Implement frontend data adapters for AI Copilot, Analytics, and Scans UI features

### v1.5
- DICOM scan viewer integration
- Trained MONAI UNet segmentation model weights (clinical-grade, validated against annotated dataset)
- Little's Irregularity Index and Pont's Index clinical algorithm implementations
- Multi-language (i18n) support
- Prometheus-format `/metrics` endpoint for Grafana integration
- OpenTelemetry exporter configured for distributed tracing

### v2.0
- Patient mobile app (React Native)
- Third-party lab and aligner manufacturer integrations
- Multi-region deployment with data residency controls
- SSO/SAML integration for enterprise customers
- PostgreSQL row-level security for database-layer tenant isolation

---

## 11. Upgrade Guide (from beta.1 to GA)

For operators running beta.1 who will upgrade to the GA release:

1. **Apply PHI encryption migration** (new in GA): A data migration script will encrypt existing plaintext PHI fields using the `ENCRYPTION_KEY` value. Back up the database before running. The migration is destructive and cannot be reversed without the key.

2. **Run database migrations** (idempotent, safe to re-run for migrations 022–054): `psql $DATABASE_URL < database/migrations/XXX.sql` for any unapplied migration. Check migration 021 status separately — it is not idempotent in the current build and may need manual handling.

3. **Update environment variables**: Review `docs/ENV_VARS.md`. No new *required* variables were added between beta.1 and GA. `SLOW_QUERY_THRESHOLD_MS` is newly supported (optional, defaults to 500ms).

4. **Deploy backend**: Build with `npm run build`, start with `node dist/src/main.js`. Verify startup logs show no `ERROR` entries and that the config validator passes.

5. **Deploy frontend**: Run `next build` and deploy the `out/` directory (static export) to your CDN or web server.

6. **Verify health endpoint**: `GET /api/version/health` should return HTTP 200 with `{ status: 'ok' }`. `GET /health/ready` should return `{ ready: true }` (note: HTTP status will be 200 even on failure until the HTTP-503 fix is applied in v1.1).

7. **Verify error shape change**: Confirm that any API consumer code does not rely on `error` or `path` fields in error responses (see Section 7). The new shape is `{ statusCode, errorCode, message, requestId, timestamp }`.

8. **Set `MYORTHO_ADMIN_PASSWORD`**: Required before first login if using the built-in admin account. If unset, the system falls back to `adminadmin` and emits a startup warning — this is a security failure in production.

---

## 12. Version Matrix

| Component | Version | Runtime |
|-----------|---------|---------|
| Backend | 1.0.0-beta.1 | Node.js 20+ |
| Frontend | 1.0.0-beta.1 | Static export (no runtime) |
| Database | PostgreSQL 16 | Schema version 054 (`054_copilot_confidence_explainability.sql`) |
| NestJS | 10.3.8 | — |
| Next.js | 14.2.3 | — |
| AI Engine | — | Python 3.x, FastAPI, MONAI (no trained weights) |
| Redis | 7.x (Docker Compose) | `--maxmemory 256mb --maxmemory-policy allkeys-lru` |

---

## 13. Support Matrix

| Feature | v1.0.0-beta.1 | Notes |
|---------|--------|-------|
| Cookie-based auth | Supported | HttpOnly, SameSite:Strict, Secure in production |
| Multi-org RBAC | Supported | 10 roles, 15 permissions |
| AI Copilot (rule-based) | Supported | Always active; no LLM_API_KEY required |
| AI Copilot (LLM path) | Optional | Requires `LLM_API_KEY` env var |
| SMTP Email | Optional | Requires `SMTP_*` env vars; nodemailer loaded at runtime |
| Scan Uploads | Supported | 50 MB max; AI engine must be running |
| AI Segmentation | Not clinical-ready | Pipeline functional; no trained model weights in repo |
| Patient Portal | Supported | Compliance checklist, print support |
| Clinical Reports | Supported | 3 report types (treatment summary, aligner progress, insurance pre-auth) |
| PDF Export | Supported | HTML download with print CSS (`/api/cases/:caseId/reports/:id/download`) |
| Audit Trail | Supported | Data events only; auth events (login/logout) not yet logged to audit_events |
| Webhooks | Supported | HMAC-SHA256 signed, 3-retry |
| Billing (Stripe) | Supported | Checkout, subscription lifecycle, usage metering |
| Manufacturing Pipeline | Partial | API endpoints complete; no real printer communication |
| FHIR Export | Partial | Patient + CBCT Observation R4; case export query broken (`cases.organization_id` missing) |
| OpenTelemetry Tracing | Not functional | SDK initialized; no exporter configured |

---

## 14. Maintenance Plan

- **Security patches**: Apply within 7 days of CVE disclosure for direct dependencies; within 30 days for transitive dependencies
- **Dependency audit**: `npm audit` must run weekly in CI (not yet configured in `.github/workflows/`)
- **Database backup**: Daily automated backup required before production. No backup configuration currently exists in Docker Compose or deployment scripts — this is a pre-production requirement
- **Backup restore test**: Quarterly restore drill against a staging environment
- **On-call rotation**: Required before any production deployment. No runbook currently exists in the repo
- **Health endpoint monitoring**: Poll `GET /health` every 60 seconds; alert on non-200 response
- **Readiness probe**: Poll `GET /health/ready` every 30 seconds; alert on `ready: false` in response body (HTTP status will incorrectly be 200 until v1.1 fix)
- **Log retention**: 90 days minimum for audit trail compliance (HIPAA requires audit logs for 6 years from creation or last effective date)
- **Slow query review**: Weekly review of slow query log entries (threshold: 500ms); index accordingly

---

## 15. Checklist: GA Release Gates

The following gates must pass before the GA release. Items marked PASSED are based on evidence from the Phase P / final RC validation run (2026-07-02). Items marked REQUIRED are unverified and must be completed by the releasing team.

- [x] TypeScript (backend): `tsc --noEmit` — **PASSED** as of 2026-07-02 (0 errors)
- [x] TypeScript (frontend): `tsc --noEmit` — **PASSED** as of 2026-07-02 (0 errors)
- [x] Backend unit tests: `npx jest` — **PASSED** 75/75
- [x] Frontend Vitest: `npx vitest run` — **PASSED** 98/98
- [x] AI Engine pytest: `python -m pytest tests/` — **PASSED** 9/9
- [x] Docker Compose config: `docker compose config --quiet` — **PASSED** (valid)
- [x] Clinical disclaimer present in all AI copilot outputs — **CONFIRMED** by source review
- [x] Rate limiting verified on auth endpoints (10 req/60s) — **CONFIRMED** by source review
- [x] Error response shape (`{ statusCode, errorCode, message, requestId, timestamp }`) — **CONFIRMED** active via GlobalExceptionFilter
- [ ] **PHI encryption implemented** in `patients.service.ts` — **REQUIRED** (P0 blocker — currently absent)
- [ ] **`Math.random()` clinical measurements removed** from `clinical-analysis-deep.service.ts` — **REQUIRED** (P0 blocker)
- [ ] **Migration 021 idempotency fix** — REQUIRED (P1 — fresh install fails with ON_ERROR_STOP=1)
- [ ] **`organization_id` column added** to `cases` and `scans` tables (or all queries refactored to use join) — REQUIRED (P1)
- [ ] **`PhotosController` RBAC guard** added (`@RequirePermission`) — REQUIRED (High — PHI accessible to any authenticated user)
- [ ] **Containers not running as root** (add `USER node` to all three Dockerfiles) — REQUIRED (High)
- [ ] `npm audit`: no critical or high vulnerabilities — REQUIRED (no CI security workflow exists)
- [ ] Database migrations: all 054 applied and verified on target environment — REQUIRED
- [ ] ENV_VARS.md reviewed for accuracy (add `SLOW_QUERY_THRESHOLD_MS`) — REQUIRED
- [ ] Health endpoint `/health/ready` returns HTTP 503 when `ready: false` — REQUIRED (P2 — currently always returns 200)
- [ ] SMTP optional path verified in production (logs warning, does not crash) — REQUIRED
- [ ] `MYORTHO_ADMIN_PASSWORD` env var set (non-default) — REQUIRED
- [ ] `JWT_SECRET` is ≥ 32 random characters — REQUIRED (`openssl rand -hex 32`)
- [ ] Trained AI segmentation model checkpoint placed and `MODEL_CHECKPOINT` env var set — REQUIRED for clinical segmentation path
- [ ] No penetration test conducted — **RECOMMENDED** before GA (not a code-gate, but a clinical risk gate)
- [ ] On-call runbook created — RECOMMENDED before GA
