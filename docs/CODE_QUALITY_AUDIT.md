# MyOrtho.tech — Code Quality Audit

> Audit date: 2026-07-08  
> Scope: `backend/src/`, `frontend/src/`, `database/schema.sql`  
> This is an honest assessment. Strengths and weaknesses are both recorded.

---

## TypeScript Strictness

Strict mode is enforced in the backend TypeScript configuration. `tsc --noEmit` passes with zero errors as of this audit date.

**`any` usage is more widespread than ideal.** The grep count shows 116 occurrences of the `any` type across 49 production and test files. The justified uses are:

- `email.service.ts` — the dynamic `import(nodemailer)` bridge. The `any` is explicitly annotated with `eslint-disable-next-line @typescript-eslint/no-explicit-any` and a comment explaining why. This is the correct pattern for an optional peer dependency loaded at runtime.
- `timing.middleware.ts` — patching `res.end` to intercept response completion. The `any` cast is narrow and the surrounding code is typed.

The remaining occurrences are spread across services, controllers, spec files, and connectors. Affected production files include `billing.controller.ts`, `billing.service.ts`, `auth.controller.ts`, `workflow.service.ts`, `ceph.service.ts`, `clinical-decision-support/cds.service.ts`, `events/event-bus.service.ts`, `tooth-movement/tooth-movement.service.ts`, `treatment-stages/treatment-stages.service.ts`, and others.

**Recommendation:** Enable `@typescript-eslint/no-explicit-any` as an error (not a warning) in `.eslintrc` and work through the remaining occurrences. Most can be replaced with typed interfaces or `unknown` with type guards.

---

## Consistency Findings

### Pool injection naming: `this.db` vs `this.pool`

All services correctly inject via `@Inject(PG_POOL)` from `DatabaseModule`, so the injection itself is consistent. However, the local property name is not standardised:

**Services using `this.db`:** `ClinicalReportsService`, `ArchCoordinationService`, `EmergencyProtocolsService`, `MovementConstraintsService`, `IprIntelligenceService`, `CopilotService`, `TreatmentSimulationService`, `ExportPackageService`, `SegmentationAutoCorrection`.

**Services using `this.pool`:** `CasesService`, `PatientsService`, `ManufacturingService`, `AnalysisService`, `SegmentationService`, `PreexportQaService`, `TreatmentQaService`, `SsoService`, `AdminService`, `PhotosService`, and many others.

The majority convention is `this.pool`. Services using `this.db` are outliers. This is a readability issue, not a functional one, but it slows onboarding and makes cross-service code review harder.

**Recommendation:** Standardise on `this.pool` for the PG pool injection. A rename refactor inside each affected service (not touching the injection token) resolves this.

### Row-mapping: `mapReport()` vs inline property access

`ClinicalReportsService` uses a private `mapReport(r: Record<string, unknown>): GeneratedReport` method that explicitly types each column before returning the domain object. This pattern makes the DB-to-domain boundary explicit and catches column renames at compile time.

Most other services return rows directly from `pg` as the untyped result of `pool.query()`, relying on duck typing. This works but silently drifts if column names change.

**Recommendation:** Adopt the `mapRow()` private method pattern in all services that return domain objects (cases, patients, scans, treatment plans at minimum). It is already proven in `ClinicalReportsService` — extract it as a shared convention in the project's coding standards.

### Port default discrepancy

`main.ts` defaults to port `4000` (`process.env.PORT || 4000`). `config.validator.ts` documents the default as `4001`. These are inconsistent. The `main.ts` value is authoritative at runtime; the validator's documentation is wrong.

---

## Dead Code

### `AllExceptionsFilter` (`src/common/all-exceptions.filter.ts`)

This file contains the original broad exception filter. It was superseded by `GlobalExceptionFilter` (`src/common/global-exception.filter.ts`), which is the filter registered in `main.ts` (`app.useGlobalFilters(new GlobalExceptionFilter())`).

`AllExceptionsFilter` is never registered anywhere. It is pure dead code. The old implementation also uses `(res as any).message` and leaks a slightly different JSON shape than the current `buildApiError` envelope.

`src/common/all-exceptions.filter.spec.ts` is also dead (it tests the removed class).

**Recommendation:** Delete `src/common/all-exceptions.filter.ts` and `src/common/all-exceptions.filter.spec.ts` in the next cleanup PR.

---

## Error Handling

**Strengths:**

- `GlobalExceptionFilter` catches every unhandled exception. It never exposes internal details (stack traces, raw error messages) on 5xx responses to clients. The correlation ID is included in the response envelope for log correlation.
- All service methods propagate exceptions by throwing. No silent swallowing was detected in the main request path.
- Email send failures in `EmailService` are caught, logged at `error` level, and treated as non-fatal. This is the correct pattern for optional infrastructure — a failed notification email must not abort a clinical workflow.
- `LoggingInterceptor` wraps the full handler lifecycle, providing a second logging layer above the filter.

**Observation:**

Redis failure is handled gracefully in `AuthService`: when `REDIS_CLIENT` is `null` (Redis absent) or when a Redis operation throws, the service falls back to an in-memory `Map` for rate limiting and a `Set` for token blacklisting. This is explicitly coded, not accidental. The in-memory fallback is cleared on process restart, so it is not suitable for multi-replica deployments — document this constraint if horizontal scaling is planned.

---

## SQL Patterns

**Strengths:**

- Parameterised queries are used throughout. No raw SQL string interpolation was found in production service code. All values reach the database as `$1`, `$2`, etc.
- `PG_POOL` is injected via NestJS DI; no service creates its own pool or connection directly.
- The pool is configured with a 30-second statement timeout enforced at both pool level (`statement_timeout: 30_000`) and per-connection (`SET statement_timeout = 30000` on `connect`).
- Pool errors are logged and do not crash the process.

**Observation:**

Several services issue `SELECT * FROM ...` rather than naming columns explicitly. This increases row payload and makes the db-to-domain mapping less explicit. Combined with the absence of a `mapRow()` pattern in most services, column renames or additions are not caught by TypeScript.

---

## OpenAPI / Swagger

No `@ApiOperation`, `@ApiTags`, or any `@nestjs/swagger` decorators exist anywhere in the backend (confirmed by code search). The only API documentation is the hand-maintained `docs/API.md`.

**This is a significant gap.** There is no machine-readable API contract, no auto-generated client types, and no interactive documentation.

---

## Clinical Data Safety

- All AI copilot responses carry a clinical disclaimer. AI output is clearly labelled and never silently presented as clinician-authored content.
- Confidence levels (`very_high` | `high` | `medium` | `low` | `unknown`) are persisted to the database alongside every assistant message.
- Explainability data (`why`, `evidence`, `limitations`, `reviewSteps`) is stored and surfaced to the clinician before they act on a suggestion.
- Suggestions carry a `severity` field (`info` | `warning` | `critical`) that routes presentation appropriately in the UI.
- The LLM is optional; if `LLM_API_KEY` is absent, the system falls back to rule-based intent classification rather than failing.

No fabrication paths were identified. Clinical data is always read from the database and passed as context, not generated from the model's weights alone.

---

## Recommendations

Ordered by estimated risk reduction:

1. **Delete dead filter files.** Remove `src/common/all-exceptions.filter.ts` and its spec. The old filter has a different error shape and uses `any`; leaving it risks confusion when debugging or when someone accidentally registers it.

2. **Enforce `no-explicit-any` as an ESLint error.** 116 occurrences across 49 files is a meaningful TypeScript coverage gap. Enable the rule and iterate. Start with non-test production files.

3. **Add OpenAPI/Swagger.** Install `@nestjs/swagger`, add `@ApiTags` and `@ApiOperation` to all controllers, and wire `SwaggerModule.setup()` in `main.ts` behind an environment guard for production. The existing `docs/API.md` can serve as the source of truth for the descriptions.

4. **Standardise pool property name to `this.pool`.** Rename the nine services that use `this.db` for the PG pool. One-line change per service; makes cross-service reading consistent.

5. **Adopt the `mapRow()` pattern across all domain services.** Define a typed `mapRow()` (or `mapCase()`, `mapPatient()`, etc.) in every service that returns a domain object. Drop `SELECT *` in favour of explicit column lists in the same pass.

6. **Fix the port default discrepancy.** Change `config.validator.ts` `default: '4001'` for `PORT` to `'4000'` to match the actual runtime default in `main.ts`, or vice versa if 4001 is intentional.

7. **Add unit tests for `AuthService`.** The auth service manages token signing, bcrypt, Redis blacklisting, login rate limiting, and admin bootstrapping. It has a spec file (`auth.service.spec.ts`) but coverage should be verified and expanded to cover the Redis-absent fallback paths explicitly.

8. **Document the single-process Redis blacklist limitation.** The in-memory token blacklist fallback is intentional but not fit for multi-replica deployments. Add a comment to `AuthService` and a note in `docs/ENV_VARS.md` that `REDIS_URL` must be set before running more than one backend process.
