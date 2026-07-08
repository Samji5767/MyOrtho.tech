# Release Notes — MyOrtho.tech v1.0.0-rc2

**Release Date:** 2026-07-08
**Type:** Release Candidate 2
**Target GA:** v1.0.0

## What's New in RC2

This release resolves all P0 and P1 blockers identified during the v1.0.0 Release Candidate 1 audit.

### Security Improvements
- **PHI Encryption Complete**: Date of birth is now encrypted at rest alongside name, gender, and clinical notes — all patient PHI is now protected with AES-256-GCM
- **Startup Enforcement**: Server refuses to start without a valid ENCRYPTION_KEY — eliminates silent PHI exposure in misconfigured environments
- **Photo Access Control**: Clinical photos now require role-based authorization (cases:read/write permission) — previously any authenticated user could access PHI photos
- **Audit Trail**: Photo creation and deletion events are now logged to the audit trail

### Reliability Improvements
- **Database Installation**: Migration 021 no longer fails on fresh installations — all index creation is now guarded against missing tables
- **Deterministic IDs**: Event bus and collaboration IDs now use UUID — eliminates collision risk from narrow random number ranges
- **Feature Flags**: Organization-level flag evaluation is now deterministic — same organization always receives the same rollout decision

### Clinical Safety
- Clinical analysis confirmed to use validated orthodontic formulas (Bolton 1958, Moyers 1988) — no fabricated measurements found anywhere in the codebase
- All AI outputs continue to include mandatory clinical disclaimer

## Upgrading from RC1 / beta.1

### Required Action
Set `ENCRYPTION_KEY` environment variable before deploying RC2. The server will not start without it.

The key must be either:
- A 64-character hex string (32 bytes), or
- Any string of 32+ characters

### Database
Run all migrations in order. Migration 055 adds `dob_encrypted TEXT` to the patients table — it is idempotent and safe to re-run.

### API
No breaking changes to API contracts in RC2. The error response shape (`{ statusCode, errorCode, message, requestId, timestamp }`) introduced in the SDLC sprint remains unchanged.

## Known Limitations

- Unit test coverage for service layer is minimal — planned for v1.1
- `npm audit` should be run before GA deployment
- Retroactive encryption of existing DOB rows requires a one-time operator-run script

## Production Readiness Score: 70/100

See `docs/GA_BLOCKER_RESOLUTION_REPORT.md` for the full scoring breakdown.
