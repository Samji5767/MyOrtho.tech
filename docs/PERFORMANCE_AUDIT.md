# Performance Audit — MyOrtho.tech

_Grounded in source code as of v1.0.0-beta.1 (migrations 000–054). Last reviewed: 2026-07-08._

---

## 1. Frontend Rendering

### Static Export

`next.config.js` sets `output: 'export'`, which means every route is pre-rendered to static HTML and CSS at build time and written to `next-build/`. There is no Node.js server at runtime; the app is served from Nginx (or object storage) as a set of static files.

Consequences:

- **No server-side rendering (SSR), no server actions, no API routes in Next.js.** All data is fetched client-side after the initial shell is painted.
- `images.unoptimized: true` disables Next.js image optimization; the browser receives full-resolution images without automatic resizing or lazy WebP conversion.
- `trailingSlash: true` causes every directory to get an `index.html`, which is required for most static hosts.

### Dynamic Imports with `{ ssr: false }`

Because the output is a static export, `{ ssr: false }` is logically redundant (no server exists at runtime), but it is still applied to all heavy client-only components to ensure that the 3D and clinical panel bundles are **code-split into separate chunks** and are not included in the initial HTML shell. `CaseDetailClient.tsx` lazy-loads at least 15 panels this way, including:

- `ScanPanel` — Three.js / STL viewer
- `TreatmentPlansPanel` — treatment planning UI
- `ToothTransformPanel`, `CephalometricPanel` — CAD-adjacent panels
- `ClinicalReportsPanel`, `ClinicalAlertsPanel`, `OcclusionPanel`
- `CbctFusionPanel`, `RadiologyPanel`, `ScanProcessingPanel`

Each panel is a separate webpack chunk. The browser downloads only the chunk for the panel the user navigates to.

### Barrel Import Tree-Shaking

`experimental.optimizePackageImports` in `next.config.js` enables Next.js barrel import optimization for `lucide-react`, `@react-three/fiber`, and `@react-three/drei`. This prevents the entire icon or Three.js library from being bundled when only a subset of exports is used.

### Pages: Static vs. Client-Side

| Route | Nature | Notes |
|---|---|---|
| `/login`, `/signup` | Static shell + client fetch | Auth form, no SSR data |
| `/dashboard` | Static shell + client fetch | Aggregated stats fetched after hydration |
| `/cases` | Static shell + client fetch | Case list fetched from API on mount |
| `/cases/[id]` (CaseDetailClient) | Static shell + deferred panel loads | 15+ lazy chunks loaded on tab selection |
| `/patients`, `/analytics` | Static shell + client fetch | — |
| `/studio` | Static shell + dynamic import | CAD Design Studio loaded lazily |
| `/platform-health`, `/settings` | Static shell + dynamic import | — |

### Impact on Load Time

The main-thread load is low for the initial shell because critical CSS is inlined in `layout.tsx` and the `__mo-launch` splash element paints synchronously before React hydration. The Manrope font is loaded via `next/font/google` which self-hosts the font file and injects a `<link rel="preload">`. The largest load-time risk is the first panel that the user opens in a case: the STL viewer (`ScanPanel`) pulls in Three.js which is a multi-hundred-kilobyte chunk even after tree-shaking.

**Unoptimized images** are the largest unaddressed frontend performance gap. Any scan screenshot, patient photo, or logo loaded via `<img>` is served at original resolution with no lazy loading guarantee beyond what the browser provides natively.

---

## 2. API Response Times

### Slow Query Logging

`/backend/src/common/slow-query.logger.ts` exports `withQueryTiming(label, fn)`. Any query wrapped with this helper that exceeds `SLOW_QUERY_THRESHOLD_MS` (default `500`, configurable via environment variable) emits a `WARN`-level log line:

```
Slow query [734ms]: clinical-report-generate-treatment-summary
```

The threshold is intentionally conservative. Queries at 200–499 ms are currently silent; they will not appear in logs even if they represent a regression.

### Request Correlation and Tracing

`CorrelationIdMiddleware` (`correlation-id.middleware.ts`) assigns an `x-correlation-id` UUID to every HTTP request. If the client sends an `x-correlation-id` or `x-request-id` header (e.g., from a mobile app session), the backend echoes it back unchanged. `TimingMiddleware` logs every request in the format:

```
[<correlationId>] METHOD /path STATUS <durationMs>ms
```

and sets an `X-Response-Time` response header. The duration is also fed to `ObservabilityService.recordRequest()` for aggregate metric tracking. Together, these allow a slow request observed in Nginx or a client log to be traced by its `x-correlation-id` through the backend logs.

### Known Heavy Queries

**Clinical report generation** (`ClinicalReportsService.generateTreatmentSummary`) executes multiple independent queries per report request. Even though the plan-dependent queries are fanned out via `Promise.all`, each leg still hits the database:

1. `verifyCase` — checks `cases` JOIN `patients` for org scoping
2. Case row — `cases LEFT JOIN patients`
3. Latest treatment plan — `treatment_plans WHERE case_id ORDER BY created_at DESC LIMIT 1`
4. Quality score — correlated subquery: `treatment_quality_scores WHERE plan_id = (SELECT id FROM treatment_plans WHERE case_id ...)`
5. IPR contacts — `ipr_plan_items WHERE treatment_plan_id`
6. Attachment count — `treatment_attachments WHERE treatment_plan_id`
7. Simulation data — `treatment_simulations WHERE plan_id`
8. INSERT into `generated_reports`

The quality score query (step 4) uses a correlated subquery that re-executes the `treatment_plans` lookup internally. Under load this can produce two sequential plan lookups per report.

**Case detail with linked resources** (`CasesService.findOne`) runs five correlated subqueries in a single SQL statement that each scan a different table (`scans`, `digital_setups`, `treatment_plans`, `clinical_analyses`, `treatment_goals`) for the latest row per `case_id`. While these are parallelised at the SQL engine level within one query, an unindexed table will cause a sequential scan.

---

## 3. Database Query Patterns

### Parameterized Queries

All service code uses `pool.query(sql, [params])` with positional `$1`, `$2`, … placeholders. There are no string-concatenated SQL queries in the reviewed service files. This prevents SQL injection and enables PostgreSQL's prepared-statement plan caching.

### Pool Management

`DatabaseModule` creates a single `pg.Pool` shared application-wide:

| Setting | Value | Source |
|---|---|---|
| `max` connections | 20 | `PG_POOL_MAX` env var, default 20 |
| `idleTimeoutMillis` | 30 000 ms | hardcoded |
| `connectionTimeoutMillis` | 5 000 ms | hardcoded |
| `statement_timeout` | 30 000 ms | set at pool creation and per-connection on `connect` event |

The 20-connection ceiling means that under high concurrency (many simultaneous report generations or scan uploads), requests will queue for a pool connection. The 5-second connection timeout will surface as `504`-class errors under sustained load.

### N+1 Risk Areas

- `CasesService.findAllByOrg` returns up to 100 rows (default `limit`) each with a patient name and assigned-user JOIN. This is a single query and is safe. However, callers that then call `findOne` for each returned case would create an N+1 pattern.
- `ClinicalReportsService.listReports` does a `SELECT *` from `generated_reports` with no column projection. If `content_markdown` is large, fetching many reports in a list inflates payload size unnecessarily.
- Any module that fetches aligner stages and then queries per-stage data in a loop (not reviewed in detail) is a candidate for N+1; `aligner_stages` has a `(plan_id, stage_number)` unique constraint and the `idx_aligner_stages_plan_id` index, which mitigates sequential scans but not round-trip count.

---

## 4. Caching

### What Is Cached

- **JWT token blacklist (Redis)**: Revoked JWTs are stored in Redis with a TTL matching the JWT expiry. `AuthService` falls back to an in-memory `Set` when `REDIS_URL` is unset. This means that on multi-instance deployments without Redis, token revocation is instance-local.
- **Login rate-limiting (Redis)**: Failed login attempt counters per IP/email are stored in Redis. Same in-memory fallback applies.

### What Is Not Cached

- **Case lists and case details**: Every `GET /cases` or `GET /cases/:id` hits the database directly. A busy clinic with many concurrent users will issue repeated identical queries.
- **Clinical reports**: Report generation always re-queries live data and inserts a new row. There is no "return cached report if inputs haven't changed" logic.
- **Notifications**: Read from the database on every poll or SSE event.
- **Feature flags**: `FeatureFlagsService` is not reviewed in depth, but no Redis or in-memory TTL cache was found in the flags module.

### SSE Streaming for Copilot

`CopilotService` uses Server-Sent Events (`StreamEvent` interface with `type: 'meta' | 'delta' | 'done' | 'error'`) to stream AI responses. This eliminates polling from the client and avoids repeated short-lived HTTP requests. The streaming approach is correct for long-running LLM completions. The copilot knowledge base uses `pgvector` with an IVFFlat approximate nearest-neighbour index (created in migration `033`), which avoids full table scans for embedding similarity search.

---

## 5. File Uploads

### Scan Upload Rate Limiting

`ScansController` applies `@Throttle({ default: { limit: 10, ttl: 60000 } })` to the scan upload endpoint: at most 10 upload requests per 60-second window per client. This is enforced by `@nestjs/throttler`.

### File Validation

`ScansService.validateScanMagicBytes` reads the first 256 bytes of every uploaded file and validates magic bytes against the declared format (STL ASCII/binary, PLY, OBJ) before accepting the file. Files that fail validation are deleted from disk immediately. This prevents format confusion attacks but adds a synchronous filesystem read on the upload path.

### Storage Pattern

Uploaded scans are written to `UPLOADS_DIR` (default `/app/uploads`) on the local container filesystem. The `file_path` column in the `scans` table stores the object storage path (a `VARCHAR(512)`). AI segmentation is triggered by forwarding the scan to `AI_ENGINE_URL` (`http://ai-engine:8000`). There is no direct S3/object-storage client in the reviewed scan upload path, suggesting uploads land on a shared volume and are referenced by path rather than pre-signed URL.

---

## 6. Recommendations (Prioritized)

### P0 — Correctness / Reliability

1. **Fix the quality-score correlated subquery** in `ClinicalReportsService.generateTreatmentSummary`. Replace:
   ```sql
   WHERE plan_id = (SELECT id FROM treatment_plans WHERE case_id=$1 ORDER BY created_at DESC LIMIT 1)
   ```
   with a join to the already-fetched `plan.id` variable to eliminate the redundant lookup.

2. **Enforce Redis in production for token blacklist and rate limiting.** The in-memory fallback makes revocation per-instance. Document `REDIS_URL` as a required production variable in `docs/ENV_VARS.md`.

### P1 — Performance

3. **Add missing composite indexes** listed in the Database Governance document (see below). Most critical: `notifications(user_id, organization_id)`, `copilot_messages(conversation_id)` (already exists as `idx_copilot_messages_conv` but verify it covers order-by `created_at`).

4. **Project specific columns in `listReports`** instead of `SELECT *`. Exclude `content_markdown` from the list view; return it only in the single-report fetch endpoint.

5. **Cache case lists with a short TTL (30–60 s) per organization.** The `findAllByOrg` query is called on every page load of the case list. A Redis cache keyed by `orgId + pagination params` with a 30-second TTL would significantly reduce database load for active clinics.

6. **Lower the slow-query threshold to 200 ms** via `SLOW_QUERY_THRESHOLD_MS=200` in staging. The current 500 ms threshold misses queries that are slow but not yet critical.

### P2 — Frontend

7. **Enable Next.js Image Optimization** if the deployment moves to a Node.js or edge runtime. In the current static-export mode this is not possible without switching `output` away from `'export'`. As an interim measure, pre-process patient photos and scan thumbnails to WebP at upload time and serve appropriately-sized variants.

8. **Enforce pagination at the API client layer.** `findAllByOrg` accepts `limit` and `offset` but the default `limit` is 100. Frontend callers should always pass an explicit limit and implement infinite scroll or pagination UI rather than requesting all cases at once.

9. **Investigate the Three.js initial chunk size.** The STL viewer is the heaviest lazy chunk. If `@react-three/drei` is pulling in unused extras, restrict the import to only the required helpers.

### P3 — Observability

10. **Add `pg_stat_statements` to the PostgreSQL configuration.** This extension accumulates per-query execution statistics (mean time, calls, total time) and surfaces the actual slowest queries without requiring application-side instrumentation of every query.

11. **Add a `/metrics` Prometheus endpoint.** `ObservabilityService.recordRequest` already tracks per-request durations; exposing these as Prometheus counters and histograms would enable alerting on p95 latency regressions.
