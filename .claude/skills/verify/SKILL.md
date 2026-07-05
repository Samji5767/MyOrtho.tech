# Verify skill — MyOrtho.tech backend + frontend

## Stack

- Backend: NestJS + TypeScript, `backend/`
- Frontend: Next.js + TypeScript, `frontend/`
- Database: PostgreSQL 16 (cluster `main`, port 5432)

## Setup (one-time per session)

```bash
# 1. Start postgres if not running
pg_ctlcluster 16 main start 2>/dev/null || true

# 2. Ensure the myortho_dev database exists and apply all migrations
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='myortho_dev'" | grep -q 1 \
  || createdb -U postgres myortho_dev
psql -U postgres myortho_dev -f /home/user/MyOrtho.tech/database/schema.sql
for f in /home/user/MyOrtho.tech/database/migrations/*.sql; do
  psql -U postgres myortho_dev -f "$f" 2>&1 | grep -v 'already exists' | grep -v '^$'
done

# 3. Build backend
cd /home/user/MyOrtho.tech/backend
npm run build            # outputs to dist/src/

# 4. Start backend (background)
DATABASE_URL="postgresql://postgres@localhost:5432/myortho_dev" \
JWT_SECRET=dev-secret \
PORT=4001 \
node dist/src/main.js &
BACKEND_PID=$!
sleep 3   # wait for NestJS bootstrap

# 5. Confirm it's up
curl -s http://localhost:4001/health
```

## Key API surfaces to drive

All routes need `Authorization: Bearer <token>`. Get a token:

```bash
TOKEN=$(curl -s -X POST http://localhost:4001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@myortho.test","password":"password123"}' \
  | jq -r .accessToken)
```

### Create case (existing patient)
```bash
curl -s -X POST http://localhost:4001/api/cases \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"patientId":"<existing-patient-id>","chiefComplaint":"spacing"}' | jq .
```

### Create case (new patient)
```bash
curl -s -X POST http://localhost:4001/api/cases/with-new-patient \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"patient":{"firstName":"Jane","lastName":"Doe"},"chiefComplaint":"crowding"}' | jq .
```

### Archive a case
```bash
curl -s -X POST http://localhost:4001/api/cases/<case-id>/transition \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"toStatus":"archived"}' | jq .
```

### Confirm organization_id persisted
```bash
psql -U postgres myortho_dev -c "SELECT id, organization_id, status FROM cases ORDER BY created_at DESC LIMIT 5;"
```

## TypeScript build checks

```bash
# Backend
cd /home/user/MyOrtho.tech/backend && npx tsc --noEmit

# Frontend
cd /home/user/MyOrtho.tech/frontend && npx tsc --noEmit
```

## Gotchas

- `dist/src/` is the compiled output path (NestJS puts it one level deep)
- `case_status` ENUM: migration 044 adds the values the workflow engine needs; without it, archive transitions fail with "invalid input value for enum"
- AuthModule is `@Global()` — if NestJS fails to resolve `AuthGuard` at startup, check that `auth.module.ts` has the `@Global()` decorator
- `BillingModule` explicitly imports `AuthModule` as documentation even though it isn't required by the global flag
