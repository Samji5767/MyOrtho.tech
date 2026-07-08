# MyOrtho.tech — Security Audit

**Date:** 2026-07-08
**Scope:** Backend NestJS API (`backend/src`) + Next.js frontend shell (`frontend/src/app/layout.tsx`)
**Auditor:** Internal engineering review (grounded in source code)
**Status:** Pre-GA review — findings must be resolved or formally accepted before production release

> All findings are grounded in actual source code. File references are absolute paths from the repository root.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [RBAC](#2-rbac)
3. [Input Validation](#3-input-validation)
4. [Cookie Security](#4-cookie-security)
5. [File Upload Security](#5-file-upload-security)
6. [Rate Limiting](#6-rate-limiting)
7. [Dependency Security](#7-dependency-security)
8. [Security Posture Summary](#8-security-posture-summary)

---

## 1. Authentication

### 1.1 Cookie-Based Session Flow

**Source:** `backend/src/auth/auth.controller.ts`, `backend/src/auth/auth.service.ts`

Sessions are issued as JWTs stored in an HttpOnly cookie named `mo_session`. The `cookieOptions()` helper in `auth.controller.ts` centralises all cookie attributes:

```typescript
// auth.controller.ts:20-28
function cookieOptions(maxAgeMs: number, production: boolean) {
  return {
    httpOnly: true,
    secure: production,
    sameSite: 'strict' as const,
    maxAge: maxAgeMs,
    path: '/',
  };
}
```

The cookie is set on successful login and registration and cleared on logout. The `secure` flag is conditionally set based on `process.env.NODE_ENV === 'production'`, which correctly permits plain HTTP in local development while enforcing HTTPS in production.

### 1.2 JWT Implementation

**Source:** `backend/src/auth/auth.service.ts`

| Property | Value |
|---|---|
| Algorithm | `HS256` (constant `JWT_ALGORITHM`) |
| Expiry | `24h` |
| JTI | `crypto.randomUUID()` — unique per token, embedded at `toPayload()` time |
| Secret enforcement | Minimum 32 characters; throws `Error` at startup in production if unset |
| Session duration | `COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000` (24 hours) |

The `verifyToken()` method pins the allowed algorithm (`algorithms: [JWT_ALGORITHM]`) to prevent algorithm-confusion attacks (e.g., accepting `none` or `RS256` with the HMAC secret as the public key).

### 1.3 Token Revocation

On logout, the token's `jti` is written to a Redis key `jti_blacklist:{jti}` with a TTL matching the token's remaining lifetime. Every call to `verifyToken()` checks the blacklist before returning the payload. An in-memory `Set` fallback is used when Redis is unavailable, meaning revocation is node-local in that scenario (acceptable for a single-process deployment; a gap in multi-node deployments without Redis).

### 1.4 Session Validation Per Request

**Source:** `backend/src/auth/auth.guard.ts`

`AuthGuard` is a NestJS `CanActivate` guard that extracts the `mo_session` cookie (or a `Bearer` token from the `Authorization` header) and calls `authService.verifyToken()` on every request. The verified payload is attached to `request.user`. Downstream handlers and `PermissionsGuard` consume `request.user` — they never re-parse the raw token.

### 1.5 Password Hashing

bcrypt is used with `BCRYPT_ROUNDS = 12`. The login path performs a dummy bcrypt compare (`$2b$12$AAA...`) when the email is not found, making timing-based user-enumeration attacks impractical:

```typescript
// auth.service.ts:175-178
if (!user) {
  await bcrypt.compare(password, '$2b$12$AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  throw new UnauthorizedException('Invalid email or password');
}
```

Error messages are identical for "user not found" and "wrong password".

### 1.6 Dual Transport: Cookie + Bearer

`AuthGuard` and several auth controller methods accept tokens from either the `mo_session` cookie or an `Authorization: Bearer` header. This supports native mobile clients and API tooling but means bearer tokens bypass SameSite cookie protections (see Section 4). This is an intentional design choice.

### 1.7 Default Admin Bootstrap

**Source:** `backend/src/auth/auth.service.ts:281-318`

`bootstrapAdmin()` creates a `super_admin` account on first startup. The password falls back to the literal string `'adminadmin'` in `AuthService` if `MYORTHO_ADMIN_PASSWORD` is unset. However, `main.ts:44-48` throws a hard startup error if `MYORTHO_ADMIN_PASSWORD` is empty, so the fallback in `AuthService` is unreachable at runtime. Still, the plaintext default exists as dead code.

### 1.8 Findings

| Finding | Rating |
|---|---|
| HttpOnly cookie issued with correct attributes (httpOnly, sameSite:strict, secure in production) | **PASSED** |
| JWT algorithm pinned to HS256; `none` algorithm rejected | **PASSED** |
| Token revocation via JTI Redis blacklist with TTL | **PASSED** |
| Per-request token verification in AuthGuard | **PASSED** |
| Timing-safe dummy bcrypt on unknown email (user enumeration mitigation) | **PASSED** |
| `JWT_SECRET` startup guard enforces ≥32 chars and hard-fails in production | **PASSED** |
| Login and register body accepts plain `{ email?, password? }` objects — no DTO class, so `class-validator` decorators (e.g., `@IsEmail()`) are absent; only a null-check and `password.length < 8` run | **REVIEW NEEDED** |
| In-memory blacklist fallback is node-local; revocation does not propagate across pods when Redis is down in a multi-replica deployment | **REVIEW NEEDED** |
| `bootstrapAdmin()` contains plaintext fallback `'adminadmin'` as dead code | **REVIEW NEEDED** |
| `is_active` check occurs after bcrypt comparison, so a deactivated user's password is still tested | **REVIEW NEEDED** |

---

## 2. RBAC

### 2.1 Role and Permission Definitions

**Source:** `backend/src/auth/permissions.ts`

The application defines **10 roles** and **15 named permissions** using a single source of truth:

**Roles:** `super_admin`, `admin`, `clinical_director`, `orthodontist`, `dentist`, `resident`, `lab_manager`, `lab_technician`, `vp_clinical`, `vp_manufacturing`, `executive`

**Permission namespace (`resource:action`):**

| Resource | Actions |
|---|---|
| `patients` | `read`, `write`, `delete` |
| `cases` | `read`, `write`, `delete`, `approve`, `send_to_manufacturing` |
| `analytics` | `read` |
| `manufacturing` | `read`, `write`, `manage` |
| `admin` | `users`, `settings`, `org` |
| `audit` | `read` |

The mapping is a plain `Record<string, Permission[]>`. The `hasPermission()` function does a simple `Array.includes()` lookup. There is no wildcard or hierarchical inheritance — every role's permissions are explicit.

Notable design choices:
- `patients:delete` and `cases:delete` are granted only to `super_admin`.
- `admin:org` is granted only to `super_admin`.
- `audit:read` is restricted to roles with oversight responsibilities (admin, clinical_director, lab_manager, vp_clinical, vp_manufacturing, executive).
- `resident` has read-only access to patients, cases, and analytics.

### 2.2 PermissionsGuard Implementation

**Source:** `backend/src/auth/permissions.guard.ts`

`PermissionsGuard` uses NestJS `Reflector` to read the `PERMISSION_KEY` metadata set by `@RequirePermission`. If no permission is declared on the handler or its class, the guard returns `true` (pass-through). This means **endpoints without `@RequirePermission` are authentication-checked by `AuthGuard` but not permission-checked**.

```typescript
// permissions.guard.ts:27-30
const required = this.reflector.getAllAndOverride<Permission | undefined>(
  PERMISSION_KEY,
  [context.getHandler(), context.getClass()],
);
if (!required) return true;
```

### 2.3 @RequirePermission Decorator

**Source:** `backend/src/auth/require-permission.decorator.ts`

A thin wrapper around NestJS `SetMetadata`. The TypeScript signature accepts only the `Permission` union type, so compile-time enforcement prevents typos in permission names.

### 2.4 Usage in ScansController

**Source:** `backend/src/scans/scans.controller.ts`

`ScansController` and `SegmentJobsController` both declare `@UseGuards(AuthGuard, PermissionsGuard)` at the class level, ensuring both guards run on every route. Each handler carries an explicit `@RequirePermission`:

- `GET /api/cases/:caseId/scans` → `cases:read`
- `POST /api/cases/:caseId/scans` → `cases:write`
- `POST /api/cases/:caseId/scans/:scanId/segment` → `cases:write`
- `GET /api/cases/:caseId/scans/:scanId` → `cases:read`
- `GET /api/cases/:caseId/scans/:scanId/file` → no `@RequirePermission` (authenticated only, see below)
- `GET /api/segment-jobs/:jobId` → `cases:read`
- `POST /api/segment-jobs/:jobId/retry` → `cases:write`

**Gap:** `GET /api/cases/:caseId/scans/:scanId/file` (the raw file download endpoint) does not carry a `@RequirePermission` decorator. It is protected by `AuthGuard` and performs an org-scoped database lookup (`getScanFile()` checks `organization_id = orgId`), so unauthenticated access is blocked. However, a user with `cases:read` and one without (e.g., a hypothetical role that should not see scan files) would both be permitted. This should be made explicit.

### 2.5 Coverage Assessment

Because `@RequirePermission` is opt-in, a systematic audit of all controllers is needed to confirm every non-public endpoint carries the decorator or is intentionally public. The `PermissionsGuard` pass-through for unannotated handlers is the correct design for endpoints that need authentication but not a specific RBAC permission (e.g., `/api/auth/session`, `/api/me`), but the omission must be deliberate and documented.

### 2.6 Findings

| Finding | Rating |
|---|---|
| 10-role, 15-permission explicit permission matrix with TypeScript union type enforcement | **PASSED** |
| PermissionsGuard correctly reads Reflector metadata and enforces per-handler | **PASSED** |
| ScansController applies guards at class level; all write endpoints decorated | **PASSED** |
| `GET /api/cases/:caseId/scans/:scanId/file` lacks `@RequirePermission('cases:read')` — authentication-only protection | **REVIEW NEEDED** |
| Full controller coverage audit not yet completed — pass-through for unannotated handlers is a potential gap across other modules | **ACTION REQUIRED** |

---

## 3. Input Validation

### 3.1 Global ValidationPipe

**Source:** `backend/src/main.ts:111-119`

The application registers a global `ValidationPipe` with strict settings:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
  }),
);
```

- `whitelist: true` — strips properties not declared in the DTO.
- `forbidNonWhitelisted: true` — rejects requests that include undeclared properties (mass-assignment prevention).
- `transform: true` — coerces string path/query parameters to their declared types.
- `forbidUnknownValues: true` — rejects payloads that cannot be validated at all.

### 3.2 DTO Coverage

The strict `ValidationPipe` only activates when the handler parameter is decorated with a DTO class that uses `class-validator` decorators. Several endpoints (particularly in `auth.controller.ts`) accept plain typed objects:

```typescript
// auth.controller.ts:44-48
async login(
  @Body() body: { email?: string; password?: string },
  ...
)
```

Because `{ email?: string; password?: string }` is not a class with `@IsEmail()` / `@IsString()` / `@MinLength()` decorators, `class-validator` does not validate the fields. The validation that does occur is manual (`if (!email || !password)`, `password.length < 8`). While this prevents the most basic issues, it does not enforce email format, length limits, or character set restrictions on the login inputs.

### 3.3 SQL Injection Prevention

All database interactions use the `pg` pool's parameterised query API (`pool.query(sql, [params])`). No string concatenation or template literals are used to construct SQL from user input. Examples from `auth.service.ts` and `scans.service.ts`:

```typescript
// auth.service.ts:163-165
const { rows } = await this.pool.query<AuthUserRow>(
  'SELECT * FROM auth_users WHERE email = $1 LIMIT 1',
  [email.toLowerCase().trim()],
);
```

```typescript
// scans.service.ts:507-508
WHERE c.id = $1 AND p.organization_id = $2
[caseId, orgId]
```

No raw SQL injection vectors were identified. All queries use positional `$N` placeholders.

### 3.4 Findings

| Finding | Rating |
|---|---|
| Global ValidationPipe with whitelist, forbidNonWhitelisted, forbidUnknownValues — mass-assignment prevented | **PASSED** |
| All database queries use parameterised `$N` placeholders — SQL injection prevented | **PASSED** |
| Auth endpoints (login, register) do not use DTO classes; email format and password complexity are validated only by manual checks, not `class-validator` | **REVIEW NEEDED** |

---

## 4. Cookie Security

### 4.1 Cookie Attributes

**Source:** `backend/src/auth/auth.controller.ts`

| Attribute | Value | Notes |
|---|---|---|
| `httpOnly` | `true` | JavaScript cannot access `mo_session` |
| `secure` | `process.env.NODE_ENV === 'production'` | HTTPS-only in production; plain HTTP allowed in dev |
| `sameSite` | `'strict'` | Cookie sent only for same-site navigation |
| `maxAge` | `86400000` ms (24 h) | Matches JWT expiry |
| `path` | `'/'` | Scoped to entire origin |

These attributes are set consistently at login, register, and the logout `clearCookie` call.

### 4.2 CSRF Mitigation Rationale

No server-side CSRF token is validated. The defence relies on `sameSite: 'strict'`, which instructs browsers to omit the `mo_session` cookie on all cross-site requests (navigations from external origins, cross-origin form submissions, cross-origin AJAX). Under this model, a third-party site cannot forge a credentialed request because the browser will not attach the cookie.

This is an accepted and well-understood approach for same-origin web applications, provided:

1. The `sameSite: 'strict'` attribute is always set (confirmed — see Section 4.1).
2. CORS is configured to reject cross-origin requests with credentials from unexpected origins (confirmed — see Section 4.3).
3. The API never relies solely on cookies when accessed from non-browser clients, which is handled via the Bearer token fallback in `AuthGuard`.

The `allowedHeaders` list in the CORS config includes `X-CSRF-Token`, which is present for future flexibility but is not currently enforced.

### 4.3 CORS Configuration

**Source:** `backend/src/main.ts:99-109`

Allowed origins are `FRONTEND_URL` plus `localhost:3000` and `localhost:3005` in non-production environments. `credentials: true` is required for cookie-bearing cross-origin requests. The origin list is derived from the environment variable, not an open wildcard.

### 4.4 Security Headers (Helmet)

**Source:** `backend/src/main.ts:68-94`

Helmet is configured with:

- **CSP:** `default-src 'self'`; script and style sources limited to `'self'`; image sources allow `data:` and `blob:` for inline 3D rendering; connect sources allow Supabase and Stripe; `object-src 'none'`; `upgrade-insecure-requests`.
- **HSTS:** `max-age=31536000; includeSubDomains; preload` — submittable to the HSTS preload list.
- **COOP:** `same-origin-allow-popups` (accommodates OAuth popups).
- Other Helmet defaults: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy`.

### 4.5 Frontend — Inline Script Usage

**Source:** `frontend/src/app/layout.tsx`

The layout uses `dangerouslySetInnerHTML` in two places:

1. **`bootstrapScript`** — An inline `<script>` that reads `localStorage` for the theme preference and removes a launch shell element. The content is a hardcoded string constant; no user input or server data is interpolated.

2. **Launch shell img tag** — `dangerouslySetInnerHTML={{ __html: '<img src="/app-icon.png" ... onerror="this.style.display=\'none\'">' }}`. The src is a static path and the onerror handler is a fixed string literal.

Neither use interpolates user-controlled data, so XSS risk from these specific instances is not present. However, the use of `dangerouslySetInnerHTML` should be tracked — any future change that interpolates props or server data into these strings without sanitization would introduce XSS.

### 4.6 Findings

| Finding | Rating |
|---|---|
| HttpOnly + SameSite:strict cookie combination correctly mitigates CSRF for browser clients | **PASSED** |
| HSTS configured with 1-year max-age, includeSubDomains, and preload | **PASSED** |
| CSP is restrictive (`'self'`-only script/style sources; `object-src 'none'`) | **PASSED** |
| CORS origin list derived from environment variable, not open wildcard | **PASSED** |
| `dangerouslySetInnerHTML` in layout.tsx uses only hardcoded content — no user input | **PASSED** |
| `secure` cookie attribute is absent in development — this is intentional but should be documented and verified that dev environments do not serve over HTTPS with credentials | **REVIEW NEEDED** |
| `X-CSRF-Token` is listed in CORS `allowedHeaders` but never consumed server-side — this creates a false affordance | **REVIEW NEEDED** |

---

## 5. File Upload Security

### 5.1 Multer Configuration

**Source:** `backend/src/scans/scans.module.ts`

```typescript
MulterModule.register({
  storage: diskStorage({ ... }),    // writes to UPLOADS_DIR/scans/tmp/
  limits: { fileSize: 500 * 1024 * 1024 },  // 500 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.stl', '.obj', '.ply'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .stl, .obj, and .ply files are accepted'), false);
    }
  },
});
```

Files are written to a temporary directory before validation, then moved to permanent storage only on success. The filename in temp storage is `{timestamp}-{random}.{ext}`, preventing collisions and directory traversal via the original filename.

### 5.2 Magic Byte Validation

**Source:** `backend/src/scans/scans.service.ts:43-81`

After multer writes the file, `validateScanMagicBytes()` reads the first 256 bytes and validates format-specific markers:

| Format | Check |
|---|---|
| PLY | Header bytes 0-2 equal ASCII `ply` |
| ASCII STL | Header matches `/^solid\s/i` within first 80 bytes |
| Binary STL | ≥84 bytes; triangle count > 0; total size ≥ 84 + (count × 50) bytes |
| OBJ | First 256 bytes match OBJ line-start patterns (`v `, `vt `, `vn `, `f `, `#`, etc.) |

If the content does not match the declared extension, the temp file is deleted and a `BadRequestException` is thrown. This prevents content-type confusion attacks (e.g., uploading an executable renamed to `.stl`).

### 5.3 File Storage and Path Handling

Files are moved to `{UPLOAD_DIR}/scans/{orgId}/{caseId}/{timestamp}.{ext}`. The destination path is constructed using `path.join()` with server-controlled components (the orgId and caseId come from the authenticated session and database lookup, not user input). The `UPLOAD_DIR` is configurable via environment variable but defaults to `/app/uploads`, which is outside the web root.

The `filePath` column (internal filesystem path) is included in scan metadata returned to clients. This leaks the internal directory structure. It is used by the frontend to display file information, but exposing absolute paths is an unnecessary information disclosure.

### 5.4 Rate Limiting on Upload

**Source:** `backend/src/scans/scans.controller.ts:58`

```typescript
@Throttle({ default: { limit: 10, ttl: 60000 } })
@Post()
```

Upload is limited to 10 requests per 60 seconds per IP, overriding the global 100/60s default.

### 5.5 Organizational Scoping

Every scan operation calls `verifyCaseOwnership(caseId, orgId)` which performs a database join:

```typescript
// scans.service.ts:507-513
SELECT c.id FROM cases c
JOIN patients p ON p.id = c.patient_id
WHERE c.id = $1 AND p.organization_id = $2
```

This prevents an authenticated user from one organization accessing cases belonging to another.

### 5.6 Findings

| Finding | Rating |
|---|---|
| Extension whitelist in Multer fileFilter (STL/OBJ/PLY only) | **PASSED** |
| 500 MB file size limit enforced by Multer at ingestion | **PASSED** |
| Magic byte / content validation rejects mismatched format files | **PASSED** |
| Temp storage with server-generated filename (no user-controlled path traversal) | **PASSED** |
| Org-scoped case ownership verified on every scan operation | **PASSED** |
| 10 uploads / 60s rate limit on upload endpoint | **PASSED** |
| `filePath` (absolute filesystem path) is returned in scan metadata responses — information disclosure | **REVIEW NEEDED** |
| `Content-Disposition` header sets `filename="{originalFilename}"` without sanitizing the filename for double-quotes or CRLF — potential header injection if originalFilename is attacker-controlled | **ACTION REQUIRED** |

---

## 6. Rate Limiting

### 6.1 Global Throttler

**Source:** `backend/src/app.module.ts:93-100`

`ThrottlerModule` is registered globally with a single tier named `default`:

```typescript
ThrottlerModule.forRoot([
  {
    name: 'default',
    ttl: 60_000,
    limit: 100,
  },
])
```

`ThrottlerGuard` is registered as a global `APP_GUARD`, meaning every endpoint is rate-limited unless the handler carries `@SkipThrottle()`. The key is per-IP.

### 6.2 Per-Endpoint Overrides

| Endpoint | Limit | TTL | Decorator |
|---|---|---|---|
| `POST /api/auth/login` | 5 | 60 s | `@Throttle({ default: { limit: 5, ttl: 60000 } })` |
| `POST /api/auth/register` | 5 | 60 s | `@Throttle({ default: { limit: 5, ttl: 60000 } })` |
| `POST /api/cases/:id/scans` (upload) | 10 | 60 s | `@Throttle({ default: { limit: 10, ttl: 60000 } })` |
| `POST .../copilot/.../messages` | 20 | 60 s | `@Throttle({ default: { limit: 20, ttl: 60000 } })` |
| All other endpoints | 100 | 60 s | Global default |

### 6.3 Secondary Rate Limiting on Auth

**Source:** `backend/src/auth/auth.service.ts:132-157`

`AuthService.checkRateLimit()` provides a secondary layer of rate limiting at the application level (Redis-backed, 10 attempts / 60s per IP). This is called explicitly at the top of the login and register handlers. It complements the throttler (which operates at the NestJS middleware layer) and provides Redis-persistent state across restarts.

### 6.4 Findings

| Finding | Rating |
|---|---|
| Global ThrottlerGuard applied to all endpoints (100 req/60s default) | **PASSED** |
| Auth endpoints tightened to 5 req/60s | **PASSED** |
| Scan upload endpoint tightened to 10 req/60s | **PASSED** |
| Copilot AI endpoint tightened to 20 req/60s | **PASSED** |
| Double rate limiting on auth (ThrottlerGuard + Redis-backed `checkRateLimit`) | **PASSED** |
| `POST /api/auth/onboarding` and `POST /api/auth/logout` have no per-endpoint override (covered by global 100/60s) | **REVIEW NEEDED** |
| Throttler key is IP-only. Behind a reverse proxy, this depends on `X-Forwarded-For` being set correctly. `getIp()` in the auth controller reads `x-forwarded-for` header; if the proxy is misconfigured, all requests may share the same key | **REVIEW NEEDED** |

---

## 7. Dependency Security

### 7.1 Key Security-Relevant Dependencies

**Source:** `backend/package.json`

| Package | Version | Notes |
|---|---|---|
| `bcrypt` | `^6.0.0` | Password hashing; rounds = 12 |
| `jsonwebtoken` | `^9.0.3` | JWT signing/verification |
| `helmet` | `^8.2.0` | HTTP security headers |
| `@nestjs/throttler` | `^6.5.0` | Rate limiting |
| `pg` | `^8.22.0` | PostgreSQL client; parameterised queries |
| `ioredis` | `^5.11.1` | Redis client for blacklist and rate limit |
| `multer` | `^2.2.0` | Multipart file upload |
| `cookie-parser` | `^1.4.7` | Cookie parsing middleware |
| `class-validator` | `^0.14.1` | DTO validation |

All listed versions are relatively recent as of the audit date. Range specifiers (`^`) mean patch and minor updates are accepted automatically. Pinning to exact versions for security-critical packages is a best practice for production, though it increases maintenance overhead.

### 7.2 nodemailer — Dynamic Import

**Source:** `backend/src/notifications/email.service.ts`

nodemailer is not listed as a package.json dependency. It is imported dynamically at runtime:

```typescript
// email.service.ts:30-36
// Dynamic import avoids hard dependency on nodemailer at build time
const mod = 'nodemailer';
const nodemailer: any = await import(/* webpackIgnore: true */ mod as string).catch(() => null);
if (!nodemailer) {
  this.logger.warn('[EmailService] nodemailer not installed — email suppressed');
}
```

This is an intentional design: email is an optional capability. If nodemailer is not installed in the container image, the service degrades gracefully (emails are suppressed) rather than crashing. This avoids forcing a transitive SMTP dependency into deployments that use a different notification channel.

If nodemailer is installed, the version in the container's `node_modules` should be audited. The use of `any` typing and a string-based import (`const mod = 'nodemailer'`) to evade webpack bundling is a known pattern but means static analysis tools will not flag nodemailer vulnerabilities.

### 7.3 ENCRYPTION_KEY

**Source:** `backend/src/main.ts:22-34`

`ENCRYPTION_KEY` (≥32 chars) is required for PHI encryption. In development, its absence produces a logged warning; in production, startup fails. The audit did not inspect the encryption module directly; confirm that AES-256-GCM (or equivalent) is used with per-record IVs and that the key is never logged.

### 7.4 Recommendations Before GA

1. Run `npm audit --audit-level=moderate` and remediate all moderate+ findings.
2. Run `npm audit` inside the container image (where nodemailer may be present) in addition to the project directory.
3. Consider pinning `bcrypt`, `jsonwebtoken`, and `helmet` to exact versions in a lock-file review.
4. Add a Snyk or GitHub Dependabot scan to CI for ongoing monitoring.

### 7.5 Findings

| Finding | Rating |
|---|---|
| bcrypt rounds = 12 (adequate for 2026) | **PASSED** |
| jsonwebtoken v9, helmet v8, pg v8 — all recent major versions | **PASSED** |
| nodemailer is a dynamic optional import with graceful degradation | **PASSED** (intentional design) |
| `npm audit` has not been run as part of this audit — must be run before GA | **ACTION REQUIRED** |
| `ENCRYPTION_KEY` validation exists but PHI encryption implementation was not inspected in this audit | **REVIEW NEEDED** |

---

## 8. Security Posture Summary

### 8.1 Overall Assessment

MyOrtho.tech's backend has a solid security foundation appropriate for a healthcare SaaS application. The core authentication pipeline, password handling, token revocation, RBAC model, SQL injection prevention, and HTTP security header configuration are well-implemented. The areas requiring attention before a general availability release are primarily around systematic coverage verification and a small number of specific hardening items.

---

### 8.2 Strengths

- **Defense-in-depth on authentication.** HttpOnly + SameSite:strict cookies resist both XSS cookie theft and CSRF. JWT algorithm is pinned. Token revocation is implemented via Redis JTI blacklist. Rate limiting is layered (ThrottlerGuard + Redis `checkRateLimit`).

- **bcrypt with 12 rounds and timing-safe comparison.** The dummy `bcrypt.compare` on unknown email prevents timing-based user enumeration. Error messages are identical for "not found" and "wrong password".

- **Explicit RBAC with TypeScript enforcement.** The 15 permissions and 10 roles are defined in a single file. The `Permission` union type means invalid permission names cause compile errors. The `PermissionsGuard` is clean and straightforward.

- **Strict input validation pipeline.** `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, and `forbidUnknownValues` prevents mass-assignment and extra-field attacks on all DTO-decorated endpoints.

- **Parameterised SQL throughout.** No string-concatenated queries were found. The `pg` pool's `$N` placeholder API is used consistently.

- **Multi-layer file upload validation.** Extension whitelist in Multer is followed by magic-byte content validation in the service layer. Files are isolated in a temp directory before acceptance.

- **Robust startup environment validation.** `assertRequiredEnv()` in `main.ts` hard-fails in production if `JWT_SECRET`, `MYORTHO_ADMIN_PASSWORD`, or `FRONTEND_URL` are missing or weak.

- **Comprehensive HTTP security headers.** Helmet with a restrictive CSP (`'self'`-only scripts), `object-src 'none'`, and HSTS with preload.

- **Organisational data isolation.** Every data access method enforces `orgId` scoping at the database layer, not just in application logic.

---

### 8.3 Gaps

| # | Gap | Severity |
|---|---|---|
| G1 | `GET /api/cases/:caseId/scans/:scanId/file` lacks `@RequirePermission('cases:read')` | Medium |
| G2 | Auth endpoints do not use DTO classes; email format validation and password complexity rules rely on manual checks only | Low–Medium |
| G3 | `Content-Disposition` header uses raw `originalFilename` without sanitising for quotes or CRLF — potential header injection | Medium |
| G4 | `filePath` (absolute server filesystem path) returned in scan metadata responses | Low |
| G5 | Full RBAC coverage audit not completed — controller endpoints without `@RequirePermission` may be unintentionally unguarded | Medium |
| G6 | In-memory token blacklist fallback is node-local; revocation fails to propagate in multi-replica deployments without Redis | Medium |
| G7 | `bootstrapAdmin()` contains plaintext fallback password `'adminadmin'` as dead code — should be removed | Low |
| G8 | `is_active` check occurs after bcrypt comparison; disabled account password is still tested | Low |
| G9 | `npm audit` not run as part of this review | Medium |
| G10 | PHI encryption (`ENCRYPTION_KEY`) implementation not audited | Medium |

---

### 8.4 Recommendations

**Before GA release (ACTION REQUIRED):**

1. **[G3] Sanitise `Content-Disposition` filename.** Replace the raw filename interpolation in `scans.controller.ts:118` with a sanitised version that removes quotes and CRLF characters, or encode it per RFC 5987 (`filename*=UTF-8''...`).

2. **[G5] Complete RBAC coverage audit.** For every controller in `backend/src/`, verify that each non-public endpoint either carries `@RequirePermission` or is explicitly documented as authentication-only. A grep for `@UseGuards(AuthGuard)` without a paired `@RequirePermission` is a starting point.

3. **[G9] Run `npm audit --audit-level=moderate`.** Remediate or document all moderate and above findings. Include this in CI.

**Before GA release (REVIEW NEEDED):**

4. **[G1] Add `@RequirePermission('cases:read')` to the file download endpoint** (`GET /api/cases/:caseId/scans/:scanId/file`). The org-scoped DB check provides a functional guard, but the decorator is missing for consistency and makes the intent explicit.

5. **[G2] Introduce DTO classes for auth endpoints.** Create `LoginDto` and `RegisterDto` classes with `@IsEmail()`, `@IsString()`, `@MinLength()` etc. so the global `ValidationPipe` handles format validation consistently.

6. **[G4] Remove `filePath` from scan metadata API responses.** Clients do not need the server-side filesystem path. Return only the scan ID; file access should go through the authenticated download endpoint.

7. **[G6] Document Redis availability requirement.** If multi-replica deployment is planned, Redis must be considered non-optional. Add a startup health check that warns (or fails in production) if Redis is unreachable, rather than silently falling back to node-local state.

8. **[G10] Audit PHI encryption module.** Confirm AES-256-GCM with random per-record IVs, no key logging, and key rotation capability.

**Post-GA hardening:**

9. **[G7] Remove dead code fallback in `bootstrapAdmin()`.** The `'adminadmin'` default is unreachable but should not exist in the codebase.

10. **[G8] Move `is_active` check before bcrypt.** Return the same error message but skip bcrypt work for disabled accounts.

11. Consider adding explicit CSRF token validation for high-privilege state-changing operations (case approval, user management) as defence-in-depth beyond SameSite:strict, particularly for future integrations with third-party portals.

12. Add automated secret scanning (e.g., `trufflehog`, GitHub secret scanning) to CI to prevent accidental commit of credentials.

---

*This document reflects a point-in-time code review. It should be refreshed whenever significant changes are made to authentication, authorisation, file handling, or data access patterns.*
