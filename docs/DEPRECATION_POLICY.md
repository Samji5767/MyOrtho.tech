# Deprecation Policy

This document defines how MyOrtho.tech communicates and enforces the deprecation
of API endpoints, request/response fields, and platform features.

Audience: API consumers (clinic integrators, lab systems), internal engineering
teams, and enterprise customers with direct API integrations.

---

## Scope

This policy applies to:

- REST API routes under `https://api.myortho.tech/api/v1/` (the `v1` prefix in every route path)
- JSON response fields returned by those routes
- Webhook event types delivered to registered webhook endpoints
- Platform features accessed via the MyOrtho.tech web application or patient portal
- Environment variable names and configuration keys documented in `docs/ENV_VARS.md`

It does not apply to:

- Internal module interfaces within the NestJS backend (`src/`) — those are implementation details
- Database schema details not exposed through the public API
- Undocumented or experimental endpoints not listed in `docs/API.md`

---

## Minimum notice period

| Type | Minimum notice |
|------|---------------|
| REST API endpoint removal | 2 major versions |
| Response field removal or rename | 2 major versions |
| Webhook event type removal | 2 major versions |
| Breaking behavior change on an existing route | 2 major versions |
| Platform feature removal (UI-only, no API dependency) | 1 major version |
| Configuration key rename (`ENV_VARS.md`) | 1 major version |

**2 major versions** means: if a feature is marked deprecated in `v1.x`, it may not
be removed until `v3.0.0` at the earliest. If deprecated in `v2.x`, removal is
earliest at `v4.0.0`.

**1 major version** means: deprecated in `v1.x`, removed no earlier than `v2.0.0`.

The notice period begins on the date the deprecation is published in `docs/CHANGELOG.md`,
not the date the code change is merged.

---

## How deprecation is communicated

Every deprecated item must be communicated through **all three** channels below.
Omitting any channel means the deprecation is not yet in effect.

### 1. HTTP response header

All responses from a deprecated endpoint, or responses containing a deprecated field,
must include the `Deprecation` header per [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745):

```
Deprecation: "2026-07-08"
Sunset: "2028-01-01"
Link: <https://docs.myortho.tech/deprecations/v1-scan-format>; rel="deprecation"
```

- `Deprecation`: the ISO 8601 date when the deprecation was announced
- `Sunset`: the earliest date the endpoint or field may be removed (see the table above)
- `Link`: a documentation URL describing what to use instead

Implementation: add the headers in the NestJS controller or in a per-route interceptor.
Do not add them in the `GlobalExceptionFilter` — only successful responses from the
affected route need the header.

For deprecated response fields (rather than entire endpoints), include a top-level
`_deprecation_notices` array in the response body alongside the deprecated fields:

```json
{
  "_deprecation_notices": [
    {
      "field": "ipr_details",
      "message": "Use GET /api/cases/:caseId/plans/:planId/ipr instead.",
      "sunset": "2028-01-01"
    }
  ],
  "id": "...",
  "ipr_details": { ... }
}
```

### 2. Changelog entry

Add a `Deprecated` subsection to `docs/CHANGELOG.md` under the version in which
the deprecation is announced:

```markdown
### Deprecated
- `GET /api/cases/:caseId/plans/:planId` — `ipr_details` field in the response body.
  Use `GET /api/cases/:caseId/plans/:planId/ipr` (the IPR planner endpoint) for
  structured IPR items. The field will be removed no earlier than v3.0.0
  (sunset: 2028-01-01).
```

The `Deprecated` subsection is distinct from `Removed`. An item moves from
`Deprecated` to `Removed` only when it is actually deleted from the codebase.

### 3. Admin UI notice

For features accessible through the MyOrtho.tech web application, display a
dismissible notice in the affected UI area for the duration of the deprecation
period. The notice must include:

- A plain-English description of what is changing
- The date after which the feature will no longer be available
- A link or in-app navigation path to the replacement

For API-only deprecations with no UI surface, this channel is satisfied by updating
the enterprise onboarding documentation (`docs/ENTERPRISE_ONBOARDING.md`) and the
API reference (`docs/API.md`).

---

## Sunset and removal

An item may be removed from the codebase **no earlier** than the sunset date declared
in the `Deprecation` and `Sunset` headers. The sunset date must be at least the
minimum notice period after the deprecation announcement date.

Before removing a deprecated item:

1. Confirm the deprecation has been in `docs/CHANGELOG.md` for the required notice period.
2. Confirm the `Sunset` date has passed.
3. Check API usage logs and webhook delivery logs for the past 90 days. If any
   production consumer is still calling the deprecated endpoint or receiving the
   deprecated event type, do not remove it yet — contact the consumer and agree on a
   migration timeline.
4. Add a `Removed` entry to `docs/CHANGELOG.md` in the version where removal occurs.
5. Return `HTTP 410 Gone` from the removed endpoint for at least one additional major
   version to give integrators a clear signal rather than a silent `404`.

---

## Exception process — security-driven removal

A deprecated item may be removed before its sunset date if:

- The item has a confirmed security vulnerability (e.g., an endpoint that exposes PHI
  without adequate authorization, or a field that leaks session-adjacent data), **and**
- A patch cannot be applied without removing the item entirely.

Security-driven removal bypasses the minimum notice period. The process is:

1. Confirm the security risk with the security contact listed in `SECURITY.md`.
2. Deploy the removal as a hotfix per `docs/HOTFIX_WORKFLOW.md`.
3. Publish a security advisory (see `SECURITY.md`) simultaneously with the deployment.
4. Document the removal in `docs/CHANGELOG.md` under `Removed` with a note:
   `Removed ahead of sunset date due to security vulnerability (see security advisory SA-YYYY-NNN).`
5. Notify all enterprise API consumers directly via email within 24 hours of removal.

---

## Version compatibility matrix

The `GET /api/version` endpoint returns the current `api` version string (currently `v1`).
MyOrtho.tech does not use URL-level API versioning for individual endpoints (e.g.,
`/api/v2/cases`) — the `v1` prefix in all routes is a namespace, not a versioning
mechanism. Breaking changes are managed through the deprecation notice period above,
not by forking the URL namespace.

When a future major API version (`v2`) is introduced, the `v1` routes will continue
to operate for the duration of the minimum notice period. The `api` field in
`GET /api/version` will reflect the active version; clients can use this to detect
which features are available.

---

## Internal deprecation of NestJS modules

When a NestJS module inside `src/` is being replaced by another:

1. Mark the old service or controller with a JSDoc `@deprecated` comment explaining
   what replaces it and the target removal milestone.
2. Add a `// TODO(vX.Y.Z): remove <ModuleName>` comment in `app.module.ts` next to
   the import.
3. These internal deprecations do not require changelog entries or the minimum notice
   period — they are implementation details. However, if the module backs a public
   API route, the public API deprecation rules apply.
