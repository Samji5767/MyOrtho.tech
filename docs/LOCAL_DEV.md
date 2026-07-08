# Local Development Setup

## Prerequisites

- **Node.js** 20+
- **PostgreSQL** 16
- **npm** 10+
- **Git**

## 1. Clone & Install

```bash
git clone https://github.com/samji5767/myortho.tech.git
cd MyOrtho.tech
```

## 2. Database Setup

```bash
# Create database
createdb -U postgres myortho_dev

# Apply schema
psql -U postgres myortho_dev -f database/schema.sql

# Apply migrations (idempotent)
for f in database/migrations/*.sql; do
  psql -U postgres myortho_dev -f "$f" 2>&1 | grep -v 'already exists'
done
```

## 3. Backend

```bash
cd backend
npm install

# Set environment variables
export DATABASE_URL="postgresql://postgres@localhost:5432/myortho_dev"
export JWT_SECRET="dev-secret-change-in-production"
export PORT=4001

# Build and start
npm run build
node dist/src/main.js
# Or in dev mode:
npm run start:dev
```

The backend starts at http://localhost:4001. Verify: `curl http://localhost:4001/health`

## 4. Frontend

```bash
cd frontend
npm install

# Set environment variables
echo 'NEXT_PUBLIC_API_URL=http://localhost:4001' > .env.local

npm run dev
```

The frontend starts at http://localhost:3000.

## 5. Running Tests

```bash
# Backend unit tests
cd backend && npm test

# Backend E2E tests (requires running database)
cd backend && DATABASE_URL="postgresql://postgres@localhost:5432/myortho_dev" npm run test:e2e

# Frontend type check
cd frontend && npx tsc --noEmit

# Backend type check
cd backend && npx tsc --noEmit
```

## 6. Seed Data

A seed admin account is created by the schema: `admin@myortho.test` / `password123`.
