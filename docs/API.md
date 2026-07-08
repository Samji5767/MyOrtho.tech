# API Reference

## Authentication

All routes require authentication via the `mo_session` HttpOnly cookie. Set with `credentials: 'include'` on all fetch calls.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login (returns cookie). Rate limited: 5 req/60s |
| POST | `/api/auth/logout` | Logout (clears cookie) |
| GET | `/api/auth/me` | Get current user |

## Patients

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/patients` | List patients (org-scoped) |
| POST | `/api/patients` | Create patient |
| GET | `/api/patients/:id` | Get patient |
| PATCH | `/api/patients/:id` | Update patient |

## Cases

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cases` | List cases (org-scoped) |
| POST | `/api/cases` | Create case |
| POST | `/api/cases/with-new-patient` | Create case + new patient |
| GET | `/api/cases/:id` | Get case |
| PATCH | `/api/cases/:id` | Update case |
| POST | `/api/cases/:id/transition` | Transition case status |
| POST | `/api/cases/:id/approve` | Approve case |

## AI Copilot

Rate limited: 20 req/60s per user.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/cases/:caseId/copilot/conversations` | Start conversation |
| GET | `/api/cases/:caseId/copilot/conversations` | List conversations |
| POST | `/api/cases/:caseId/copilot/conversations/:id/messages` | Send message |
| GET | `/api/cases/:caseId/copilot/conversations/:id/messages` | Get messages |
| POST | `/api/cases/:caseId/copilot/conversations/:id/stream` | Stream message (SSE) |
| GET | `/api/cases/:caseId/copilot/suggestions` | List proactive suggestions |
| PATCH | `/api/cases/:caseId/copilot/suggestions/:id/resolve` | Resolve suggestion |

## Clinical Reports

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/cases/:caseId/reports` | List reports |
| POST | `/api/cases/:caseId/reports/treatment-summary` | Generate treatment summary |
| GET | `/api/cases/:caseId/reports/:id` | Get report |
| GET | `/api/cases/:caseId/reports/:id/download` | Download as HTML |
| POST | `/api/cases/:caseId/reports/:id/approve` | Approve report |

## Admin (requires `admin:users` permission)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/users` | List users |
| POST | `/api/admin/invite` | Invite user (sends email if SMTP configured) |
| PATCH | `/api/admin/users/:id/role` | Change user role |
| PATCH | `/api/admin/users/:id/active` | Activate/deactivate user |

## Audit (requires `audit:read` permission)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/audit/events` | List audit events (paginated) |
| GET | `/api/audit/events/resource/:type/:id` | Events for a resource |
| GET | `/api/audit/events/actor/:actorId` | Events by actor |
| GET | `/api/audit/summary` | Recent event count summary |

## Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth required) |
