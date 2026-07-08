# MyOrtho.tech — Architecture Overview

> Last updated: 2026-07-08

This document is written for a new engineer joining the project. It describes the system as it actually exists, grounded in the source files.

---

## System Overview

MyOrtho.tech is a cloud-based orthodontic practice management platform. It covers the full clinical workflow from patient intake through aligner manufacturing. Key capabilities include:

- Case management and patient portal
- AI-assisted treatment copilot with RAG pipeline and SSE streaming
- 3D scan ingestion, STL processing, and tooth segmentation
- Digital CAD setup, tooth movement planning, attachment and IPR planning
- Aligner staging and generation
- QC scoring and pre-export validation
- Clinical report generation with approval workflow
- Multi-organisation RBAC (six built-in roles)
- Admin console, audit trail, observability, and billing

The system is deployed as a NestJS backend API and a Next.js static-export frontend. They communicate over a credentialed REST API with cookie-based session auth.

---

## Technology Stack

### Backend

| Concern | Choice |
|---|---|
| Runtime | Node.js (TypeScript, NestJS 10) |
| Database | PostgreSQL 16 (`pg` pool, raw SQL — no ORM) |
| Session cache | Redis (ioredis, optional — in-memory fallback when `REDIS_URL` is absent) |
| Auth | HttpOnly cookie (`mo_session`) carrying a HS256 JWT; token revocation via Redis blacklist |
| Real-time | Server-Sent Events (SSE) for AI copilot streaming |
| Rate limiting | `@nestjs/throttler` — global default 100 req / 60 s per IP; stricter limits on auth endpoints |
| Security middleware | Helmet (CSP, HSTS 1 year + preload, COOP), CORS whitelist |
| Email | Nodemailer (optional, dynamically imported; suppressed gracefully when SMTP env vars are absent) |

### Frontend

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Build output | Static export (`output: 'export'`), served from `next-build/` |
| Font | Manrope (Google Fonts, CSS variable `--font-sans`) |
| 3D rendering | React Three Fiber + Drei (tree-shaken via `optimizePackageImports`) |
| Design system | CSS custom properties (light/dark via `.dark` class on `<html>`) |
| Mobile shell | Capacitor-compatible `AppShell` with launch skeleton |
| State | React context (`AuthContext`, `ThemeContext`, `ToastContext`) |

### Infrastructure

- PostgreSQL cluster (Supabase-compatible schema with `auth.uid()` stub for plain Postgres)
- Node.js process — not containerised in application code; containerisation is an ops concern
- Redis optional; auth falls back to an in-memory rate-limit map and blacklist set

---

## Backend Module Map

`AppModule` is the root module. It applies two middlewares to all routes and registers `ThrottlerGuard` as a global `APP_GUARD`. All feature modules are imported in `AppModule`.

### Global Infrastructure Modules

These three modules are decorated `@Global()`, meaning their exported tokens are available in every other module without an explicit import.

| Module | Exports / Owns |
|---|---|
| `CommonModule` | `CryptoService` (AES-256-GCM PHI encryption), `CorrelationIdMiddleware`, `VersionController` (`GET /version`) |
| `DatabaseModule` | `PG_POOL` injection token — a `pg.Pool` configured from `DATABASE_URL`; max 20 connections; 30 s statement timeout enforced both at pool level and per-connection via `SET statement_timeout` |
| `RedisModule` | `REDIS_CLIENT` injection token — an `ioredis` client, or `null` when `REDIS_URL` is absent; all consumers must handle the `null` case |

### Auth and Audit

| Module | Owns |
|---|---|
| `AuthModule` (@Global) | `AuthService` (login, logout, token sign/verify, bcrypt, Redis token blacklist), `AuthGuard` (cookie validation), `PermissionsGuard` (role-based access); exports all three |
| `AuditModule` | Persistent audit trail writes; imported by `AuthModule` so every login/logout event is logged |
| `SsoModule` | SSO provider integration |
| `WorkflowModule` | Workflow state machine and transitions |

### Clinical Data

| Module | Owns |
|---|---|
| `CasesModule` | Cases CRUD, AI scores, digital-twin data |
| `PatientsModule` | Patient demographics and PHI |

### Scans and STL Processing

| Module | Owns |
|---|---|
| `ScansModule` | Scan record management |
| `ScanProcessingModule` | Scan pipeline orchestration |
| `StlProcessingModule` | STL file parsing and mesh operations |
| `ScannerModule` | Scanner device connectors |

### AI and Segmentation

| Module | Owns |
|---|---|
| `AiModule` | AI orchestrator, monitoring interfaces, dataset registry |
| `SegmentationModule` | Tooth segmentation pipeline, auto-correction |
| `ToothSegmentationModule` | Tooth-level segmentation logic |
| `AiProposalModule` | AI-generated treatment proposals |
| `AiSuggestionsModule` | Contextual clinical suggestions |
| `CopilotModule` | AI treatment copilot (see AI Copilot Architecture below) |

### Clinical Analysis

| Module | Owns |
|---|---|
| `AnalysisModule` | General clinical analysis, Bolton analysis |
| `ClinicalAnalysisDeepModule` | Deep clinical analysis pipeline |
| `OcclusionAnalysisModule` | Occlusion assessment |
| `BiomechanicsModule` | Force and biomechanical calculations |
| `CephModule` | Cephalometric analysis |
| `GrowthPredictionModule` | Paediatric growth prediction |
| `ClinicalDecisionSupportModule` | Clinical decision support rules |

### Treatment Planning

| Module | Owns |
|---|---|
| `TreatmentPlansModule` | Treatment plan CRUD, tooth movement prescriptions |
| `TreatmentGoalsModule` | Treatment goal tracking |
| `TreatmentSimulationModule` | 3D simulation state |

### CAD and Tooth Movement

| Module | Owns |
|---|---|
| `DigitalSetupModule` | Digital CAD setup |
| `ToothMovementModule` | Movement prescription data |
| `MovementConstraintsModule` | Biomechanical movement limits |
| `ArchCoordinationModule` | Upper/lower arch coordination |
| `RefinementModule` | Refinement case handling |
| `RetentionModule` | Retention phase planning |

### Attachments and IPR

| Module | Owns |
|---|---|
| `AttachmentPlannerModule` | Attachment placement planning |
| `AttachmentLibraryModule` | Attachment geometry library |
| `AttachmentIntelligenceModule` | AI-assisted attachment optimisation |
| `IprPlannerModule` | IPR chart generation |
| `IprIntelligenceModule` | AI-assisted IPR recommendations |

### Staging and Aligner Generation

| Module | Owns |
|---|---|
| `StagesModule` | Stage records |
| `TreatmentStagesModule` | Per-stage clinical data |
| `AlignerGenerationModule` | Aligner geometry generation |
| `AlignerDesignModule` | Aligner design parameters |

### QA and Export

| Module | Owns |
|---|---|
| `PreexportQaModule` | Pre-export quality checks |
| `TreatmentQAModule` | Clinical QA scoring |
| `QcModule` | QC pass/fail records |
| `ExportPackageModule` | Export bundle assembly |

### Manufacturing and Print Prep

| Module | Owns |
|---|---|
| `ManufacturingModule` | Manufacturing job management and routing |
| `ManufacturePrepModule` | Nesting and print preparation |
| `PrintersModule` | Printer connector adapters |

### Clinical Reports and Photos

| Module | Owns |
|---|---|
| `ClinicalReportsModule` | Report generation, Markdown + JSON content, approval workflow |
| `PhotosModule` | Clinical photo management |

### Imaging

| Module | Owns |
|---|---|
| `RadiologyModule` | 2D radiograph management |
| `CbctModule` | CBCT scan handling |

### Platform Services

| Module | Owns |
|---|---|
| `HealthModule` | `GET /health` liveness endpoint |
| `ObservabilityModule` | Request metrics (latency, error rate); consumed by `TimingMiddleware` |
| `PlatformHealthModule` | Subsystem health dashboard data |
| `SystemStatusModule` | Public system status |
| `NotificationsModule` | In-app notifications + email via `EmailService` |
| `AdminModule` | Admin user and org management |
| `OrgLocationsModule` | Clinic location records |
| `WebhooksModule` | Outbound webhook delivery |
| `EventsModule` | Internal event bus |
| `MessagingModule` | In-platform messaging |
| `CollaborationModule` | Multi-user collaboration |
| `FeatureFlagsModule` | Per-org feature flags |
| `FhirModule` | FHIR R4 export |
| `EmergencyProtocolsModule` | Clinical emergency protocol lookup |
| `BillingModule` | Subscription and billing |
| `OrgBrandingModule` | Per-org branding configuration |
| `ReleasesModule` | Release notes and version management |

---

## Frontend Page Map

The frontend uses Next.js App Router with static export. All routes become static HTML files.

| Route | Description |
|---|---|
| `/` | Root redirect (resolves to `/dashboard`) |
| `/dashboard` | Main dashboard |
| `/login` | Login form |
| `/signup` | New account registration |
| `/onboarding` | First-run onboarding wizard |
| `/cases` | Case list |
| `/cases/new` | New case creation |
| `/cases/[id]` | Case detail (scans, treatment plan, copilot, reports) |
| `/patients` | Patient list |
| `/patients/[id]` | Patient detail |
| `/treatment-plan` | Treatment planning view |
| `/studio` | 3D CAD studio (Three.js) |
| `/export` | Export package builder |
| `/analytics` | Practice analytics |
| `/ai-readiness` | AI readiness assessment |
| `/patient-portal` | Patient-facing portal |
| `/platform-health` | Internal platform health dashboard |
| `/settings` | User/org settings |
| `/settings/branding` | Organisation branding |
| `/admin` | Admin console |
| `/admin/users` | User management |
| `/admin/org` | Organisation management |
| `/admin/audit` | Audit log viewer |
| `/trust` | Trust and compliance page |
| `/download` | Desktop app download hub |
| `/download/docs` | Documentation |
| `/download/enterprise` | Enterprise download |
| `/download/privacy` | Privacy policy |
| `/download/release-notes` | Release notes |
| `/download/support` | Support |
| `/download/system-requirements` | System requirements |
| `/download/terms` | Terms of service |
| `/(desktop)/desktop` | Electron/Capacitor desktop shell route |

---

## Request Lifecycle

A typical authenticated API request follows this path:

```
HTTP request
  → CorrelationIdMiddleware
      Reads X-Correlation-ID / X-Request-ID header, or generates a UUID.
      Attaches to req.correlationId; echoes both headers on the response.
  → TimingMiddleware
      Records start time. On response end: sets X-Response-Time header,
      calls ObservabilityService.recordRequest(), logs:
      [correlationId] METHOD /path STATUS Nms
  → ThrottlerGuard (APP_GUARD)
      Rejects at 429 if IP exceeds 100 req/60s (stricter on auth routes).
  → AuthGuard
      Reads mo_session cookie → verifies HS256 JWT (jsonwebtoken) →
      checks Redis token blacklist (falls back to in-memory set) →
      attaches SessionPayload to request.
  → PermissionsGuard
      Reads @Permissions() decorator on handler → checks SessionPayload.role
      against required permissions → 403 if insufficient.
  → ValidationPipe
      Strips unknown properties (forbidNonWhitelisted), transforms types,
      rejects malformed DTOs with 422.
  → Controller → Service → pg.Pool → PostgreSQL
  → LoggingInterceptor (wraps entire handler)
  → GlobalExceptionFilter (catches any thrown exception)
      Maps HttpException to correct status + ErrorCode envelope.
      Logs 5xx errors with correlation ID and stack trace.
      Never leaks internal error details to client on 5xx.
  → JSON response
```

Public endpoints (e.g. `POST /auth/login`, `GET /health`) opt out of `AuthGuard` via the `@Public()` decorator.

---

## AI Copilot Architecture

`CopilotModule` provides the AI treatment assistant. It has two operational modes:

**Rule-based mode (no `LLM_API_KEY`):** Intent classification runs on keyword matching (`MODULE_KEYWORDS` map covering prescriptions, IPR, attachments, simulation, segmentation, and more). Responses are generated deterministically from clinical data.

**LLM mode (`LLM_API_KEY` set):** The `AgentRouterService` selects the appropriate specialist agent. The `ContextBuilderService` assembles case context. The `LlmService` streams completions. The `EmbeddingService` and `VectorStoreService` power the RAG pipeline for knowledge retrieval. `KnowledgeIndexerService` maintains the vector index.

**Streaming:** Responses are delivered as Server-Sent Events. The `StreamEvent` type carries `type` (`meta` | `delta` | `done` | `error`), partial `content`, `sources`, `confidence`, and `explainability`.

**Confidence levels** (persisted as `confidence_level` in DB):
`very_high` | `high` | `medium` | `low` | `unknown`

**Explainability data** (persisted as `explainability_data` in DB):
```typescript
interface ExplainabilityData {
  why: string;           // plain-language rationale
  evidence: string[];    // supporting clinical data points
  limitations: string[]; // known gaps or caveats
  reviewSteps: string[]; // recommended clinician verification steps
}
```

Suggestions carry a `severity` (`info` | `warning` | `critical`) and a lifecycle status (`open` | `acknowledged` | `dismissed` | `applied`). All AI output includes a clinical disclaimer and is never fabricated without a data source.

---

## Data Flow for Case Processing

```
Patient created (PatientsModule)
  → Case created (CasesModule, status: draft)
  → Scans uploaded (ScansModule)
  → Scan processing pipeline (ScanProcessingModule, StlProcessingModule)
  → Tooth segmentation (SegmentationModule, ToothSegmentationModule)
  → AI analysis (AiModule, ClinicalAnalysisDeepModule, OcclusionAnalysisModule, BiomechanicsModule)
  → Treatment plan created (TreatmentPlansModule, status: planning)
  → Copilot consultation (CopilotModule — suggestions surfaced to clinician)
  → Treatment goals set (TreatmentGoalsModule)
  → Attachment + IPR planning (AttachmentPlannerModule, IprPlannerModule)
  → QC scoring (QcModule, TreatmentQAModule)
  → Aligner staging (StagesModule, TreatmentStagesModule, AlignerGenerationModule)
  → Pre-export QA (PreexportQaModule)
  → Clinical report generated (ClinicalReportsModule)
  → Approval workflow (status: pending_approval → approved)
  → Export package assembled (ExportPackageModule)
  → Manufacturing jobs created (ManufacturingModule, ManufacturePrepModule)
  → Print jobs dispatched to printers (PrintersModule)
  → Case completed (status: completed)
```

---

## Security Architecture

| Layer | Mechanism |
|---|---|
| Transport | HTTPS enforced via HSTS (`max-age=31536000; includeSubDomains; preload`) |
| Session cookie | `mo_session` — HttpOnly, SameSite: Strict, 24 h expiry |
| Token algorithm | HS256 (`jsonwebtoken`), minimum 32-char secret enforced at startup |
| Token revocation | Redis blacklist keyed by JWT ID (`jti`); in-memory fallback |
| CORS | Explicit origin allowlist (`FRONTEND_URL` + localhost in dev only); credentials: true |
| Content Security Policy | Helmet-managed; `default-src 'self'`; connects permitted to Supabase and Stripe |
| Input validation | `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true` — mass-assignment blocked globally |
| Rate limiting | Global 100 req / 60 s per IP; auth endpoints have stricter per-route `@Throttle()` decorators |
| PHI encryption | `CryptoService` (AES-256-GCM); `ENCRYPTION_KEY` enforced in production |
| RBAC | Six roles: `enterprise_admin`, `clinic_admin`, `dentist`, `lab_technician`, `operator`, `patient`; enforced by `PermissionsGuard` via `@Permissions()` decorator |
| Audit trail | All sensitive operations written to `AuditModule`; accessible via admin console |
| Password hashing | bcrypt, 12 rounds |
| SQL injection | Parameterised queries throughout; no string interpolation in SQL paths |
| Startup checks | `assertRequiredEnv()` and `validateConfig()` fail fast on missing secrets |

---

## Database Schema Highlights

The schema (`database/schema.sql`) targets PostgreSQL 16 and is Supabase-compatible (includes `auth.uid()` stub for plain Postgres deployments).

**Enums:**
- `user_role`: `enterprise_admin | clinic_admin | dentist | lab_technician | operator | patient`
- `case_status`: `draft | scan_uploaded | segmenting | planning | pending_approval | approved | staging | manufacturing | completed | canceled`
- `job_status`: `queued | nesting | printing | cleaning | curing | qc_pending | completed | failed`

**Core tenancy tables:** `organizations` (supports `clinic | lab | enterprise` with self-referencing `parent_id` for enterprise hierarchies), `profiles` (extends Supabase `auth.users`).

All PKs are UUID v4. All timestamps are `TIMESTAMP WITH TIME ZONE` defaulting to `timezone('utc', now())`.

---

## Environment Variables (Key Ones)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Minimum 32 characters |
| `MYORTHO_ADMIN_PASSWORD` | Yes | Bootstrap admin password |
| `ENCRYPTION_KEY` | Yes in prod | PHI encryption; degraded mode warns in dev |
| `FRONTEND_URL` | Yes in prod | CORS allowlist; e.g. `https://app.myortho.tech` |
| `REDIS_URL` | No | Falls back to in-memory if absent |
| `LLM_API_KEY` | No | Copilot falls back to rule-based mode if absent |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | No | Email suppressed gracefully if absent |
| `PORT` | No | Default `4000` (bootstrap) / `4001` (config validator) |
| `PG_POOL_MAX` | No | Default `20` |
