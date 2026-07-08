# Testing Strategy

This document describes the current testing approach, honest coverage state, targets for v1.0 GA, and operational guidance for running and extending tests in the MyOrtho.tech backend and frontend.

---

## Testing Layers

### Unit tests (NestJS services, isolated)

Location: files matching `src/**/*.spec.ts` in the `backend/` directory.

Unit tests cover individual service methods in isolation using Jest mocks for all external dependencies (database pool, Supabase client, external HTTP calls). They do not require a running database or network. The test runner is Jest, configured in `backend/package.json` with `rootDir: src`.

### Integration tests (database-backed)

Integration tests are co-located in the backend `src/` tree but are skipped at runtime when the `DATABASE_URL` environment variable is not set. They exercise real SQL against a test database and verify that service-layer logic interacts correctly with the schema. They require a Postgres instance seeded with the development schema.

### E2E smoke tests

Location: `backend/test/smoke.e2e-spec.ts` (and peer specs in `backend/test/`).

The E2E suite spins up the full NestJS application via `@nestjs/testing` and fires real HTTP requests through `supertest`. It is conditionally skipped when `DATABASE_URL` is absent. The suite currently contains four spec files:

| File | Purpose |
|---|---|
| `smoke.e2e-spec.ts` | 9 tests: health endpoint, auth surface (login rejects bad creds), 5 protected routes return 401 without a session cookie, CSRF mitigation documentation, skip-status |
| `health.e2e-spec.ts` | Dedicated health endpoint assertions |
| `auth-me.e2e-spec.ts` | Auth and `/api/me` session contract |
| `phase25-workflow.e2e-spec.ts` | Case state-machine transition scenarios |

The E2E config lives at `backend/test/jest-e2e.json`.

### Frontend build / type check

The frontend (Next.js + TypeScript) is validated by `npm run build` which runs the TypeScript compiler and Next.js's bundler in one pass. This catches type errors and import failures across the entire component tree without needing a browser. The frontend also ships a Vitest configuration (`vitest.config.ts`) for component-level unit tests.

---

## Current Coverage State

**What is tested:**

- **E2E smoke layer:** All currently listed protected routes return 401 when called without a session cookie. The auth surface rejects invalid credentials with 400 or 401 (not 404, confirming the route exists). The health endpoint is always reachable.
- **Workflow state machine (E2E):** `phase25-workflow.e2e-spec.ts` exercises case state transitions end-to-end.
- **Auth / session contract (E2E):** `auth-me.e2e-spec.ts` covers the login → cookie → `/api/me` round-trip.
- **Exception filter (unit):** `src/common/all-exceptions.filter.spec.ts` validates the error shape produced by `GlobalExceptionFilter`.

**What is not tested (known gaps as of 2026-07-08):**

- Unit tests for `CasesService`, `NotificationsService`, `AuthService`, and `AuditService` do not yet exist. Business logic in these services is only covered incidentally by E2E tests.
- Frontend component tests: no Vitest specs exist yet under `frontend/src/`.
- AI copilot response validation: no tests for the shape or content of LLM-generated suggestions.
- Clinical report generation: no snapshot or output-format tests.
- RBAC permission matrix: no systematic tests verifying that each role can and cannot access each protected endpoint.
- Rate-limit behavior under load: the throttler configuration is not exercised in the test suite.
- Scan upload and STL processing pipelines.

---

## Coverage Targets for v1.0 GA

The following areas must reach meaningful unit or integration test coverage before the v1.0 GA release is certified.

### Auth service — critical path

- Correct JWT signing and verification (happy path and expired/revoked token).
- Password hashing and comparison.
- `checkRateLimit` blocks after the configured threshold.
- `markOnboarded` persists state correctly.

### Case state machine transitions

- Every valid transition in `WorkflowService.TRANSITIONS` succeeds when the actor has `cases:write`.
- Every invalid transition (not in the allowed set) returns `CASE_002` with 400.
- The `approved` → `active_treatment` path requires `cases:approve` and is blocked for actors who only hold `cases:write`.
- Transitions to `archived` and `cancelled` are available from every non-terminal state.

### RBAC permission checks

- For each defined permission token (`cases:read`, `cases:write`, `cases:approve`), write a parameterized test that verifies:
  - A role that holds the permission succeeds (200/201).
  - A role that lacks the permission receives 403 with `AUTH_003`.

### Clinical report generation

- Snapshot tests for the PDF/JSON output format: the structure of a generated report must not change without an explicit snapshot update.
- Validate that no patient-identifying fields appear in the report fixture output (see [Clinical Data in Tests](#clinical-data-in-tests)).

### AI copilot response format

- Unit tests verifying that the copilot service returns the expected schema regardless of LLM provider response variations (mock the LLM client).
- Verify that `AI_001` is returned for a missing conversation ID and `AI_003` is returned when the LLM backend is unavailable.

---

## Running Tests

### Backend unit tests

```bash
cd backend
npm run test
```

Runs all `*.spec.ts` files under `src/`. Does not require a database or any external service. Fast; suitable for pre-commit checks.

### Backend unit tests with coverage

```bash
cd backend
npm run test:cov
```

Outputs an lcov/text coverage report to `backend/coverage/`.

### Backend E2E tests

```bash
export DATABASE_URL="postgres://user:pass@localhost:5432/myortho_test"
cd backend
npm run test:e2e
```

Requires a reachable Postgres instance. All tests in `backend/test/` are skipped gracefully (`SKIP = !process.env.DATABASE_URL`) when `DATABASE_URL` is absent, so the command will not fail in environments without a database — but it will not execute meaningful assertions either.

### Frontend type check and build validation

```bash
cd frontend
npm run build
```

Performs full TypeScript type-checking and Next.js build compilation. A build failure is a blocking CI signal.

### Frontend component unit tests

```bash
cd frontend
npm run test
```

Runs the Vitest suite. Currently no specs exist; this command exits cleanly. Once specs are added they will run here.

---

## CI Recommendations

The following checks are recommended for the CI pipeline.

| Check | Trigger | Blocking |
|---|---|---|
| TypeScript compilation (`npm run build`) for backend and frontend | Every pull request | Yes |
| Backend unit tests (`npm run test`) | Every pull request | Yes |
| E2E smoke tests (`npm run test:e2e`) | Merge to `main` / deployment branch | Yes |
| `npm audit --audit-level=high` on all `package.json` manifests | Weekly scheduled job | Yes (for high/critical) |
| Coverage threshold enforcement (`npm run test:cov`) | Merge to `main` | Recommended once baseline is set |

**Rationale for separating smoke E2E from PR checks:** The E2E suite requires a live database. Provisioning a test database on every PR adds pipeline latency and infrastructure cost. The unit + TypeScript checks catch the vast majority of regressions on PRs; E2E acts as a gate before any code reaches a deployed environment.

---

## Clinical Data in Tests

MyOrtho.tech processes protected health information (PHI). Test data discipline is a compliance requirement, not a suggestion.

**Rules:**

1. **No real patient data in any test fixture, mock, or seed file.** This includes names, dates of birth, scan files, clinical notes, and any field that could identify a real person.
2. **All synthetic fixtures must be clearly marked.** Use clearly fictional names (e.g., `Test Patient Alpha`, `Jane Synthetic`), obviously fake identifiers, and dates that fall outside plausible clinical ranges (e.g., year 2099 or the Unix epoch).
3. **Seed scripts for the test database must include a prominent header** such as:
   ```sql
   -- TEST DATA ONLY — NOT FOR CLINICAL USE — DO NOT COPY TO PRODUCTION
   ```
4. **Never use production database credentials in the test environment.** The `DATABASE_URL` used for E2E tests must point to an isolated test schema.
5. **Scan fixtures** (STL files, CBCT images) must be synthetically generated or sourced from publicly available phantom datasets with no patient association.
6. **If a real-data import is ever needed for a bug reproduction,** it must be anonymized before touching any non-production system, and the anonymized fixture must be deleted after the investigation is closed.

Violations of these rules must be treated as security incidents and reported to the engineering lead immediately.
