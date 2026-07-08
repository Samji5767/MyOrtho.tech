# MyOrtho.tech Coding Standards

This document defines the coding standards for all MyOrtho.tech backend and frontend code. These standards exist to maintain consistency, safety, and auditability across a clinical platform where errors can have patient-safety implications.

All contributors are expected to follow these standards. PR reviews should flag deviations.

---

## TypeScript

- **Strict mode is required.** `tsconfig.json` sets `"strict": true`. Do not disable or override this.
- **No implicit `any`.** All variables, parameters, and return values must have explicit or inferrable types. `noImplicitAny` is enforced by the compiler.
- **Explicit return types on exported functions.** Any function or method exported from a module must have an explicit return type annotation. Inference is acceptable for private/internal helpers.
- **No `as any` except for documented bridge patterns.** The only approved exception is the `nodemailer` dynamic import pattern, which requires a type cast due to CommonJS/ESM interop. Any other use of `as any` must be accompanied by a comment explaining why and must be flagged for review.
- **Prefer `unknown` over `any` for untrusted input.** When accepting external data (API responses, parsed JSON, user input), type it as `unknown` and narrow it explicitly.
- **Avoid non-null assertion (`!`) on user-supplied values.** Use optional chaining (`?.`) or explicit null checks.

---

## NestJS

- **One module per domain.** Each business domain (cases, patients, treatment plans, manufacturing, billing, AI copilot) lives in its own NestJS module. Do not add routes or services from one domain into another domain's module. See ADR-003.
- **Services contain business logic; controllers do not.** Controllers are responsible for: receiving HTTP requests, validating input via DTO pipes, delegating to a service, and returning the response. No database queries, business rules, or conditional logic in controllers.
- **Use `@Inject()` for dependency injection.** Inject services and tokens using `@Inject('TOKEN')` or constructor injection via NestJS DI. Do not instantiate services with `new`.
- **Never access the database directly from controllers.** All database access goes through a service. Controllers must not import or inject `PG_POOL`.
- **DTOs must use `class-validator` decorators.** All request body and query DTOs must be validated with `class-validator` annotations and the `ValidationPipe`. Unvalidated input must not reach service logic.
- **Use `@Global()` sparingly.** Only `DatabaseModule` and `AuthModule` are global. Do not mark feature modules as global.

---

## SQL

- **Always use parameterized queries.** Every value interpolated into a SQL query must be passed as a parameter (`$1`, `$2`, ...). Never use string concatenation, template literals, or string interpolation to build SQL.

  ```typescript
  // Correct
  await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);

  // Prohibited
  await pool.query(`SELECT * FROM patients WHERE id = '${patientId}'`);
  ```

- **Never use string interpolation in SQL.** This is a SQL injection vulnerability. There are no exceptions.
- **Migrations must be idempotent.** Each migration file must be safe to re-run (use `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, etc.).
- **One concern per migration file.** Each migration file addresses a single schema change (add a table, add a column, create an index). Do not bundle unrelated changes in one migration.
- **Migration files are append-only.** Never modify a migration file that has already been applied to any environment. Create a new migration to correct a previous one.

---

## Frontend

- **`"use client"` at the top of client components.** Any React component that uses hooks (`useState`, `useEffect`, etc.), browser APIs, or event handlers must have `"use client"` as the first line of the file.
- **Use `useAsync` for async state management.** The project's `useAsync` hook handles loading, error, and data states consistently. Do not manually manage `isLoading`/`error`/`data` triplets with separate `useState` calls.
- **All API calls go through `lib/api/*`.** Never call `fetch` directly in a component or hook. Use the typed API client functions in `lib/api/`. This ensures consistent error handling, base URL resolution, and cookie credential inclusion.
- **No Bearer tokens, ever.** The authentication mechanism is HttpOnly cookie. Do not store tokens in localStorage, sessionStorage, or JavaScript variables for the purpose of API authentication. See ADR-001.
- **No `console.log` in committed code.** Use the application logger for debugging. Remove all `console.log`, `console.warn`, and `console.debug` calls before committing.
- **Type API responses.** Do not use `any` for API response types. Define or import the appropriate response type from `lib/types/`.

---

## Clinical Safety

These rules apply to any code that produces, transforms, or displays clinical data or AI-generated recommendations. Violations are treated as high-severity defects.

- **AI outputs must always include a disclaimer.** Any recommendation, suggestion, or analysis produced by the AI Copilot must include the `CLINICAL_DISCLAIMER` constant in its response payload. The frontend must display this disclaimer to the user. Never omit it.
- **`confidence_level` must always be set.** AI recommendation objects must always have a `confidence_level` field populated. A missing or `undefined` confidence level must not pass code review.
- **Never fabricate clinical data.** No code path may generate, guess, or interpolate patient measurements, diagnoses, or clinical observations that were not explicitly provided by the user or computed from real inputs. LLM prompts must instruct the model not to fabricate clinical values.
- **Audit log all AI recommendations.** Every AI recommendation returned to a user must be logged with: timestamp, patient/case ID, input summary, recommendation, confidence level, and source (rule engine or LLM).
- **Clinical outputs require human review prompt.** The UI must always present AI recommendations as decision support, not decisions. The user interface must not allow AI output to be treated as a final clinical determination without an explicit clinician acknowledgement step.

---

## Git

- **Conventional commits.** All commit messages must follow the format: `type(scope): description`. Allowed types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `perf`. Example: `feat(cases): add case archival endpoint`.
- **Pull requests require TypeScript check passing.** The CI pipeline runs `tsc --noEmit` on both backend and frontend. A PR cannot be merged if either check fails. Do not merge with TypeScript errors.
- **No force push to `main`.** `main` is a protected branch. Force pushes are prohibited. Use `git revert` to undo changes that have already been merged.
- **Branch naming.** Use `feat/short-description`, `fix/short-description`, or `chore/short-description` as branch names.
- **PR size.** Keep PRs focused. A PR that touches more than 500 lines of non-generated code should have a strong justification. Split large features into incremental PRs where possible.
- **No secrets in commits.** Never commit API keys, passwords, database credentials, or private keys. Use environment variables. The CI pipeline scans for secrets; violations will block the PR.
