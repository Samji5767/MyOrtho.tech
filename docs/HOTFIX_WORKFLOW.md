# Hotfix Workflow

Procedure for delivering emergency fixes to the MyOrtho.tech production environment
outside the standard release cycle.

A hotfix is appropriate when a defect in production is causing active user harm or
data integrity risk, and the fix can be written, tested, and deployed without a full
release cycle. If the defect requires a schema migration that touches clinical tables,
or if the fix is large and touches multiple modules, use the standard release process
(`docs/RELEASE_PROCESS.md`) instead.

---

## When to use this workflow vs. a standard release

| Situation | Workflow |
|-----------|----------|
| Production is down or critical feature is broken for all users | Hotfix |
| Security vulnerability with active or imminent exploitation risk | Hotfix |
| Data corruption in progress (writes producing invalid clinical records) | Hotfix |
| Performance regression causing timeout errors under normal load | Hotfix |
| Isolated bug affecting a subset of users; workaround exists | Standard release (next cycle) |
| New feature or enhancement | Standard release |
| Schema migration touching clinical tables (`cases`, `treatment_plans`, `aligner_stages`, `patients`) | Standard release; full QA required |
| Fix requires changes across more than 3 modules | Standard release |

When in doubt: if you cannot write, test, and ship the fix in under 3 hours, use the
standard release process.

---

## Branch naming

```
hotfix/v<major>.<minor>.<patch>-<short-description>
```

Examples:
```
hotfix/v1.0.1-session-cookie-samesite
hotfix/v1.0.1-copilot-sse-nginx-flush
hotfix/v1.0.2-audit-insert-null-orgid
```

The version number in the branch name is the version the hotfix will produce.
`<short-description>` must be kebab-case and under 40 characters.

---

## Step-by-step procedure

### Step 1 — Confirm and document the defect

1. Reproduce the defect in a local environment or against staging. Do not guess.
2. Identify the exact file(s) and function(s) involved.
3. Open an internal incident record (chat message pinned in the ops channel is sufficient for a hotfix) with:
   - Defect description
   - Impact (which users/roles/orgs are affected)
   - Reproducibility steps
   - Root cause hypothesis

### Step 2 — Create the hotfix branch from the production tag

Always branch from the currently deployed production tag, not from `main` (which may contain unreleased work):

```bash
# Identify the currently deployed version
curl -sf https://api.myortho.tech/api/version | jq .app
# e.g.: "1.0.0-beta.1"

git fetch --tags
git checkout -b hotfix/v1.0.1-<short-description> v1.0.0-beta.1
```

### Step 3 — Write the fix

- Keep the diff as small as possible. Fix exactly the defect; do not refactor or add features.
- If the fix requires a database migration, use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, or `DO $$ BEGIN ... EXCEPTION WHEN duplicate_column THEN NULL; END $$` guards so the migration is safe to re-apply.
- Add a migration file only if absolutely necessary. Prefer application-layer fixes over schema changes for hotfixes.

### Step 4 — Testing requirements

Hotfixes have a reduced but non-zero test bar. All of the following must pass before deployment:

1. TypeScript compilation with zero errors:
   ```bash
   cd /home/user/MyOrtho.tech/backend && npx tsc --noEmit
   cd /home/user/MyOrtho.tech/frontend && npx tsc --noEmit
   ```

2. Unit tests for the affected module(s):
   ```bash
   cd /home/user/MyOrtho.tech/backend && npm test -- --testPathPattern=<affected-module>
   ```
   If no unit test covers the defect, write a regression test for it before shipping.

3. Manual smoke test of the specific defect: reproduce the failure, apply the fix, confirm the failure is resolved.

4. Manual smoke test of the happy path for the affected feature (e.g., if fixing auth: confirm login, session cookie, and logout all work).

5. Run `GET /health/ready` on a local Docker Compose stack with the fix applied.

> Tests 1–5 are the minimum. Do not skip any of them, even under time pressure.
> A broken hotfix that ships to production is worse than the original defect.

### Step 5 — Peer review

Even under urgency, all hotfix code must be reviewed by at least one other engineer before merging. If no second engineer is available:

- Post the diff in the ops channel and wait at least 15 minutes for objections
- Document in the incident record that a solo review was necessary and why

### Step 6 — Version bump and changelog

6. Increment the patch version:
   - `backend/package.json`: `"version": "1.0.1"`
   - `frontend/package.json`: `"version": "1.0.1"`
   - `backend/src/common/version.ts`: `APP_VERSION = '1.0.1'`

7. Add a `[1.0.1] — YYYY-MM-DD` section to `docs/CHANGELOG.md` with a `Fixed` entry describing the defect and the fix in one or two sentences. Note the affected service (backend / frontend / AI).

8. Commit:
   ```bash
   git add backend/package.json frontend/package.json \
           backend/src/common/version.ts docs/CHANGELOG.md \
           <changed-source-files>
   git commit -m "fix: <short description of defect> (v1.0.1)"
   ```

### Step 7 — Tag and deploy

9. Create an annotated tag:
   ```bash
   git tag -a v1.0.1 -m "Hotfix v1.0.1 — <short description>"
   ```

10. Deploy following steps 17–29 of `docs/RELEASE_PROCESS.md` (Phase 4 and Phase 5).

11. Push branch and tag to origin:
    ```bash
    git push origin hotfix/v1.0.1-<short-description>
    git push origin v1.0.1
    ```

### Step 8 — Merge back to main and develop

A hotfix that ships to production **must** be merged back to `main` and to any active
development branch, or the fix will be lost when the next release is deployed.

12. Merge to `main`:
    ```bash
    git checkout main
    git merge --no-ff hotfix/v1.0.1-<short-description> -m "Merge hotfix/v1.0.1-<short-description> into main"
    git push origin main
    ```

13. Merge to the active development branch (e.g., `develop` or a release branch):
    ```bash
    git checkout develop
    git merge --no-ff hotfix/v1.0.1-<short-description> -m "Merge hotfix/v1.0.1-<short-description> into develop"
    git push origin develop
    ```

14. Resolve any merge conflicts in `develop` carefully. The hotfix must win for the
    defective code path; the development branch additions must win everywhere else.

15. Delete the hotfix branch after both merges are confirmed:
    ```bash
    git branch -d hotfix/v1.0.1-<short-description>
    git push origin --delete hotfix/v1.0.1-<short-description>
    ```

---

## When a hotfix requires a full release cycle instead

Escalate to the standard release process if any of the following are true:

- The fix requires a schema migration that renames, drops, or restructures any column in `cases`, `treatment_plans`, `aligner_stages`, `patients`, `scans`, `segmentation_results`, or `audit_events`
- The fix touches more than 3 NestJS modules
- The fix requires changes to the `auth` module that could affect session validity for all active users (e.g., changing the JWT payload structure or the session cookie name)
- The fix cannot be tested without a staging environment and staging is unavailable
- TypeScript errors in unrelated modules are uncovered during the `tsc --noEmit` check — fix those first before shipping anything
- The engineer writing the fix is the only person who understands the affected module and no reviewer can be reached within 2 hours

In these cases: rollback the current deployment (`docs/ROLLBACK_CHECKLIST.md`) to restore the previous stable version, then fix forward through the standard release process.

---

## Security hotfixes

Security-driven hotfixes follow the same procedure with these additions:

- Do not describe the vulnerability in the commit message or changelog until a CVE or coordinated disclosure window has passed. Use `fix: security patch (v1.0.1)` in the commit and a generic `Fixed: security vulnerability (details in security advisory)` in the changelog.
- Notify the security contact in `SECURITY.md` before deploying.
- After deployment, rotate any secrets or tokens that may have been exposed. Update `docs/ENV_VARS.md` with the rotation record.
- Publish a security advisory on GitHub after the fix is live and affected operators have had time to update.
