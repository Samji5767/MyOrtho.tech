# Rollback Checklist

Procedure for rolling back a failed production deployment of MyOrtho.tech.

Stack: Docker Compose on Hostinger VPS · NestJS backend · Next.js frontend · PostgreSQL.

> Rollback is a last resort. If the defect is isolated and a fix is straightforward,
> a hotfix deployment (see `docs/HOTFIX_WORKFLOW.md`) is preferable because it avoids
> the data-consistency risks described in the database section below.

---

## Decision criteria — rollback vs. hotfix

Roll back when **any** of the following are true:

- `GET /health/ready` returns non-200 for more than 60 seconds and the cause is unknown
- Backend container is in a crash loop (restarts > 2 in 5 minutes)
- A database migration applied during the release caused a constraint violation, data loss, or schema inconsistency
- 5xx error rate exceeds 1% of requests and the root cause cannot be identified within 15 minutes
- Any patient PHI is visible in application logs
- `GET /api/version` shows the new version but the app is functionally broken and no fix is obvious

Choose a hotfix instead when:

- The defect is a logic error in application code with no schema change involved
- You can write and test a fix in under 60 minutes
- The previous version had a known security vulnerability that must not be restored

When in doubt, roll back first to restore service, then fix forward.

---

## Pre-rollback: capture diagnostic state

Before touching anything, preserve evidence for post-mortem:

1. Capture current container logs (last 500 lines per service):
   ```bash
   cd /opt/myortho
   docker compose logs --tail=500 backend  > /tmp/rollback-backend-$(date +%s).log
   docker compose logs --tail=500 frontend > /tmp/rollback-frontend-$(date +%s).log
   docker compose logs --tail=500 ai       > /tmp/rollback-ai-$(date +%s).log
   ```

2. Record the current (broken) image digests:
   ```bash
   docker compose images
   ```

3. Note the exact failing migration file if a database migration is suspected:
   ```bash
   docker compose logs migrate 2>/dev/null | tail -50
   ```

4. Note the current version reported by the API:
   ```bash
   curl -sf https://api.myortho.tech/api/version | jq .
   ```

---

## Database rollback — read this section before proceeding

**PostgreSQL migrations in this project are intentionally additive.** The migration
runner (`database/migrate.sh`) applies SQL files sequentially using `psql -v ON_ERROR_STOP=1`.
Files use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and `DO $$` guards
to be safe to re-run.

### What can be reversed safely

- Adding a new column with a default value (remove the column or leave it — it does not break the previous application version reading the table)
- Adding a new index (drop it; no data impact)
- Adding a new table (drop it if empty; rollback the application)

### What cannot be reversed safely

- Renaming a column or table that the previous application version references
- Dropping a column that the previous version writes to
- Adding a `NOT NULL` constraint to a column that existing rows may violate
- Any migration that backfills data (the backfilled state may be depended upon by other tables)

### Data risk assessment (required before database rollback)

Before reversing any schema change, answer:

1. Did the migration add, rename, or drop any column that the previous application version accesses?
2. Did the migration insert or update rows in a table used by clinical workflows (`treatment_plans`, `aligner_stages`, `cases`, `scans`, `patients`)?
3. Has any new data been written to the new schema since the release (i.e., can any rows be lost)?

If the answer to question 3 is "yes", **do not drop or alter the schema**. Roll back only the application containers and leave the schema in place. The previous application version will ignore columns it does not reference, and new tables will remain dormant until the application is re-deployed.

### How to reverse a safe schema change

```bash
# Connect to the production database
psql $DATABASE_URL

-- Example: reverse an added column
ALTER TABLE <table_name> DROP COLUMN IF EXISTS <column_name>;

-- Example: reverse an added table (only if confirmed empty)
DROP TABLE IF EXISTS <table_name>;

-- Example: reverse an added index
DROP INDEX IF EXISTS <index_name>;
```

Log every DDL statement executed during rollback to the post-mortem document.

---

## Application rollback procedure

### Step 1 — Identify the previous stable image tag or git ref

```bash
cd /opt/myortho
git log --oneline -5
# or
docker images | grep myortho
```

Note the previous git tag (e.g., `v1.0.0-beta.1`) or the Docker image digest from
the pre-rollback capture.

### Step 2 — Check out the previous release tag

```bash
cd /opt/myortho
git checkout v<previous-version>
```

### Step 3 — Roll back the backend (first)

```bash
docker compose build --no-cache backend
docker compose up -d --no-deps backend
```

Wait for readiness:
```bash
until curl -sf https://api.myortho.tech/health/ready; do sleep 3; done
echo "Backend ready"
```

If the backend does not become ready within 2 minutes, check logs:
```bash
docker compose logs --tail=100 backend
```

### Step 4 — Roll back the frontend

```bash
docker compose build --no-cache frontend
docker compose up -d --no-deps frontend
```

Verify:
```bash
curl -o /dev/null -s -w "%{http_code}" https://myortho.tech
# expected: 200
```

### Step 5 — Roll back the AI engine (if it was updated in the failed release)

```bash
docker compose build --no-cache ai
docker compose up -d --no-deps ai
```

### Step 6 — Confirm all containers are running

```bash
docker compose ps
```

All containers must show `Up (healthy)` or `Up`.

---

## Post-rollback validation

Complete all checks before declaring the rollback successful:

- [ ] `GET https://api.myortho.tech/health` → `{ "status": "ok" }`
- [ ] `GET https://api.myortho.tech/health/ready` → `{ "ready": true }`
- [ ] `GET https://api.myortho.tech/api/version` → `app` field shows previous version (e.g., `1.0.0-beta.1`)
- [ ] `GET https://myortho.tech` → HTTP 200
- [ ] Successful login with a test account (session cookie set, no 4xx/5xx)
- [ ] `GET /api/cases` returns data for a known organization (not 500)
- [ ] `GET /api/notifications/unread-count` returns a numeric value (not 500)
- [ ] `docker compose ps` — zero containers in `Restarting` state
- [ ] Application logs show no repeated 5xx errors for 5 minutes post-rollback

---

## Communication template

Send the following to the operations lead, clinical director, and lab manager immediately when a rollback is initiated, and again when it is complete.

**Rollback initiated:**

> Subject: [MyOrtho] Production rollback in progress — vX.Y.Z → vA.B.C
>
> We detected an issue with the vX.Y.Z deployment at [TIME UTC]. We are rolling back
> to vA.B.C. The platform may be partially unavailable for the next [estimated minutes].
> No patient data has been lost. We will send an update when service is restored.
>
> Affected services: [backend / frontend / AI engine]
> Root cause (preliminary): [brief description or "under investigation"]

**Rollback complete:**

> Subject: [MyOrtho] Rollback complete — platform restored to vA.B.C
>
> The rollback to vA.B.C is complete as of [TIME UTC]. All health checks are passing.
> The platform is fully operational. We will investigate the root cause and publish
> a post-mortem within 48 hours.

---

## Post-mortem requirements

A post-mortem document must be created within 48 hours of any production rollback. It must include:

- Timeline of events (deploy start, first symptom, rollback decision, rollback complete)
- Root cause (verified, not speculative)
- Impact: which users/orgs were affected, duration, any data implications
- Which pre-release checks in `docs/RELEASE_PROCESS.md` would have caught this (and why they did not)
- Action items to prevent recurrence, each with an owner and due date

Store the post-mortem in `docs/post-mortems/YYYY-MM-DD-vX.Y.Z.md`.
