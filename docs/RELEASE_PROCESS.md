# Release Process

Production release procedure for MyOrtho.tech.
Stack: NestJS backend · Next.js frontend · PostgreSQL · Docker Compose on Hostinger VPS.

> This document covers the standard release cycle (beta → GA, minor, patch).
> For emergency hotfixes, follow `docs/HOTFIX_WORKFLOW.md` instead.

---

## Release types

| Type | Version example | When |
|------|----------------|------|
| GA / Major | `1.0.0` | Breaking changes or milestone release |
| Minor | `1.1.0` | New features, no breaking API changes |
| Patch | `1.0.1` | Bug fixes only |
| Hotfix | `1.0.1` (from hotfix branch) | Critical production defects; see `docs/HOTFIX_WORKFLOW.md` |

---

## Phase 1 — Pre-release checks (run locally, not on VPS)

1. Pull the latest commit from `main` (or the release branch) and confirm CI is green.

2. Run the TypeScript compiler across both packages with zero errors allowed:
   ```bash
   cd /home/user/MyOrtho.tech/backend && npx tsc --noEmit
   cd /home/user/MyOrtho.tech/frontend && npx tsc --noEmit
   ```

3. Run the backend test suite; release is blocked if any test fails:
   ```bash
   cd /home/user/MyOrtho.tech/backend && npm test
   ```

4. Run the frontend test suite:
   ```bash
   cd /home/user/MyOrtho.tech/frontend && npm test
   ```

5. Verify that every pending database migration file in `database/migrations/` compiles without error against a local PostgreSQL instance:
   ```bash
   DATABASE_URL=postgresql://myortho_admin:dev@localhost:5432/myortho_test \
     ./database/migrate.sh
   ```
   Confirm the script exits 0 and prints `All migrations applied successfully.`

6. Run `GET /health/ready` against the staging environment and confirm the response is `{ "ready": true, "checks": { "databaseUrlSet": true, "databaseConnected": true } }`.

7. Run `GET /api/version` against staging and confirm `app` matches the version being released and `environment` is the correct target.

8. Review `docs/CHANGELOG.md` and confirm all entries under `[Unreleased]` are complete and accurate.

9. Verify that no placeholder secrets remain in `.env`:
   ```bash
   grep -r 'CHANGE_ME_BEFORE_PRODUCTION\|change_me\|your-secret' /home/user/MyOrtho.tech/.env 2>/dev/null \
     && echo "ERROR: placeholder secrets found" && exit 1 || echo "OK"
   ```

10. Confirm the `ENCRYPTION_KEY` and `JWT_SECRET` in production `.env` are each at least 32 characters:
    ```bash
    awk -F= '/^ENCRYPTION_KEY=/{print length($2), "ENCRYPTION_KEY"}
             /^JWT_SECRET=/{print length($2), "JWT_SECRET"}' /opt/myortho/.env
    ```
    Both must report ≥ 32.

---

## Phase 2 — Version bump

11. Update the version string in both `package.json` files (backend and frontend) to the new version number. The backend's `src/common/version.ts` reads `APP_VERSION` as a hard-coded constant — update it too:
    ```
    /home/user/MyOrtho.tech/backend/package.json          → "version": "X.Y.Z"
    /home/user/MyOrtho.tech/frontend/package.json         → "version": "X.Y.Z"
    /home/user/MyOrtho.tech/backend/src/common/version.ts → APP_VERSION = 'X.Y.Z'
    ```

12. Move the `[Unreleased]` section in `docs/CHANGELOG.md` to `[X.Y.Z] — YYYY-MM-DD` and add a new empty `[Unreleased]` section at the top.

13. Commit the version bump and changelog update:
    ```bash
    git add backend/package.json frontend/package.json \
            backend/src/common/version.ts docs/CHANGELOG.md
    git commit -m "chore: release vX.Y.Z"
    ```

---

## Phase 3 — Git tag

14. Create an annotated tag. The tag message should include the one-line summary of the release:
    ```bash
    git tag -a vX.Y.Z -m "Release vX.Y.Z — <one-line summary>"
    ```

15. Push the commit and tag:
    ```bash
    git push origin main
    git push origin vX.Y.Z
    ```

16. Confirm the tag appears on the remote:
    ```bash
    git ls-remote --tags origin | grep vX.Y.Z
    ```

---

## Phase 4 — Deployment (order is mandatory)

> All steps run on the production VPS at `/opt/myortho` unless otherwise noted.
> Deployments during active clinical hours (08:00–18:00 local clinic time) require
> explicit sign-off from the operations lead.

17. Pull the tagged release on the VPS:
    ```bash
    cd /opt/myortho
    git fetch --tags
    git checkout vX.Y.Z
    ```

18. **Database migrations first — before any application container is updated.**
    Run the migration container and wait for it to exit 0:
    ```bash
    docker compose run --rm migrate
    ```
    If the migrate container exits non-zero, stop here. Do not proceed to step 19.
    Investigate the failing migration file; apply a fix or roll back the migration
    file change before re-running.

19. Build the updated backend image:
    ```bash
    docker compose build --no-cache backend
    ```

20. Roll the backend container with zero-downtime restart:
    ```bash
    docker compose up -d --no-deps backend
    ```
    Wait for the backend to report healthy:
    ```bash
    until curl -sf https://api.myortho.tech/health/ready; do sleep 3; done
    echo "Backend ready"
    ```

21. Build and roll the frontend container:
    ```bash
    docker compose build --no-cache frontend
    docker compose up -d --no-deps frontend
    ```

22. If the AI engine (`myortho-ai`) has changes in this release:
    ```bash
    docker compose build --no-cache ai
    docker compose up -d --no-deps ai
    ```

---

## Phase 5 — Post-deployment smoke tests

23. Liveness check:
    ```bash
    curl -sf https://api.myortho.tech/health | jq .status
    # expected: "ok"
    ```

24. Readiness check:
    ```bash
    curl -sf https://api.myortho.tech/health/ready | jq .ready
    # expected: true
    ```

25. Version endpoint confirms the new version is live:
    ```bash
    curl -sf https://api.myortho.tech/api/version | jq .app
    # expected: "X.Y.Z"
    ```

26. Authentication smoke test — POST to `https://api.myortho.tech/api/auth/login` with a known test account and confirm a session cookie is set in the response.

27. Frontend loads:
    ```bash
    curl -o /dev/null -s -w "%{http_code}" https://myortho.tech
    # expected: 200
    ```

28. If notifications are included in this release: trigger a test notification via `POST /api/notifications` (internal endpoint) and confirm delivery in the notification list.

29. Confirm Docker Compose reports all containers healthy:
    ```bash
    docker compose ps
    ```
    All containers must show `Up (healthy)` or `Up`. Any container in `Restarting` state is a blocker.

---

## Phase 6 — Post-release

30. Update the `[1.0.0-beta.1]` → `[X.Y.Z]` comparison link at the bottom of `docs/CHANGELOG.md` to point to the correct GitHub compare URL.

31. Tag the release on GitHub with the changelog section as the release body.

32. Notify stakeholders (clinical director, lab manager, operations lead) via the internal messaging channel that the release is live.

33. Monitor `docker compose logs -f backend` for the first 15 minutes post-release. Watch for repeated 5xx errors or panics. If error rate rises above baseline, initiate rollback per `docs/ROLLBACK_CHECKLIST.md`.

---

## Rollback trigger criteria

Immediately begin rollback (see `docs/ROLLBACK_CHECKLIST.md`) if any of the following occur within 30 minutes of deployment:

- `GET /health/ready` returns non-200 for more than 60 seconds
- Backend container restarts more than twice in 5 minutes
- 5xx error rate exceeds 1% of requests (visible in `docker compose logs backend`)
- Any patient PHI appears in application logs (data-leak indicator)
- Database migration reports a constraint violation or data inconsistency
- `GET /api/version` returns the previous version (container did not update)
