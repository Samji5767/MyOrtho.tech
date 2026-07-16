# API Reference — MyOrtho 2.0 RC1

Base URL: `http://localhost:3001` (backend) · `http://localhost:8000` (AI engine)

All authenticated endpoints require a valid session cookie (`mo_session`) or an `Authorization: Bearer <token>` header obtained from `POST /api/auth/login`.

---

## Authentication

### POST /api/auth/login
Authenticate and receive a session cookie.

**Rate limit:** 5 req/min per IP

**Body**
```json
{ "email": "user@clinic.com", "password": "string (min 8 chars)" }
```

**Response 200**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@clinic.com",
    "name": "Dr. Smith",
    "role": "orthodontist",
    "orgId": "uuid",
    "isOnboarded": true
  }
}
```

**Errors:** `401` invalid credentials · `429` rate limited

---

### POST /api/auth/register
Register a new organization and admin account.

**Rate limit:** 5 req/min per IP

**Body**
```json
{
  "email": "admin@clinic.com",
  "password": "string (min 8 chars)",
  "fullName": "Dr. Jane Smith",
  "clinicName": "Smith Orthodontics"
}
```

**Response 201** — same shape as `/api/auth/login` · Sets `mo_session` cookie.

---

### POST /api/auth/logout
Invalidate the current session (blacklists the JWT JTI).

**Response 200** `{ "ok": true }` · Clears `mo_session` cookie.

---

### GET /api/auth/session
Return the authenticated user from the current session.

**Response 200** — same shape as login `user` object.

**Errors:** `401` no session

---

### GET /api/me
Convenience alias for `GET /api/auth/session`. Used by the frontend app shell.

**Response 200** — flat user object (no `user` wrapper).

---

### POST /api/auth/onboarding
Mark the current user's onboarding as complete.

**Body** — any JSON object (preferences captured client-side; stored by the frontend).

**Response 200** `{ "ok": true, "role": "orthodontist" }`

---

### PATCH /api/auth/profile
Update the current user's display name or password.

**Body**
```json
{ "name": "Dr. Jane Smith" }
```

**Response 200** `{ "ok": true }`

---

## Patients

All endpoints require `patients:read` or `patients:write` permission.

### GET /api/patients
List patients for the authenticated user's organization.

**Query params:** `limit` (default 100, max 500) · `offset` (default 0)

**Response 200** — array of patient objects. PHI fields (name, DOB, gender) are decrypted before return.

---

### POST /api/patients
Create a patient. PHI fields are AES-256-GCM encrypted at rest.

**Body**
```json
{
  "firstName": "Jane",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-15",
  "gender": "female"
}
```

**Response 201** — created patient object with `id`.

---

### GET /api/patients/:id
Fetch a single patient by ID (org-scoped).

**Response 200** — patient object · `404` not found or wrong org.

---

### PATCH /api/patients/:id
Update patient fields.

**Body** — partial patient fields (same shape as POST body).

**Response 200** — updated patient object.

---

## Cases

All endpoints require `cases:read` or `cases:write` / `cases:approve` permission.

### GET /api/cases
List all cases for the organization.

**Query params:** `limit` (default 100, max 500) · `offset` (default 0)

**Response 200** — array of case objects.

---

### POST /api/cases
Create a new case.

**Body**
```json
{
  "patientId": "uuid",
  "reference": "CASE-001",
  "treatmentType": "full_arch"
}
```

**Response 201** — created case object.

---

### POST /api/cases/with-new-patient
Create a case and a new patient in a single transaction.

**Body** — combined patient + case fields.

**Response 201** — `{ "patient": {...}, "case": {...} }`

---

### GET /api/cases/analytics/summary
Practice-level case counts by status.

**Response 200**
```json
{
  "totalCases": 42,
  "activeCases": 15,
  "pendingReview": 3,
  "completedThisMonth": 4,
  "manufacturingQueue": 2,
  "archivedCases": 18,
  "draftCases": 5
}
```

---

### GET /api/cases/:id
Fetch a single case by ID (org-scoped).

**Response 200** — case object · `404` not found.

---

### PATCH /api/cases/:id
Update case fields (reference, treatment type, notes).

**Body** — partial case update fields.

**Response 200** — updated case object.

---

### POST /api/cases/:id/transition
Advance or revert the case workflow status.

**Body**
```json
{ "toStatus": "segmentation_reviewed", "notes": "All teeth confirmed" }
```

**Valid statuses:** `draft` → `scan_uploaded` → `segmentation_pending` → `segmentation_complete` → `segmentation_reviewed` → `planning` → `plan_ready` → `approved` → `manufacturing` → `completed` → `archived`

**Response 200** — updated case object.

---

### POST /api/cases/:id/approve
Approve the case (requires `cases:approve`). Equivalent to transitioning to `approved`.

**Body** `{ "notes": "optional approval note" }`

**Response 200** — updated case object.

---

### GET /api/cases/:id/ai-scores
AI confidence scores for the case segmentation.

**Response 200** — array of `{ toothId, score, label }` objects.

---

### GET /api/cases/:id/digital-twin
Retrieve the digital twin summary for a case.

**Response 200** — digital twin metadata object.

---

## Scans

### GET /api/cases/:caseId/scans
List all scans attached to a case.

**Response 200** — array of scan metadata objects.

---

### POST /api/cases/:caseId/scans
Upload a scan file (STL recommended, max 500 MB).

**Rate limit:** 10 req/min

**Content-Type:** `multipart/form-data`

**Fields:** `file` (binary) · `jawType` (`auto` | `maxillary` | `mandibular` | `both`, default `auto`)

**Response 201** — scan object with `id`, `status`, `fileFormat`, `jawType`.

**Validation:** watertightness, face count, and bounding-box checks run automatically. Invalid geometry is rejected with a description.

---

### GET /api/cases/:caseId/scans/:scanId
Fetch metadata for a single scan.

**Response 200** — scan object.

---

### GET /api/cases/:caseId/scans/:scanId/file
Stream the raw scan file (authenticated, org-scoped).

**Response 200** — binary file stream · `Content-Type: model/stl` (or `model/obj` / `application/octet-stream`).

---

### POST /api/cases/:caseId/scans/:scanId/segment
Trigger AI segmentation for a scan.

**Response 202** `{ "jobId": "uuid", "status": "queued" }`

Poll job status at `GET /api/segment-jobs/:jobId`.

**Disclaimer:** AI output is not clinically validated; requires licensed clinician review.

---

### GET /api/cases/:caseId/scans/segmentation-jobs
List all persisted segmentation jobs for a case.

**Response 200** — array of job status objects.

---

## Segmentation Jobs

### GET /api/segment-jobs/:jobId
Poll the status of an AI segmentation job.

**Response 200**
```json
{
  "job_id": "uuid",
  "status": "completed",
  "case_id": "uuid",
  "scan_id": "uuid",
  "queued_at": "ISO-8601",
  "completed_at": "ISO-8601",
  "result_path": "/data/uploads/org/.../seg"
}
```

**Statuses:** `queued` · `processing` · `completed` · `failed`

---

### POST /api/segment-jobs/:jobId/retry
Retry a failed segmentation job.

**Response 202** — updated job object.

---

## Treatment Plans

### GET /api/cases/:caseId/plans
List treatment plans for a case.

**Response 200** — array of plan objects.

---

### POST /api/cases/:caseId/plans
Create a treatment plan.

**Body**
```json
{
  "estimatedStages": 24,
  "aiRecommendationNotes": "optional string",
  "iprDetails": {}
}
```

**Response 201** — created plan object.

---

### GET /api/cases/:caseId/plans/:planId
Fetch a single plan.

**Response 200** — plan object including `doctorApproval`, `approvedAt`, `approvedBy`.

---

### PATCH /api/cases/:caseId/plans/:planId
Update plan metadata.

**Body** — partial plan fields.

**Response 200** — updated plan object.

---

### POST /api/cases/:caseId/plans/:planId/approve
Formally approve the treatment plan. Records approver identity and timestamp in the audit log.

**Body** `{ "signature": "Dr. Jane Smith" }`

**Constraint:** Plans with any simulated stages cannot be approved.

**Response 200** — plan with `doctorApproval: true`, `approvedAt`, `approvedBy`.

---

### POST /api/cases/:caseId/plans/:planId/stages/generate
Request AI-generated staging for the plan.

**Body** `{ "stageCount": 24 }` (optional, defaults to plan's `estimatedStages`)

**Response 200** — array of generated stage objects.

---

### GET /api/cases/:caseId/plans/:planId/stages
List all stages for a plan.

**Response 200** — array of stage objects (ordered by `stageNumber`).

---

### POST /api/cases/:caseId/plans/:planId/stages
Create a single stage.

**Body**
```json
{
  "stageNumber": 1,
  "maxillaryMeshPath": "optional string",
  "mandibularMeshPath": "optional string",
  "movements": {}
}
```

**Response 201** — created stage object.

---

### POST /api/cases/:caseId/plans/:planId/stages/bulk
Upsert multiple stages in one request.

**Body** `{ "stages": [ <stage objects> ] }`

**Response 200** — array of upserted stage objects.

---

## Tooth Movements

### GET /api/cases/:caseId/plans/:planId/stages/:stageId/tooth-movements
List tooth movements for a stage.

**Response 200** — array of movement objects, one per tooth (FDI notation).

---

### PUT /api/cases/:caseId/plans/:planId/stages/:stageId/tooth-movements
Create or update (upsert) the movement for a single tooth.

**Body**
```json
{
  "fdiNumber": 11,
  "mesialDistal": 0.5,
  "buccalLingual": -0.2,
  "intrusionExtrusion": 0.0,
  "torque": 1.5,
  "tip": 0.0,
  "rotation": -2.0
}
```

Translations in mm · Rotations in degrees · Values validated against safe clinical ranges.

**Response 200** — upserted movement object.

---

### DELETE /api/cases/:caseId/plans/:planId/stages/:stageId/tooth-movements/:fdiNumber
Remove the movement record for a tooth (resets to zero).

**Response 200** `{ "ok": true }`

---

## Clinical Measurements

### GET /api/cases/:caseId/measurements
List clinical measurements (overjet, overbite, Angle class, distances) for a case.

**Response 200** — array of measurement objects.

---

### POST /api/cases/:caseId/measurements
Record a clinical measurement.

**Body**
```json
{
  "type": "overjet",
  "value": 3.5,
  "unit": "mm",
  "notes": "optional"
}
```

**Response 201** — created measurement object.

---

## Export Packages

### POST /api/cases/:caseId/plans/:planId/export-packages
Create an export package.

**Body** `{ "exportType": "stage_models" | "aligner_models" | "full_case" }`

**Response 201** — export package object with `id`, `status: "pending"`, `manifest`.

Stage STL file naming: `stage_001.stl`, `stage_002.stl`, … (combined arch; matches AI engine output).

---

### GET /api/cases/:caseId/plans/:planId/export-packages
List export packages for a plan.

**Response 200** — array of export package objects.

---

### POST /api/cases/:caseId/plans/:planId/export-packages/:packageId/validate
Run 14-point quality checks on an export package.

**Response 200** — `{ "passed": true, "checks": [ { "name": "...", "passed": true, "message": "..." } ] }`

On failure, `passed: false` with per-check descriptions.

---

### POST /api/cases/:caseId/plans/:planId/export-packages/:packageId/approve
Approve a validated export package for manufacturing handoff.

**Response 200** — updated export package with `status: "approved"`.

---

### POST /api/cases/:caseId/plans/:planId/export-packages/:packageId/mark-exported
Confirm handoff to manufacturing.

**Body** `{ "format": "stl", "fileSizeBytes": 1048576 }`

**Response 200** — updated export package with `status: "exported"`, `exportedAt`.

---

## Manufacturing (Manufacture Prep)

### GET /api/cases/:caseId/manufacture/exports
List manufacturing export records for a case.

**Response 200** — array of manufacturing export objects.

---

### POST /api/cases/:caseId/manufacture/exports
Create a manufacturing export record.

**Body** — see `CreateExportDto` (stage range, format, notes).

**Response 201** — created manufacturing export object.

---

### GET /api/cases/:caseId/manufacture/exports/:exportId
Fetch a single manufacturing export record.

**Response 200** — export object.

---

### GET /api/cases/:caseId/manufacture/readiness
Check if a case is ready for manufacturing.

**Response 200** — `{ "ready": boolean, "blockers": string[] }`

---

## Print Jobs

### GET /api/manufacturing/jobs
List print jobs for the organization.

**Response 200** — array of print job objects.

---

### POST /api/manufacturing/jobs
Create a print job.

**Body**
```json
{
  "exportPackageId": "uuid",
  "printerType": "string",
  "material": "string",
  "priority": "normal"
}
```

**Response 201** — created print job object.

---

### GET /api/manufacturing/jobs/:id
Fetch a print job by ID.

**Response 200** — print job object with status history.

---

### PATCH /api/manufacturing/jobs/:id/status
Update print job status.

**Body** `{ "status": "printing" | "complete" | "failed", "failureReason": "optional" }`

**Response 200** — updated print job object.

---

### POST /api/manufacturing/jobs/:id/retry
Re-queue a failed print job.

**Response 202** — updated print job object.

---

### POST /api/manufacturing/jobs/:id/cancel
Cancel a queued or in-progress print job.

**Body** `{ "reason": "string" }`

**Response 200** — updated print job object with `status: "cancelled"`.

---

## FHIR R4

### GET /api/fhir/exports
List FHIR exports for the organization.

**Query params:** `resourceType` (`Patient` | `Observation`) — optional filter.

**Response 200** — array of FHIR export records.

---

### POST /api/fhir/patients/:patientId/export
Export a patient as a FHIR R4 Patient resource.

**Response 201** — FHIR Patient bundle stored in the database; returns `{ "id": "uuid", "resourceType": "Patient", "resource": {...} }`.

---

### POST /api/fhir/cases/:caseId/observation
Export the CBCT scan as a FHIR R4 Observation (LOINC 36643-5).

**Response 201** — FHIR Observation bundle.

---

## Audit Log

All endpoints require `audit:read` permission (`admin`, `super_admin`, `clinical_director`).

### GET /api/audit/events
List audit events for the organization.

**Query params:** `limit` (default 50) · `offset` (default 0)

**Response 200** — array of audit events with `actorId`, `actorEmail`, `action`, `resourceType`, `resourceId`, `ipAddress`, `createdAt`.

---

### GET /api/audit/events/resource/:resourceType/:resourceId
List audit events for a specific resource.

**Response 200** — array of audit events.

---

### GET /api/audit/events/actor/:actorId
List audit events by actor.

**Query params:** `limit` (default 50)

**Response 200** — array of audit events.

---

### GET /api/audit/summary
Recent event count within a time window.

**Query params:** `hours` (default 24)

**Response 200** `{ "recentCount": 42, "windowHours": 24 }`

---

## Admin (super_admin only)

All endpoints require `role = super_admin` unless noted.

### GET /api/admin/stats
Platform-wide statistics (users, orgs, cases).

**Response 200** — stats object.

---

### GET /api/admin/users
List all users across all organizations.

**Query params:** `limit` · `offset`

**Response 200** — array of user objects (passwords excluded).

---

### POST /api/admin/invite
Invite a user to an organization. Requires `admin` or `super_admin`.

**Body** `{ "email": "user@clinic.com", "role": "orthodontist" }`

**Response 201** — user object; invitation email sent.

---

### PATCH /api/admin/users/:id/role
Update a user's role.

**Body** `{ "role": "clinical_director" }`

**Response 200** — updated user object.

---

### PATCH /api/admin/users/:id/active
Enable or disable a user account.

**Body** `{ "active": false }`

**Response 200** — updated user object. Note: active sessions expire at their natural JWT TTL (24 h default).

---

### GET /api/admin/orgs
List all organizations.

**Query params:** `limit` · `offset`

**Response 200** — array of organization objects.

---

### POST /api/admin/orgs/:orgId/credits/grant
Grant usage credits to an organization.

**Body** `{ "amount": 100, "notes": "Pilot top-up" }`

**Response 200** — updated credits record.

---

### GET /api/admin/revenue
Revenue dashboard data.

**Response 200** — revenue metrics object.

---

### GET /api/admin/feature-flags
List all feature flags.

**Response 200** — array of `{ key, enabled, description, rolloutPercentage, allowedOrgIds }`.

---

### POST /api/admin/feature-flags/:key
Create or update a feature flag.

**Body**
```json
{
  "enabled": true,
  "description": "Enable AI collision detection",
  "rolloutPercentage": 100,
  "allowedOrgIds": ["uuid"]
}
```

**Response 200** — upserted feature flag.

---

### GET /api/admin/audit
List audit events across all organizations.

**Query params:** `orgId` (optional filter) · `limit` · `offset`

**Response 200** — array of audit events.

---

## Health

### GET /health (backend, port 3001)
Liveness probe — no auth required.

**Response 200** `{ "status": "ok", "service": "myortho-backend", "version": "1.0.0", "uptimeSeconds": 3600, "timestamp": "ISO-8601" }`

---

### GET /health/ready (backend, port 3001)
Readiness probe — checks database connectivity.

**Response 200** `{ "ready": true, "checks": { "databaseUrlSet": true, "databaseConnected": true }, "timestamp": "ISO-8601" }`

**Response 503** on failure.

---

## AI Engine (port 8000)

The AI engine is an internal service called by the backend. Direct access from external clients is not supported in production. All AI endpoints require an `Authorization: Bearer <internal-token>` header.

### GET /health
Liveness probe.

**Response 200** `{ "status": "ok", "service": "myortho-ai-engine", "version": "..." }`

---

### GET /ready
Readiness probe — reports GPU availability and model load status.

**Response 200** `{ "ready": true, "device": "cuda", "gpu_acceleration": true, "segmentation_weights_loaded": true }`

---

### POST /ai/segment
Queue a tooth segmentation job (33-class MONAI UNet, FDI 11–48).

**Body**
```json
{
  "case_id": "uuid",
  "scan_id": "uuid",
  "file_path": "/data/uploads/org/.../scan.stl",
  "jaw_type": "auto"
}
```

**Response 200** `{ "job_id": "uuid", "status": "queued", "disclaimer": "..." }`

Poll status at `GET /ai/jobs/{job_id}`.

---

### GET /ai/jobs/:job_id
Poll segmentation job status. Jobs expire after 7 days.

**Response 200** — job object with `status`, timestamps, and `result_path` on completion.

---

### POST /mesh/hollow
Hollow an aligner shell STL with configurable wall thickness.

**Body**
```json
{
  "input_mesh_path": "/data/uploads/.../stage_001.stl",
  "output_mesh_path": "/data/uploads/.../stage_001_aligner.stl",
  "wall_thickness_mm": 0.8,
  "engrave_label": "U01"
}
```

**Response 200** `{ "status": "success", "output_path": "..." }`

Note: Label engraving requires OpenSCAD (not installed in RC1; label is skipped).

---

### POST /ai/landmarks
Detect anatomical landmarks on a tooth mesh.

**Body** `{ "mesh_path": "...", "tooth_id": 11 }`

**Response 200** — landmark coordinates object.

---

### POST /ai/collision
Check root clearance between two tooth centerlines.

**Body**
```json
{
  "centerline_a": [[x,y,z], ...],
  "centerline_b": [[x,y,z], ...],
  "min_clearance_mm": 0.5
}
```

**Response 200** — `{ "collision": false, "min_clearance_mm": 0.7 }`

---

### POST /ai/autostage
Generate linear movement staging steps between current and target tooth positions.

**Body**
```json
{
  "tooth_id": 11,
  "current_translation": [0, 0, 0],
  "target_translation": [2, 0, 0],
  "max_step_mm": 0.25
}
```

**Response 200** `{ "tooth_id": 11, "total_stages": 8, "steps": [ { "stage_number": 1, "translation": [...] } ] }`

---

### POST /ai/generate-stage-stls
Generate per-stage STL files from a completed segmentation.

**Response 200** — `{ "files": ["stage_001.stl", "stage_002.stl", ...] }`

---

## Error Format

All API errors follow NestJS's standard format. Stack traces are suppressed in production.

```json
{
  "statusCode": 404,
  "message": "Patient not found",
  "error": "Not Found"
}
```

Common status codes:
- `400` Bad request / validation failure
- `401` No session or invalid token
- `403` Insufficient role or permission
- `404` Resource not found (or wrong organization)
- `409` Conflict (duplicate resource)
- `429` Rate limit exceeded
- `500` Internal server error (details in backend logs)
- `503` Dependency unavailable (database, AI engine)

---

## Rate Limiting

| Scope | Limit |
|---|---|
| Global | 100 req/min per IP |
| `POST /api/auth/login` | 5 req/min per IP |
| `POST /api/auth/register` | 5 req/min per IP |
| `POST /api/cases/:caseId/scans` | 10 req/min |

Exceeded requests return `429 Too Many Requests`.

---

## Permissions Reference

| Permission | Granted to |
|---|---|
| `patients:read` | orthodontist, dentist, clinical_director, admin, super_admin, vp_clinical, resident |
| `patients:write` | orthodontist, dentist, clinical_director, admin, super_admin |
| `cases:read` | orthodontist, dentist, clinical_director, admin, super_admin, vp_clinical, resident |
| `cases:write` | orthodontist, dentist, clinical_director, admin, super_admin |
| `cases:approve` | orthodontist, clinical_director, admin, super_admin |
| `audit:read` | admin, super_admin, clinical_director |

Full permission matrix: 10 roles × 16 permissions — see `backend/src/auth/permissions.ts`.
