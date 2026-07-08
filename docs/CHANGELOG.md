# Changelog

All notable changes to MyOrtho.tech are documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Version numbers follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased] — 1.0.0 GA

### Added
- Password reset flow (email token, one-time use, 1-hour expiry)
- Multi-factor authentication (TOTP via authenticator app)
- SAML 2.0 / SSO integration for enterprise organizations
- Patient list with search, filter by status, and pagination (currently simulated)
- Bolton analysis as a computed result (currently editable-input simulation)
- AI Copilot: persistent suggestion history across sessions
- AI Copilot: clinician feedback loop (thumbs up/down on suggestions, fed back into confidence recalibration)
- Refinement case workflow: branch a completed case into a refinement treatment plan
- Retention protocol generation linked to final aligner stage
- FHIR R4 resource export for treatment plans and patient demographics
- Webhook delivery retry with exponential back-off and per-org dead-letter log
- Feature flag admin UI (toggle flags per organization without deployment)
- Batch manufacturing: multi-case nesting optimization endpoint (`POST /api/manufacturing/batch`)
- Print farm multi-printer queue assignment with priority lanes
- Patient portal: appointment scheduling, aligner progress view, and message thread with clinician

### Changed
- AI Copilot confidence levels (`very_high`, `high`, `medium`, `low`) to surface explainability evidence in UI alongside each response
- `GET /health/ready` to include Redis reachability in the checks object alongside database connectivity
- Audit trail CSV export to include `correlation_id` column for cross-service log correlation
- Case status machine: add `on_hold` state between `pending_approval` and `approved` to support multi-reviewer workflows

### Fixed
- Race condition in token blacklist fallback (in-memory set) when Redis reconnects — tokens invalidated during Redis downtime are now re-checked against the database session table on reconnect
- `ENCRYPTION_KEY` length warning incorrectly suppressed in non-production environments when key was exactly 32 characters
- `GET /api/cases/:caseId/reports` returning 500 when `organization_id` was null on the session (now returns 401 with `AUTH_003`)
- Correlation ID echoed back on responses was truncated when client sent an `X-Request-Id` longer than 36 characters

### Security
- Rotate all beta test secrets prior to GA; document rotation procedure in `docs/ENV_VARS.md`
- Add `Strict-Transport-Security` preload submission for `myortho.tech` and `api.myortho.tech`
- Pin Docker base images to digest SHA in `docker-compose.yml` for reproducible production builds

---

## [1.0.0-beta.1] — 2026-07-08

First public beta release. All items below are implemented and running in the
Docker Compose production stack at `myortho.tech` / `api.myortho.tech`.

### Added

#### Platform & Infrastructure
- NestJS 10 backend (`/backend`) with TypeScript strict mode, global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`), and `GlobalExceptionFilter` returning structured `ApiError` JSON on every error path
- Next.js 14 frontend (`/frontend`) with App Router, TypeScript, and Tailwind CSS
- PostgreSQL schema with 29 sequential migration files (`database/migrations/000_db_init.sql` through `029_phase_25_production_validation.sql`), applied in order by `database/migrate.sh`
- Docker Compose production stack: `myortho-db` (PostgreSQL), `myortho-cache` (Redis), `myortho-backend`, `myortho-frontend`, `myortho-ai` with Nginx reverse proxy and Let's Encrypt TLS
- Row Level Security (RLS) policies on all clinical tables (`organizations`, `profiles`, `patients`, `cases`, `scans`, `treatment_plans`, `aligner_stages`, `printers`, `print_jobs`, `audit_logs`, `segmentation_results`) enforcing organization-level tenancy isolation
- Startup configuration validation (`src/common/config.validator.ts`): exits process on missing `DATABASE_URL` or `JWT_SECRET`; warns on missing `SMTP_*`, `REDIS_URL`, `LLM_API_KEY`; blocks boot if `MYORTHO_ADMIN_PASSWORD` is unset; refuses to start in production without `FRONTEND_URL`
- Versioning endpoint: `GET /api/version` returns `{ app, api, buildDate, gitCommit, nodeVersion, environment }`; `GET /api/version/health` combines version info with liveness status
- Global rate limiting: 100 requests per 60 seconds per IP via `ThrottlerModule`; auth routes further restricted to 5 login attempts per 60 seconds per IP with Redis-backed counter and in-memory fallback
- Correlation ID middleware: echoes `X-Correlation-Id` / `X-Request-Id` on every response; attaches to request context for downstream service calls and error logs
- Global error code catalogue (`src/common/error-codes.ts`): 30 typed codes across AUTH, CASE, PATIENT, PLAN, SCAN, AI, MFG, ADMIN, RPT, VAL, and GEN domains — `AUTH_001` through `GEN_004`
- Helmet security headers: CSP, HSTS (`max-age=31536000; includeSubDomains; preload`), `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- HttpOnly session cookie (`mo_session`, `SameSite=Strict`, `Secure` in production) with 24-hour expiry and JWT blacklist revocation via Redis (in-memory fallback when Redis is unavailable)

#### Authentication & RBAC
- Email/password login with bcrypt (12 rounds) and JWT HS256 session tokens
- Token revocation: logout blacklists the `jti` claim in Redis with TTL matching remaining token lifetime
- 11-role RBAC model: `super_admin`, `admin`, `orthodontist`, `dentist`, `resident`, `clinical_director`, `lab_technician`, `lab_manager`, `vp_clinical`, `vp_manufacturing`, `executive`
- `PermissionsGuard` with `@RequirePermission()` decorator enforcing per-route capability checks (e.g., `patients:read`, `patients:write`)
- SSO module scaffolding (`src/sso/`) with SAML integration seam (login redirect, ACS handler) — not yet wired to an identity provider
- Audit log on every login success, login failure, and rate-limit hit (actor email, IP address, timestamp)

#### Patient & Case Management
- `POST /api/patients` — create patient with DOB, gender, clinical notes; audit logged
- `GET /api/patients` — list patients for org with pagination (`limit`, `offset`, max 500)
- `GET /api/patients/:id`, `PATCH /api/patients/:id` — retrieve and update patient record
- `GET /api/cases`, `POST /api/cases` — list and create cases; case linked to patient and dentist
- Case status machine with 10 states: `draft` → `scan_uploaded` → `segmenting` → `planning` → `pending_approval` → `approved` → `staging` → `manufacturing` → `completed` / `canceled`
- `PATCH /api/cases/:id/status` — advance case state with clinical note; invalid transitions return `CASE_002`
- Workflow module (`src/workflow/`) for approval, rejection, and escalation actions with role-gated transitions

#### Scan Uploads & STL Processing
- `POST /api/cases/:caseId/scans` — multipart scan upload; validates `jaw_type` (`maxillary`, `mandibular`, `both`), format (`stl`, `obj`, `ply`, `dicom`, `cbct`), and file size
- Scan record stores `file_path` (object storage key), `file_size_bytes`, and `mesh_validation_metrics` JSON (thin-wall alerts, hole count, triangle count)
- STL processing pipeline (`src/stl-processing/`) for mesh repair and validation
- Scanner integration table: vendor connections for 3Shape, Medit, iTero, Shining3D

#### AI Copilot
- Conversational clinical AI: `POST /api/cases/:caseId/copilot/conversations` — start conversation scoped to a case and optional treatment plan
- `POST /api/cases/:caseId/copilot/conversations/:id/messages` — send message, rate limited to 20 per 60 seconds
- `POST /api/cases/:caseId/copilot/conversations/:id/stream` — Server-Sent Events streaming with `meta`, `delta`, `done`, `error` event types; `X-Accel-Buffering: no` for Nginx compatibility
- Agent router (`src/copilot/rag/agent-router.service.ts`) classifying intent into modules: `prescriptions`, `ipr`, `attachments`, `simulation`, `segmentation`; routes to specialist sub-agents
- Confidence scoring: every Copilot response carries `confidenceLevel` (`very_high` | `high` | `medium` | `low` | `unknown`) derived from evidence count and inter-agent agreement
- Explainability data: every response includes `{ why, evidence[], limitations[], reviewSteps[] }` — clinician can see the reasoning chain, not just the conclusion
- Proactive suggestions: `GET /api/cases/:caseId/copilot/suggestions` — AI-generated alerts (severity `info` | `warning` | `critical`) per module with acknowledgement/dismiss/apply status tracking

#### Treatment Plans
- `POST /api/cases/:caseId/plans` — create treatment plan with estimated stages, IPR details, and AI recommendation notes
- `GET /api/cases/:caseId/plans`, `GET /api/cases/:caseId/plans/:planId` — list and retrieve plans
- `POST /api/cases/:caseId/plans/:planId/approve` — doctor approval with digital signature field; sets `doctor_approval=true` and `approved_at` timestamp
- Treatment goals (`src/treatment-goals/`), treatment simulation (`src/treatment-simulation/`), and treatment QA (`src/treatment-qa/`) endpoints

#### Aligner Staging & IPR Plans
- `POST /api/cases/:caseId/plans/:planId/stages` — create aligner stage with stage number (unique per plan), maxillary/mandibular mesh paths, and per-tooth movement transformation matrices
- `GET /api/cases/:caseId/plans/:planId/stages` — list all stages in order
- IPR planner: `GET|POST /api/cases/:caseId/plans/:planId/ipr` — manage interproximal reduction items per tooth pair with amount in mm and planned stage; `DELETE /api/cases/:caseId/plans/:planId/ipr/:itemId`
- IPR intelligence module (`src/ipr-intelligence/`) for AI-guided IPR amount recommendations based on tooth geometry and crowding severity
- Attachment planner and attachment intelligence modules for attachment type selection, placement, and force vector validation

#### QC Scoring
- `GET /api/qc/jobs` — list QC jobs for org (max 500)
- `POST /api/qc/jobs/:jobId/init` — initialize standard check suite for a print job
- `PATCH /api/qc/jobs/:jobId/checks/:checkId` — update individual check (status: `pass` | `fail` | `pending`; measured value; notes)
- Print job `quality_score` field (0.0–1.0) stored in `print_jobs` table and exposed on the manufacturing dashboard
- Pre-export QA module (`src/preexport-qa/`) for final mesh and prescription validation before manufacturing release

#### Clinical Reports
- `POST /api/cases/:caseId/reports/treatment-summary` — generates treatment summary report in Markdown with AI-assisted narrative covering diagnosis, planned movements, IPR schedule, and estimated duration
- `POST /api/cases/:caseId/reports/aligner-progress` — generates aligner progress report comparing planned vs. actual stage completion
- `POST /api/cases/:caseId/reports/insurance-preauth` — generates insurance pre-authorization letter with CDT codes, estimated fee, and clinical justification narrative; accepts `{ cdtCodes, estimatedFee, insurerId }`
- `GET /api/cases/:caseId/reports/:reportId/download` — returns formatted HTML document with print CSS, suitable for direct browser printing; includes AI disclaimer footer
- `GET /api/cases/:caseId/reports` — list all generated reports for a case

#### Notifications
- In-app notification system: `POST` (internal), `GET /api/notifications` (list, 50 most recent), `PATCH /api/notifications/:id/read`, `GET /api/notifications/unread-count`
- 13 typed notification events: `case_approved`, `case_submitted`, `case_rejected`, `plan_ready`, `plan_approved`, `qc_passed`, `qc_failed`, `print_completed`, `print_failed`, `segmentation_done`, `segmentation_failed`, `analysis_saved`, `system`
- SMTP email delivery via nodemailer (dynamically imported); disabled gracefully when `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` are absent; configurable `SMTP_FROM` address

#### Patient Portal
- Patient-facing routes gated to `patient` role
- Appointment schedule view linked to `appointments` table (`scheduled_at`, `visit_reason`, `status`)
- Aligner progress summary (read-only view of current stage vs. total stages)
- Audit trail: every patient record access and modification logged to `audit_events` with `resource_type`, `resource_id`, `action`, `actor_id`, `ip_address`

#### Audit Trail
- `audit_events` table with org-scoped, actor-attributed log of all state-changing operations
- `GET /api/audit` — paginated audit log for org (limit, offset)
- Audit service (`src/audit/audit.service.ts`) used across auth, patients, cases, treatment plans, and admin modules; failures are non-fatal (logged but never crash the request)
- 11 auditable event types documented in `docs/API.md`
- CSV export endpoint for compliance reporting

#### Manufacturing & Print Farm
- Printer registry: `GET|POST /api/printers`, `PATCH /api/printers/:id` — manage printers with brand, model, status, IP, firmware version, material type and volume
- Print job lifecycle: `queued` → `nesting` → `printing` → `cleaning` → `curing` → `qc_pending` → `completed` / `failed`
- Device History Records (`device_history_records` table): batch number, manufactured_at, operator_id, qc_passed, SHA-256 hash of design files for ISO 13485 traceability
- CAPA log (`capa_logs` table): corrective and preventive action tracking with root cause, corrective action, preventive action, and status

#### Admin
- `GET /api/admin/stats` — platform-wide stats (super_admin only)
- `GET /api/admin/users` — paginated user list (super_admin only)
- `POST /api/admin/invite` — invite user by email with role (admin or super_admin)
- `PATCH /api/admin/users/:id/role` — role update; super_admin can update any user, admin can update users within their own org
- Organization branding (`src/org-branding/`) and locations (`src/org-locations/`) management

#### Observability
- `GET /health` — liveness: returns `{ status, service, version, uptimeSeconds, timestamp }`
- `GET /health/ready` — readiness: checks `DATABASE_URL` set and `SELECT 1` succeeds; returns 503 if not ready
- `LoggingInterceptor`: request/response duration logged on every route
- `TimingMiddleware`: adds `X-Response-Time` header in milliseconds
- Slow query logger (`src/common/slow-query.logger.ts`): logs queries exceeding configurable threshold
- Platform health, system status, and observability modules for extended telemetry endpoints

---

[Unreleased]: https://github.com/your-org/myortho.tech/compare/v1.0.0-beta.1...HEAD
[1.0.0-beta.1]: https://github.com/your-org/myortho.tech/releases/tag/v1.0.0-beta.1
