# Phase N — OWASP Top 10 Security Audit Report

**Date**: 2026-07-02  
**Branch**: `claude/myortho-production-validation-dlmvsi`  
**Method**: Full source code audit of backend, frontend, and AI engine. No penetration testing performed.

---

## A01 — Broken Access Control: PARTIAL

### What passes

- Most controllers use `@UseGuards(AuthGuard, PermissionsGuard)` + `@RequirePermission()` decorators
- Service-layer queries scope results to `organization_id` (via patient join for cases)
- `SegmentJobsController` passes `orgId` to job status queries
- Stripe webhook extracted to separate controller with no auth guard (fix applied this session)
- `GET /billing/analytics` now requires admin role (fix applied this session)
- `POST /api/credits/grant` now requires admin role (fix applied this session)
- `POST /api/features/:flagName` now requires admin role (fix applied this session)

### Issues remaining

| # | Issue | Location | Risk |
|---|-------|----------|------|
| N-A01-1 | `PhotosController` has no `@RequirePermission` — any authenticated user can list/delete PHI photos | `backend/src/photos/photos.controller.ts` | HIGH |
| N-A01-2 | `SegmentJobsController` has no `@RequirePermission('cases:read')` — any user can query job status by guessing UUID | `backend/src/segmentation/segment-jobs.controller.ts` | LOW |
| N-A01-3 | `UploadPhotoDto.filePath` is user-controlled and stored in DB without path validation | `backend/src/photos/photos.service.ts:82` | MEDIUM |

---

## A02 — Cryptographic Failures: PARTIAL

### What passes

- bcrypt rounds = 12 (adequate)
- Constant-time fake compare for unknown email (prevents username enumeration)
- `httpOnly: true`, `SameSite: 'strict'`, `secure: production` on session cookie

### Issues

| # | Issue | Location | Risk |
|---|-------|----------|------|
| N-A02-1 | **PHI stored plaintext** — `first_name`, `last_name`, `dob`, `gender`, `clinical_notes` inserted without encryption despite `ENCRYPTION_KEY` env var. Startup only warns when key absent — does not block. No AES call exists in `patients.service.ts` | `backend/src/patients/patients.service.ts` | **CRITICAL — HIPAA** |
| N-A02-2 | JWT verification does not pin algorithm: `jwt.verify(token, secret)` without `{ algorithms: ['HS256'] }` — historically allowed `alg: none` confusion attacks | `backend/src/auth/auth.service.ts:70` | MEDIUM |
| N-A02-3 | `.env` has `ENCRYPTION_KEY=local_phase_b_enc_32byte_key_hex` — a predictable string, not cryptographically random | `.env:8` | MEDIUM (dev only) |

---

## A03 — Injection: PASS

All PostgreSQL queries use parameterized placeholders (`$1`, `$2`, …) consistently. Dynamic query construction in `ai-suggestions.service.ts` appends only fixed literals, not user input. No shell exec in TypeScript. No `shell=True` in Python.

---

## A04 — Insecure Design: PARTIAL

| # | Issue | Location | Risk |
|---|-------|----------|------|
| N-A04-1 | AI engine path sandboxing conditional on `UPLOADS_DIR` env var. Without it, absolute paths like `/etc/shadow` bypass the traversal check (only literal `..` rejected) | `ai-engine/src/main.py:56–77` | HIGH |
| N-A04-2 | CSP disabled: `contentSecurityPolicy: false` in Helmet configuration | `backend/src/main.ts:49` | MEDIUM |
| N-A04-3 | `INTERNAL_API_SECRET` absent from `.env` and `.env.example` — service-to-service auth degrades to requiring a user JWT | `backend/src/scans/scans.service.ts:16–20` | LOW |

---

## A05 — Security Misconfiguration: FAIL

| # | Issue | Location | Risk |
|---|-------|----------|------|
| N-A05-1 | All Dockerfiles run as root — no `USER` directive in `backend/Dockerfile`, `ai-engine/Dockerfile`, `frontend/Dockerfile` | All three Dockerfiles | HIGH |
| N-A05-2 | Default admin password `adminadmin` used if `MYORTHO_ADMIN_PASSWORD` is unset; startup warns but does not block | `backend/src/auth/auth.service.ts:186` | HIGH |
| N-A05-3 | `forbidNonWhitelisted: false` and `forbidUnknownValues: false` in `ValidationPipe` | `backend/src/main.ts:73–74` | LOW |
| N-A05-4 | `secure: production` cookie attribute tied to `NODE_ENV` — if NODE_ENV=production but FRONTEND_URL is HTTP, browser silently drops cookies | `backend/src/auth/auth.controller.ts:21` | LOW |
| N-A05-5 | AI engine `CORSMiddleware` imported but never registered via `app.add_middleware()` | `ai-engine/src/main.py:24` | LOW |

---

## A06 — Vulnerable Components: PARTIAL

### What passes

- `package-lock.json` with lockfileVersion 3 (SHA-512 SRI hashes) exists for backend
- `jsonwebtoken 9.0.3`, `bcrypt 6.0.0`, `helmet 8.2.0`, `pg 8.22.0` — current major versions

### Issues

| # | Issue | Risk |
|---|-------|------|
| N-A06-1 | `ai-engine/requirements.txt` uses `>=` version ranges with no lock file or hash verification. `pip install` at build time fetches latest-matching without integrity check | MEDIUM |
| N-A06-2 | No `npm audit` or `pip-audit` step in CI pipeline | MEDIUM |

---

## A07 — Authentication and Session Management: PARTIAL

### What passes

- Login rate limiting: 10 attempts/60s per IP (Redis-backed)
- 24h JWT expiry
- Session cookie: httpOnly, Secure (in production), SameSite=Strict

### Issues

| # | Issue | Location | Risk |
|---|-------|----------|------|
| N-A07-1 | **No JWT revocation on logout** — cookie is cleared but token remains valid for up to 24h. No blacklist, no `jti` claim | `backend/src/auth/auth.controller.ts:69` | HIGH |
| N-A07-2 | **Login/logout not audited** — no call to `AuditService` on auth events; HIPAA audit trail gap | `backend/src/auth/auth.controller.ts` | HIGH |
| N-A07-3 | Rate limiting trusts `X-Forwarded-For` at face value — can be forged to bypass rate limit | `backend/src/auth/auth.controller.ts:39` | MEDIUM |
| N-A07-4 | Raw JWT returned in login response body for all clients, not only iOS (where it's intended for Keychain) | `backend/src/auth/auth.controller.ts:63` | LOW |
| N-A07-5 | No per-account lockout — only IP-based; attackers with many IPs can brute-force specific accounts | auth flow | LOW |
| N-A07-6 | In-memory rate limit fallback loses state on restart; multi-instance deployments each have independent state | `backend/src/auth/auth.service.ts` | LOW |

---

## A08 — Software and Data Integrity: PARTIAL

- Backend `package-lock.json` with SRI hashes: GOOD
- Python requirements: no lock file or hash verification (see A06-1)
- No SLSA provenance or `--check-build-dependencies` in CI

---

## A09 — Logging and Monitoring: PARTIAL

### What passes

- `AllExceptionsFilter` logs 5xx with stack traces server-side; returns sanitized envelope to clients
- `AuditService` wired into patients, cases, admin, scans mutations
- AI engine writes structured JSON auth audit logs

### Issues

| # | Issue | Risk |
|---|-------|------|
| N-A09-1 | Login/failed login/logout not written to `audit_events` table | HIGH (HIPAA) |
| N-A09-2 | `AllExceptionsFilter` includes `path: request.url` in 5xx response — URL may contain patient/case IDs | LOW |
| N-A09-3 | Rate-limit events not written to observable store — repeated violations go undetected | LOW |

---

## A10 — SSRF: PASS

All outbound HTTP calls target fixed, env-var-defined URLs (`AI_ENGINE_URL`, `https://api.anthropic.com`, Stripe). No user-controlled URLs passed to `fetch()`.

---

## Additional Security Checks

### XSS: PASS

`dangerouslySetInnerHTML` in `layout.tsx` uses only compile-time constant strings. No user-supplied data is interpolated into HTML. React escapes dynamic content by default.

### CSRF: PASS

`SameSite: 'strict'` on the session cookie prevents CSRF for browser-based flows. The `X-CSRF-Token` header is in CORS `allowedHeaders` but no server-side token validation is needed given SameSite=Strict coverage.

### File Upload: PARTIAL

- Extension allowlist (`.stl`, `.obj`, `.ply`) — correct
- MIME type NOT validated — extension check bypassable by renaming files
- Size limit discrepancy: `scans.module.ts` sets 250MB but `scans.controller.ts` FileInterceptor overrides to 500MB; controller wins

### Path Traversal: LOW RISK

Scan file paths are server-generated. `photos.service.ts` `filePath` is user-controlled (IDOR/traversal risk if a serving endpoint is added).

---

## Severity-Ranked Finding Summary

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | CRITICAL | PHI stored plaintext — no field-level encryption despite ENCRYPTION_KEY env var | `patients.service.ts` |
| 2 | HIGH | JWT not revoked on logout — 24h validity window after session end | `auth.controller.ts:69` |
| 3 | HIGH | Login/logout not written to audit_events — HIPAA gap | `auth.controller.ts` |
| 4 | HIGH | All containers run as root | All Dockerfiles |
| 5 | HIGH | AI engine path sandbox disabled when UPLOADS_DIR unset | `ai-engine/src/main.py:56–77` |
| 6 | HIGH | Default admin password `adminadmin` — startup warns, does not block | `auth.service.ts:186` |
| 7 | HIGH | PHI photos accessible without PermissionsGuard | `photos.controller.ts` |
| 8 | MEDIUM | CSP disabled in Helmet | `main.ts:49` |
| 9 | MEDIUM | User-controlled filePath stored without path validation | `photos.service.ts:82` |
| 10 | MEDIUM | X-Forwarded-For forging bypasses login rate limit | `auth.controller.ts:39` |
| 11 | MEDIUM | JWT verify missing explicit algorithm pinning | `auth.service.ts:70` |
| 12 | MEDIUM | Python requirements no lock file or hash verification | `ai-engine/requirements.txt` |
| 13 | MEDIUM | File upload validates extension only, not MIME type; 250MB vs 500MB discrepancy | `scans.module.ts`, `scans.controller.ts` |
| 14 | LOW | Raw JWT returned in login body for all clients | `auth.controller.ts:63` |
| 15 | LOW | INTERNAL_API_SECRET absent from env; service auth degrades to user JWT | `scans.service.ts:16–20` |
| 16 | LOW | AI engine CORSMiddleware imported but not registered | `ai-engine/src/main.py:24` |
| 17 | LOW | forbidNonWhitelisted: false in ValidationPipe | `main.ts:73–74` |

---

## Remediation Priority

**Block production with PHI (critical)**:
1. Implement AES-256-GCM field-level encryption for `patients.first_name`, `last_name`, `dob`, `clinical_notes` via Node.js `crypto.createCipheriv`. Make `assertRequiredEnv()` throw (not warn) when `ENCRYPTION_KEY` is absent.
2. Implement JWT blacklist: add `jti` to `signToken()`; store in Redis on logout with TTL = remaining expiry; check in `verifyToken()`.
3. Wire `AuditService.log()` into login (success/failure), logout, and rate-limit events.

**High (before production)**:
4. Add `USER node` before `CMD` in all three Dockerfiles.
5. Set `UPLOADS_DIR` to required in AI engine startup.
6. Make `MYORTHO_ADMIN_PASSWORD` required via `assertRequiredEnv()` (throw, not warn).
7. Add `@RequirePermission('patients:read')` + `PermissionsGuard` to `PhotosController`.

**Medium (hardening)**:
8. Enable CSP in Helmet with a strict policy.
9. Validate `UploadPhotoDto.filePath` against `UPLOAD_DIR` prefix using `path.resolve()`.
10. Trust `X-Forwarded-For` only via `app.set('trust proxy', 1)`.
11. Explicit algorithm pinning: `jwt.verify(token, secret, { algorithms: ['HS256'] })`.
12. Add `requirements.lock` via `pip-compile` with `--generate-hashes`.
13. Add `file.mimetype` validation to scan upload; unify file size to 250MB.

**Security Score**: 72/100  
Rationale: Strong baseline (JWT, bcrypt, SameSite, RBAC, Helmet, rate limiting, audit logging for data events). Critical gap: PHI stored plaintext. High gaps: no JWT revocation, auth events not audited, containers as root. Many medium and low items addressable before launch.
