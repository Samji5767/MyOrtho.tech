# MyOrtho.tech

An orthodontic digital treatment planning platform: 3D intraoral scan upload, AI-assisted tooth segmentation, treatment plan authoring, clinician approval, and manufacturing export — built for clinics running their own aligner workflow.

> **Status:** Pre-production. Review [Security & compliance](#security--compliance) before handling real patient data.

---

## Architecture

Four Docker services share a single host:

```
Browser
  │ HTTPS
  ▼
Frontend (Next.js 14)          :3005 → :3000
  │ REST API
  ▼
Backend (NestJS 10)            :4000
  │ HTTP (internal)       │ pg + ioredis
  ▼                       ▼
AI Engine (FastAPI)      PostgreSQL 15   Redis 7
  :8000                  :5432           :6379
```

| Service    | Stack                                  | Internal port |
|------------|----------------------------------------|---------------|
| `frontend` | Next.js 14, React 18, Three.js/R3F, Tailwind | 3000 |
| `backend`  | NestJS 10, pg (raw Pool), jsonwebtoken | 4000 |
| `ai-engine`| FastAPI, PyTorch, MONAI, trimesh       | 8000 |
| `database` | PostgreSQL 15-alpine + Redis 7-alpine  | 5432 / 6379 |

---

## Core workflows

1. **Authentication** — JWT login, email verification, password reset
2. **Organisation** — multi-tenant isolation; admin bootstrap on first start
3. **Users & profiles** — roles: `super_admin`, `admin`, `doctor`, `staff`
4. **Patients** — registration, demographics, case assignment
5. **Cases** — full lifecycle from `intake` → `scan_ready` → `treatment_planning` → `doctor_approved` → `manufacturing` → `delivered` → `archived`
6. **STL Upload** — STL / OBJ / PLY intraoral scan upload (≤250 MB per file)
7. **AI Segmentation** — per-scan tooth-segmentation job queue; polled via REST
8. **3D Viewer** — React Three Fiber STL viewer with FDI tooth labelling
9. **Treatment Planning** — aligner stage authoring, per-tooth movement records
10. **Approval** — doctor approval gate before any export is possible
11. **Manufacturing Export** — validated STL/ZIP export of stage models and aligner shells with per-shell mesh-validation reports
12. **Settings** — profile management, theme, keyboard shortcuts, feature flags

---

## Quick start

**Prerequisites:** Docker ≥ 24, Docker Compose V2.

```bash
# 1. Copy the environment template and fill in secrets
cp .env.example .env

# 2. Required secrets — edit these in .env before continuing:
#   JWT_SECRET              (openssl rand -hex 32)
#   ENCRYPTION_KEY          (openssl rand -hex 32)
#   INTERNAL_API_SECRET     (openssl rand -hex 32)
#   POSTGRES_PASSWORD
#   MYORTHO_ADMIN_EMAIL / MYORTHO_ADMIN_PASSWORD

# 3. Bring the full stack up (builds images + runs migrations)
docker compose up -d --build

# 4. Verify all services are healthy
docker compose ps
docker compose logs backend --tail 20

# 5. Open the app
open http://localhost:3005
```

Health endpoints:
- Frontend: `http://localhost:3005/`
- Backend: `http://localhost:4000/health`
- AI Engine: `http://localhost:8000/health`

---

## Local development (without Docker)

### Database

```bash
# Start PostgreSQL 15 locally (or use a Docker container)
pg_ctlcluster 16 main start

# Create database and apply schema + migrations
createdb -U postgres myortho_dev
psql -U postgres myortho_dev -f database/schema.sql
for f in database/migrations/*.sql; do
  psql -U postgres myortho_dev -f "$f" 2>&1 | grep -v 'already exists'
done
```

### Backend

```bash
cd backend
npm install
DATABASE_URL="postgresql://postgres@localhost:5432/myortho_dev" \
JWT_SECRET=dev-secret \
PORT=4001 \
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:4001 \
npm run dev        # listens on http://localhost:3000
```

### AI Engine

```bash
cd ai-engine
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

---

## Database migrations

Migrations live in `database/migrations/` (numbered `000` to `074`). The `migrate` Docker service applies them in order on every `docker compose up`. Every migration uses `IF NOT EXISTS` / `DO $$` guards and is safe to re-run.

To apply migrations manually:

```bash
for f in database/migrations/*.sql; do
  psql "$DATABASE_URL" -f "$f" 2>&1 | grep -v 'already exists'
done
```

---

## Production deployment (VPS)

### Recommended specs
- 4 vCPU, 8 GB RAM minimum
- 50 GB SSD (database + upload storage)
- Ubuntu 22.04 LTS

### Steps

```bash
# 1. Install Docker + Compose on the VPS
curl -fsSL https://get.docker.com | sh

# 2. Clone the repo and configure environment
git clone https://github.com/samji5767/myortho.tech.git
cd myortho.tech
cp .env.example .env
# --- edit .env: set all secrets, NODE_ENV=production, real SMTP, real APP_URL ---

# 3. Build and start
docker compose up -d --build

# 4. Verify health
curl -sf http://localhost:4000/health
curl -sf http://localhost:8000/health

# 5. Serve with a reverse proxy (nginx / Caddy) on port 80/443
# Point port 3005 → public HTTPS for the frontend
# Point port 4000 → public HTTPS for the backend API (or proxy via frontend)
```

### SMTP (required for email verification)

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, and `APP_URL` in `.env`.
Standard providers: AWS SES, Mailgun, Postmark, Brevo. Leave `SMTP_HOST` blank in dev to
log emails to the console.

### Backup

```bash
# Database backup
docker exec myortho-db pg_dump -U myortho_admin myortho_tech | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup-YYYYMMDD.sql.gz | docker exec -i myortho-db psql -U myortho_admin myortho_tech

# Upload volume backup (STL files)
docker run --rm -v myortho.tech_uploads_data:/data -v $(pwd):/backup \
  alpine tar czf /backup/uploads-$(date +%Y%m%d).tar.gz /data
```

---

## AI Segmentation

The AI engine runs a FastAPI server. Tooth segmentation is a real pipeline:
STL upload → segmentation job queued → MONAI UNet inference → FDI tooth IDs returned.

**External AI providers are currently blocked:**
- **TGN (ToothGroupNetwork):** CC BY-NC-ND 4.0 training data prohibits commercial use. Keep `TGN_ENABLED=false` until a commercial license is obtained.
- **MeshSegNet:** Pretrained checkpoint not obtained; redistribution rights unconfirmed. Keep `MESHSEGNET_ENABLED=false` until checkpoint is obtained in writing.

Set `SEGMENTATION_PROVIDER=MANUAL` (the default) to route all segmentation jobs to manual clinical review. This is the correct production setting until a licensed AI engine is available.

---

## TypeScript & build checks

```bash
# Backend
cd backend && npx tsc --noEmit

# Frontend
cd frontend && npx tsc --noEmit && npm run build
```

---

## Security & compliance

This platform processes Protected Health Information (PHI). Before deploying:

- All secrets must be strong random values (`openssl rand -hex 32`) — never the defaults from `.env.example`
- Use HTTPS in production — never serve the app over plain HTTP
- Database and Redis are not exposed to the host by default — keep `expose` (not `ports`) in docker-compose.yml
- The AI engine is only reachable from the backend (internal network); the frontend never calls it directly
- Row-level security policies are applied via migrations — verify with `psql` after deployment
- `SEGMENTATION_FALLBACK_ENABLED` and `TREATMENT_PLAN_STAGE_FALLBACK_ENABLED` must both be `false` in production
- All AI segmentation output requires clinician review before any clinical decision

---

## Repository layout

```
.
├── frontend/          Next.js 14 web client
├── backend/           NestJS 10 API
├── ai-engine/         FastAPI ML service
├── database/
│   ├── schema.sql     Foundation tables
│   ├── migrations/    Numbered SQL migrations (000–074)
│   ├── migrate.sh     Applies migrations in order
│   └── seed-demo.sql  Optional demo data
├── deployment/        Nginx / reverse-proxy config
├── docker-compose.yml Full-stack orchestration
├── Makefile           Common dev commands
└── .env.example       Environment template
```
