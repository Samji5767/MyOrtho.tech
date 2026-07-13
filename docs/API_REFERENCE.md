# API Reference — MyOrtho.tech v2.0.0-rc1

**Base URL:** `https://your-domain.com`

All endpoints are relative to the base URL. The API is versioned implicitly at `/api/` — no explicit version segment is required in v2.0.0-rc1.

---

## Authentication

MyOrtho.tech uses cookie-based session authentication. The `mo_session` cookie is set on successful login and must be present on all subsequent requests. The cookie is `HttpOnly`, `SameSite=Strict`, and is never accessible to JavaScript.

### Get current session

```
GET /api/auth/session
```

Returns the currently authenticated user. Returns `401` if no valid session exists.

**Response 200:**
```json
{
  "id": "uuid",
  "email": "dr.smith@clinic.com",
  "name": "Dr. Jane Smith",
  "role": "orthodontist",
  "is_active": true
}
```

### Login

```
POST /api/auth/login
```

**Body:**
```json
{
  "email": "dr.smith@clinic.com",
  "password": "your-password"
}
```

Sets the `mo_session` cookie on success. Returns `401` on invalid credentials. Returns `403` if `is_active` is false on the account.

**Response 200:**
```json
{
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "orthodontist" }
}
```

### Logout

```
POST /api/auth/logout
```

Clears the `mo_session` cookie and adds the token to the Redis blocklist. The token is immediately invalid.

**Response 200:** `{ "message": "Logged out" }`

### Register

```
POST /api/auth/register
```

Available only when self-registration is enabled. In most clinical deployments, user accounts are created by an admin (see ADMIN_GUIDE.md).

**Body:**
```json
{
  "email": "newuser@clinic.com",
  "password": "Password1!",
  "name": "New User",
  "role": "resident"
}
```

---

## Patients

All patient endpoints require `patients:read` (GET) or `patients:write` (POST/PATCH) permission. PHI fields (name, dob, gender, notes) are decrypted transparently in responses.

### List patients

```
GET /api/patients
```

**Query params:** `page` (default 1), `limit` (default 20), `search` (name or ID substring)

**Response 200:**
```json
{
  "data": [
    { "id": "uuid", "name": "John Doe", "dob": "1990-05-15", "gender": "male", "createdAt": "..." }
  ],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

### Create patient

```
POST /api/patients
```

**Body:**
```json
{
  "name": "John Doe",
  "dob": "1990-05-15",
  "gender": "male",
  "email": "john.doe@example.com",
  "phone": "+15551234567",
  "notes": "Referred by Dr. Adams"
}
```

**Response 201:** Created patient object.

### Get patient

```
GET /api/patients/:id
```

**Response 200:** Full patient object including clinical notes (decrypted).

### Update patient

```
PATCH /api/patients/:id
```

Partial update. Any PHI field included is re-encrypted. Fields omitted are unchanged.

**Response 200:** Updated patient object.

---

## Cases

Case endpoints require `cases:read` (GET) or `cases:write` (POST). Certain operations require additional permissions noted per endpoint.

### List cases

```
GET /api/cases
```

**Query params:** `status`, `patientId`, `assignedTo`, `page`, `limit`

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "patientId": "uuid",
      "status": "planning",
      "assignedOrthodontistId": "uuid",
      "createdAt": "..."
    }
  ],
  "total": 38
}
```

### Create case

```
POST /api/cases
```

**Body:**
```json
{
  "patientId": "uuid",
  "assignedOrthodontistId": "uuid",
  "caseType": "full_treatment",
  "notes": "Class II malocclusion"
}
```

**Response 201:** Created case in `draft` status.

### Create case with new patient (atomic)

```
POST /api/cases/with-new-patient
```

**Body:**
```json
{
  "patient": {
    "name": "Jane Doe",
    "dob": "1995-03-22",
    "gender": "female"
  },
  "case": {
    "assignedOrthodontistId": "uuid",
    "caseType": "full_treatment"
  }
}
```

**Response 201:** `{ "patient": {...}, "case": {...} }`

### Get case

```
GET /api/cases/:id
```

**Response 200:** Full case object including status, assigned users, and metadata.

### Transition case status

```
POST /api/cases/:id/transition
```

**Required permission:** role-dependent (e.g. advancing from `clinical_review` to `planning` requires `clinical_director` or `orthodontist`)

**Body:**
```json
{
  "toStatus": "planning"
}
```

Valid status values: `draft`, `scan_review`, `clinical_review`, `planning`, `manufacturing`, `completed`

**Response 200:** Updated case object.

---

## Scans

### List scans for a case

```
GET /api/cases/:caseId/scans
```

**Response 200:** Array of scan objects including upload status and segmentation state.

### Upload a scan

```
POST /api/cases/:caseId/scans
Content-Type: multipart/form-data
```

**Form fields:**
- `file` — binary STL file (max 200 MB)
- `label` — scan label (e.g. `upper_arch`, `lower_arch`, `bite`)

**Response 201:** Created scan object with `id` and `status: "uploaded"`.

**Note:** Only binary STL format is accepted. PLY and OBJ are not supported.

---

## Treatment Plans

### List plans for a case

```
GET /api/cases/:caseId/plans
```

**Response 200:** Array of plan objects including version number and approval status.

### Create a plan

```
POST /api/cases/:caseId/plans
```

**Body:**
```json
{
  "name": "Primary treatment plan v1",
  "stages": []
}
```

If `TREATMENT_PLAN_AI_URL` is configured, omitting `stages` triggers AI stage generation. Otherwise stages must be added manually after creation.

**Response 201:** Created plan object.

### Approve a plan

```
POST /api/cases/:caseId/plans/:planId/approve
```

**Required permission:** `cases:approve` (available to `orthodontist`, `clinical_director`, `super_admin`)

**Body:**
```json
{
  "signature": "Dr. Jane Smith"
}
```

Signature must match the authenticated user's full name. The plan status is set to `approved` and the plan is locked for editing.

**Response 200:** Approved plan object with `approvedAt` and `approvedBy` fields.

---

## Export Packages

Export packages represent manufacturing-ready bundles generated from an approved treatment plan.

### Create export package

```
POST /api/cases/:caseId/plans/:planId/export-packages
```

**Required permission:** `cases:send_to_manufacturing`

**Body:**
```json
{
  "format": "stl",
  "alignerBatchSize": 10
}
```

**Response 201:** Export package object with `id` and `status: "pending"`.

### List export packages

```
GET /api/cases/:caseId/plans/:planId/export-packages
```

**Response 200:** Array of export package objects with current status.

### Approve export package

```
POST /api/cases/:caseId/plans/:planId/export-packages/:packageId/approve
```

**Required permission:** `cases:send_to_manufacturing`

**Response 200:** Approved export package. This advances the case toward `manufacturing` status.

---

## Clinical Reports

### Generate a report

```
POST /api/cases/:caseId/reports/treatment-summary
POST /api/cases/:caseId/reports/aligner-progress
POST /api/cases/:caseId/reports/insurance-preauth
```

No request body required. Returns the created report object with `id` and `status`.

**Response 201:**
```json
{
  "id": "uuid",
  "type": "treatment_summary",
  "status": "generated",
  "createdAt": "2026-07-10T14:32:00Z"
}
```

### Download a report

```
GET /api/cases/:caseId/reports/:reportId/download
```

Returns the report file. The response Content-Type is `application/pdf` or `application/json` depending on report type. Download events are logged to the audit trail.

---

## Feature Flags

### List feature flags

```
GET /api/feature-flags
```

**Required:** `admin` or `super_admin` role.

**Response 200:** Array of feature flag objects.

### Create a feature flag

```
POST /api/feature-flags
```

**Required:** `super_admin` role.

**Body:**
```json
{
  "name": "ai_copilot",
  "enabled": true,
  "rolloutPercentage": 100,
  "description": "AI Copilot assistant"
}
```

**Response 201:** Created feature flag object.

### Update a feature flag

```
PATCH /api/feature-flags/:id
```

**Required:** `super_admin` role.

**Body:** Any subset of `{ enabled, rolloutPercentage, description }`.

---

## Analytics

### Summary

```
GET /api/analytics/summary
```

**Required:** `executive`, `vp_clinical`, `vp_manufacturing`, `admin`, or `super_admin` role.

**Response 200:**
```json
{
  "totalPatients": 412,
  "activeCases": 87,
  "casesCompletedThisMonth": 23,
  "plansPendingApproval": 5,
  "exportPackagesInQueue": 12
}
```

---

## Error Format

All error responses follow a consistent structure:

```json
{
  "statusCode": 403,
  "errorCode": "PERMISSION_DENIED",
  "message": "You do not have the required permission: cases:approve",
  "correlationId": "x-correlation-id header value"
}
```

The `correlationId` matches the `x-correlation-id` response header, which is present on every API response and can be used to correlate requests across backend logs.

---

## Rate Limiting

Rate limiting is enforced per IP at the nginx layer. Default limits:

- Login endpoint: 10 requests per minute
- All other endpoints: 300 requests per minute

Exceeding the limit returns `429 Too Many Requests`.
