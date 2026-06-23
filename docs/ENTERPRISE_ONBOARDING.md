# MyOrtho Enterprise Onboarding

> **Last updated**: 2026-06-23 — Phase 10

This document describes the 7-step enterprise onboarding flow introduced in Phase 10.

## Overview

New users are routed to `/onboarding` after their first login. The flow collects role, organization, practice scale, workflow preferences, and AI readiness configuration. On completion, the user is marked as onboarded in the database and routed to their role-specific primary workspace.

The onboarding page is a public path — it does not require the user to have `is_onboarded = true`. The `AuthGate` allows `/onboarding` through without redirect.

---

## Steps

### Step 1 — Account Confirmation

Displays the authenticated user's name, email, and role as detected from the JWT session. No user input at this step.

**Purpose**: Confirm the session is correct before collecting preferences.

---

### Step 2 — Role Selection

User selects their clinical role from 15 options:

| Display Label | Resolved Role Key |
|---|---|
| Orthodontist | orthodontist |
| Dentist | dentist |
| Orthodontic Resident | resident |
| Practice Owner | admin |
| Clinical Director | clinical_director |
| VP of Clinical Operations | vp_clinical |
| VP of Manufacturing | vp_manufacturing |
| Chief Executive Officer | executive |
| DSO Executive | executive |
| Lab Technician | lab_technician |
| Senior Lab Technician | lab_technician |
| Lab Manager | lab_manager |
| Digital Designer | lab_technician |
| Manufacturing Manager | vp_manufacturing |
| IT / System Admin | admin |

**Note**: The UI supports 15 display labels that map to 11 backend role keys. This allows more specific self-identification while fitting within the existing RBAC model.

If the user's JWT role is already set (e.g., `orthodontist`), that option is pre-selected.

---

### Step 3 — Organization

Collects:
- Organization type (single practice / group practice / DSO / lab / teaching institution / other)
- Organization name (text field, optional)

---

### Step 4 — Practice Scale

Collects:
- Number of doctors (1 / 2–5 / 6–15 / 16+)
- Number of clinic locations (1 / 2–5 / 6–20 / 20+)
- Monthly case volume (< 25 / 25–100 / 100–250 / 250–500 / 500+)

**Purpose**: Informs future feature prioritization and analytics segmentation. Not currently used to change feature access.

---

### Step 5 — Workflow Preferences

Collects primary flow preference (single-select):

| Option | Description |
|---|---|
| Aligner-first | Design before clinical consultation |
| Clinical-first | Clinical consultation drives setup |
| Lab-integrated | Lab drives design with clinical review |
| Fully in-house | All design and manufacturing on-site |
| DSO centralized | Centralized design team serves all practices |
| Hybrid | Mix of in-house and external lab |

---

### Step 6 — AI Readiness + Demo Data

Collects:

**CAD experience level** (single-select):
- New to digital orthodontics
- Familiar with digital tools
- Experienced CAD user
- Advanced / power user

**AI feature preference** (single-select):
- Show all AI features clearly labeled as experimental
- Enable AI features with required review prompts
- Conservative: only show validated features

**Demo data toggle** (checkbox):
- When enabled: pre-populates the app with representative cases, patients, and workflow data.
- When disabled: app starts empty.

---

### Step 7 — Success Screen

Role-specific success screen using `ROLE_CONFIG` from `frontend/src/lib/roles.ts`.

Displays:
- Role-specific success message (e.g., "Your treatment planning workspace is ready")
- Primary workspace route (e.g., `/studio` for lab technicians, `/cases` for orthodontists)
- 2–3 recommended next routes with icons
- Finish button → routes to primary workspace

On finish:
1. Calls `POST /api/auth/onboarding` → sets `is_onboarded = true` in `auth_users`
2. Refreshes session via `AuthContext.refresh()`
3. Routes to `getPrimaryWorkspace(resolvedRole)` via `router.replace()`

---

## Role → Primary Workspace Routing

| Role | Primary Workspace |
|---|---|
| super_admin | /settings |
| admin | /dashboard |
| orthodontist | /cases |
| dentist | /cases |
| resident | /cases |
| lab_technician | /studio |
| lab_manager | /manufacturing |
| clinical_director | /dashboard |
| vp_clinical | /analytics |
| vp_manufacturing | /manufacturing |
| executive | /analytics |

---

## Backend Integration

### POST /api/auth/onboarding

Reads the `mo_session` cookie, verifies the JWT, and calls `AuthService.markOnboarded(userId)`.

```typescript
// auth.service.ts
async markOnboarded(userId: string): Promise<void> {
  await this.pool.query(
    'UPDATE auth_users SET is_onboarded = true, updated_at = NOW() WHERE id = $1',
    [userId]
  );
}
```

Response: `{ ok: true, role: string }`

### Session after onboarding

After `POST /api/auth/onboarding` succeeds, the frontend calls `AuthContext.refresh()` which re-fetches `GET /api/auth/session`. The `isOnboarded` field in the returned payload will be `true`. From that point, subsequent logins route directly to the primary workspace, bypassing the onboarding page.

---

## AuthGate Behavior

`/onboarding` is a public path in `AuthGate`. Users can visit it while authenticated or unauthenticated (though the content requires a valid session to be useful).

```typescript
// AuthGate.tsx
const PUBLIC_PATHS = ['/login', '/onboarding'];
```

After a user completes onboarding, navigating to `/onboarding` again will re-run the flow. The `is_onboarded` flag prevents the login page from routing them back to onboarding — but the onboarding page itself has no redirect-away-if-already-onboarded guard (this is intentional: admins may revisit it to see the flow).

---

## Collected Data

The onboarding page collects the following fields as local state. Currently, only `is_onboarded` is persisted to the database. All other fields (org type, practice scale, etc.) are informational and are not stored anywhere in Phase 10.

| Field | Persisted |
|---|---|
| resolvedRole | No (future: UPDATE auth_users SET role) |
| orgType | No (future: organizations table) |
| orgName | No (future: organizations table) |
| numDoctors | No |
| numClinics | No |
| caseVolume | No |
| primaryFlow | No |
| cadLevel | No |
| aiReadiness | No |
| enableDemo | No |
| is_onboarded | Yes (auth_users) |

**Phase 11 suggestion**: persist org type, practice scale, and workflow preferences to an `onboarding_data` JSONB column in `auth_users` or a separate `practice_profiles` table.
