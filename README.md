# MyOrtho.tech

An end-to-end digital orthodontics & restorative dentistry platform: 3D intraoral
scan processing, AI-assisted treatment planning, aligner generation, and in-house
manufacturing — built for clinics that want to design and produce appliances under
one roof.

> **Status:** Pre-production. This repository contains the full multi-service
> stack. See [Deployment](#deployment) and [`SECURITY.md`](SECURITY.md) before
> handling real patient data.

---

## Architecture

The platform is composed of four independently deployable services plus a shared
database.

```
                         ┌──────────────────────────┐
                         │   frontend (Next.js 14)   │  :3000
                         │  3D STL viewer · clinic UI │
                         │  Capacitor → iOS app       │
                         └────────────┬───────────────┘
                                      │ REST / WebSocket
                         ┌────────────▼───────────────┐
                         │    backend (NestJS 10)      │  :4000
                         │  cases · printers · billing │
                         │  manufacturing · scanner    │
                         │  collaboration · webhooks   │
                         └──────┬───────────────┬──────┘
                                │               │
              ┌─────────────────▼──┐      ┌─────▼────────────────┐
              │ ai-engine (FastAPI)│:8000 │ PostgreSQL 15        │:5432
              │ PyTorch · MONAI     │      │ + Redis 7 cache      │:6379
              │ segmentation ·      │      └──────────────────────┘
              │ landmarks · aligner │
              │ implant planning    │
              └─────────────────────┘
```

| Service     | Stack                        | Port | Folder        |
|-------------|------------------------------|------|---------------|
| Frontend    | Next.js 14, React 18, R3F, Tailwind, Supabase | 3000 | `frontend/`   |
| Backend     | NestJS 10, Socket.IO, OpenTelemetry           | 4000 | `backend/`    |
| AI Engine   | FastAPI, PyTorch, MONAI, trimesh               | 8000 | `ai-engine/`  |
| Database    | PostgreSQL 15 + Redis 7                        | 5432 | `database/`   |
| Deployment  | Docker Compose, Kubernetes                     | —    | `deployment/` |

---

## Quick start

**Prerequisites:** Docker + Docker Compose, and (optionally) Node 20+ and Python
3.11+ for running services natively. A CUDA-capable GPU is recommended for the AI
engine but not required for the rest of the stack.

```bash
# 1. Create your environment file from the template
cp .env.example .env        # then edit secrets

# 2. Bring the whole stack up
make up                     # or: docker compose up -d --build

# 3. Verify everything is healthy
make health
```

Once up:

- Frontend → http://localhost:3000
- Backend API → http://localhost:4000
- AI Engine docs → http://localhost:8000/docs

Run `make help` to see every available command.

---

## Local development (without Docker)

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && npm install && npm run start:dev

# AI engine
cd ai-engine && pip install -r requirements.txt && uvicorn src.main:app --reload
```

---

## Deployment

- **Docker Compose** — the root [`docker-compose.yml`](docker-compose.yml) runs the
  full stack on a single host. Override secrets via `.env` (never commit it).
- **Kubernetes** — manifests live in [`deployment/k8s/`](deployment/k8s). See
  [`deployment/deployment_guide.md`](deployment/deployment_guide.md) and
  [`deployment/disaster_recovery.md`](deployment/disaster_recovery.md).

---

## For clinicians

If you're a doctor or clinic staff member onboarding to the platform, start with
[`docs/CLINICIAN_ONBOARDING.md`](docs/CLINICIAN_ONBOARDING.md).

---

## Security & compliance

This platform processes Protected Health Information (PHI). **Read
[`SECURITY.md`](SECURITY.md) before deploying or handling patient data.**

---

## Repository layout

```
.
├── frontend/      Next.js web + iOS (Capacitor) client
├── backend/       NestJS API & orchestration
├── ai-engine/     FastAPI AI/ML services
├── database/      SQL schema & migrations
├── deployment/    Docker / Kubernetes manifests
├── docs/          Clinician & operator documentation
├── scripts/       setup & health-check automation
├── docker-compose.yml
├── Makefile
└── .env.example
```
