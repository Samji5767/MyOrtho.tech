# API Governance

Standards and conventions for all HTTP endpoints in the MyOrtho.tech backend. All contributors must follow these rules when adding or modifying API surface. For questions, refer to the responsible clinician-software engineer on the review board.

---

## URL Naming Conventions

Routes use **kebab-case**, **plural resource nouns**, and a mandatory `/api/` path prefix. v1 is the implicit current version — no version segment appears in paths until a breaking change requires `/api/v2/` (see [API Versioning Roadmap](#api-versioning-roadmap)).

**Rules:**

- Use lower-case kebab-case for all path segments.
- Resource collections are plural nouns: `/api/cases`, `/api/patients`, `/api/notifications`.
- Sub-resources are nested under their parent: `/api/cases/:id/ai-scores`, `/api/cases/:id/digital-twin`.
- Actions that are not CRUD (state transitions, approvals) are POST sub-resources in imperative form: `/api/cases/:id/transition`, `/api/cases/:id/approve`.
- Avoid verb-only paths (no `/api/getCases`, no `/api/doTransition`).

**Examples drawn from actual routes:**

| Route | Notes |
|---|---|
| `GET /api/cases` | Plural noun, no trailing slash |
| `GET /api/cases/:id` | UUID path parameter |
| `POST /api/cases/:id/transition` | Action as sub-resource |
| `POST /api/cases/:id/approve` | Specific action sub-resource |
| `GET /api/cases/:id/ai-scores` | Hyphenated compound sub-resource |
| `GET /api/cases/:id/digital-twin` | Hyphenated compound sub-resource |
| `GET /api/cases/analytics/summary` | Nested analytics grouping |
| `POST /api/cases/with-new-patient` | Hyphenated variant constructor |
| `GET /api/notifications` | Plural noun |
| `GET /api/notifications/unread-count` | Hyphenated derived field |
| `POST /api/notifications/mark-read` | Bulk action as sub-resource |
| `POST /api/notifications/mark-all-read` | Bulk action variant |
| `DELETE /api/notifications/:id` | Single-item dismissal |
| `POST /api/auth/login` | Auth namespace, imperative verb |
| `POST /api/auth/logout` | Auth namespace |
| `GET /api/auth/session` | Session state resource |
| `GET /api/me` | Convenience alias, top-level singleton |
| `GET /api/version` | Metadata, top-level singleton |

---

## HTTP Method Usage

| Method | Semantics | Status on success |
|---|---|---|
| `GET` | Read; must be side-effect-free and idempotent | 200 |
| `POST` | Create a new resource, or invoke a non-idempotent action | 201 (create), 200 (action) |
| `PATCH` | Partial update; only supplied fields are changed | 200 |
| `DELETE` | Remove or dismiss a resource | 204 |
| `PUT` | Full replacement of a resource (not currently used) | 200 |

**PUT vs PATCH:** Use `PATCH` for partial updates where callers send only the fields they want to change (`UpdateCaseDto` is a partial DTO). Reserve `PUT` for future endpoints that require atomic replacement of the entire resource body and where partial updates would be semantically incorrect.

**Actions as POST sub-resources:** State transitions and approval workflows are modelled as POST sub-resources, not as PATCH calls on the parent, because they have distinct permission requirements, validation rules, and audit trails.

```
POST /api/cases/:id/transition   body: { toStatus, notes? }
POST /api/cases/:id/approve      body: { notes? }        requires cases:approve
```

This pattern keeps side-effectful operations explicit and avoids overloading `PATCH /api/cases/:id` with workflow logic.

---

## Response Shape Standards

### Success responses

Endpoints return the resource object or an array of resource objects directly. There is no universal wrapper envelope.

```json
// Single resource
{ "id": "...", "status": "planning", "patientId": "...", ... }

// Collection
[{ "id": "..." }, { "id": "..." }]

// Derived/aggregate
{ "totalCases": 12, "activeCases": 4, "pendingReview": 2, ... }

// Scalar wrapper (when the concept is a count, not a list)
{ "count": 7 }
```

### Error responses

All errors are shaped by `GlobalExceptionFilter` via `buildApiError` (see `src/common/error-codes.ts`):

```json
{
  "statusCode": 403,
  "errorCode": "AUTH_003",
  "message": "Insufficient permissions",
  "details": null,
  "requestId": "8f3a1c...",
  "timestamp": "2026-07-08T14:30:00.000Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `statusCode` | number | Mirrors the HTTP status code |
| `errorCode` | string | Machine-readable domain code (see table below) |
| `message` | string | Human-readable; safe to display to end users |
| `details` | any \| null | Optional structured payload for validation errors |
| `requestId` | string \| undefined | Correlation ID from the request; present when middleware attaches it |
| `timestamp` | ISO 8601 string | UTC time the error was generated |

**Error code domains:**

| Prefix | Domain |
|---|---|
| `AUTH_` | Authentication and session |
| `CASE_` | Case resource and state machine |
| `PATIENT_` | Patient records |
| `PLAN_` | Treatment plans |
| `SCAN_` | Scan uploads and processing |
| `AI_` | Copilot and LLM features |
| `MFG_` | Manufacturing orders |
| `ADMIN_` | User administration |
| `RPT_` | Clinical reports |
| `VAL_` | Input validation |
| `GEN_` | General / cross-cutting |

### Pagination

`GET` collection endpoints accept `limit` (integer) and `offset` (integer) query parameters. Default and maximum values are endpoint-specific:

- `GET /api/cases` — default `limit=100`, max `500`; supports `offset`.
- `GET /api/notifications` — default `limit=50`; no offset yet.

Cursor-based pagination is not implemented in v1. Responses do not include a `total` count field in the current implementation. Clients should request `limit + 1` items to detect whether a next page exists.

---

## HTTP Status Code Usage

| Code | Meaning | When used |
|---|---|---|
| 200 | OK | Successful read, action, or logout |
| 201 | Created | Successful `POST` that creates a new resource |
| 204 | No Content | Successful `DELETE` or bulk mutation with no body |
| 400 | Bad Request | Missing required fields, failed validation, malformed body |
| 401 | Unauthenticated | Missing or expired `mo_session` cookie / token |
| 403 | Forbidden | Valid session but insufficient role or permission |
| 404 | Not Found | Resource does not exist or is not visible to the caller's org |
| 409 | Conflict | Duplicate resource (e.g., email already registered) |
| 422 | Unprocessable Entity | Semantic validation failure (distinct from malformed input) |
| 429 | Too Many Requests | Rate limiter triggered (5 attempts / 60 s on auth endpoints) |
| 500 | Internal Server Error | Unhandled exception; details are never exposed to the client |

---

## Authentication Contract

All endpoints except `GET /health`, `GET /api/version`, `POST /api/auth/login`, and `POST /api/auth/register` require an authenticated session.

**Mechanism:** The `AuthGuard` reads the `mo_session` cookie. The cookie is set with:
- `httpOnly: true` — inaccessible to JavaScript
- `sameSite: strict` — CSRF mitigation; no cross-origin cookie transmission
- `secure: true` in production (HTTPS only)

A `Bearer <token>` `Authorization` header is also accepted as a fallback (used by the desktop client and non-browser agents), but the cookie is the canonical transport for web sessions.

**Errors:**

| Situation | Status | Error code |
|---|---|---|
| No cookie / header | 401 | `AUTH_001` |
| Token expired or revoked | 401 | `AUTH_002` |
| Account inactive | 401 | `AUTH_004` |
| Permission check fails | 403 | `AUTH_003` |

**Permission model:** Fine-grained permissions are checked by `PermissionsGuard` with the `@RequirePermission()` decorator. Current permission tokens include `cases:read`, `cases:write`, `cases:approve`. A user's role determines which tokens they hold; the mapping lives in `src/auth/permissions.ts`.

---

## Deprecation

Refer to `docs/DEPRECATION_POLICY.md` for the full deprecation lifecycle and timelines.

**Summary of obligations for API authors:**

1. A deprecated endpoint must continue to function for the duration of the sunset period defined in `DEPRECATION_POLICY.md`.
2. Include a `Deprecation` response header on every response from a deprecated endpoint, using the RFC 8594 format:
   ```
   Deprecation: Tue, 01 Oct 2026 00:00:00 GMT
   Sunset: Wed, 01 Apr 2027 00:00:00 GMT
   Link: <https://docs.myortho.tech/api/migration>; rel="deprecation"
   ```
3. Log a warning at the application level for every call to a deprecated endpoint so usage can be tracked before the sunset date.
4. Announce deprecations in the changelog and notify affected integration partners directly.

---

## API Versioning Roadmap

**Current state (v1, implicit):** All routes are prefixed `/api/` with no version segment. v1 is the implicit current release (`1.0.0-beta.1`). This is intentional: the API surface is not yet stable enough to commit to a versioned contract.

**When to introduce `/api/v2/`:** A version prefix is required only when a breaking change cannot be made backward-compatible. Breaking changes include:

- Removing or renaming a field that existing clients rely on.
- Changing the HTTP method or path of an existing endpoint.
- Altering authentication semantics.
- Changing error shape or removing an `errorCode` value.

**How versioning will work:**

- New version routes live at `/api/v2/<resource>`.
- The old `/api/<resource>` routes are kept alive through the sunset period defined in `DEPRECATION_POLICY.md`.
- Version selection is via URL path only — no `Accept-Version` header versioning is planned.

**Non-breaking changes** (no version bump required): adding new optional request fields, adding new response fields, adding new endpoints, adding new `errorCode` values, tightening rate limits with advance notice.
