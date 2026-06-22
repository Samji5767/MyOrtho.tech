# MyOrtho.tech — Production Deployment Guide

**Current production stack:** Hostinger VPS · Docker Compose · Nginx · Let's Encrypt HTTPS

Live endpoints: https://myortho.tech · https://api.myortho.tech · https://ai.myortho.tech

> The `deployment/k8s/` directory contains a Kubernetes/Helm reference chart for
> future horizontal scaling. The active production deployment is Docker Compose as
> documented here. Do not follow the k8s chart instructions against the current VPS.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 24+ | Container runtime |
| Docker Compose | v2+ (`docker compose`) | Service orchestration |
| Nginx | Any | Reverse proxy + TLS termination |
| Certbot | Any | Let's Encrypt certificate issuance |
| Git | Any | Source checkout |
| Node.js | 22 (LTS) | Local build/test only — not needed on VPS |

---

## Step 1 — Clone and configure

```bash
git clone https://github.com/<org>/myortho.tech.git /opt/myortho
cd /opt/myortho
cp .env.example .env
```

Edit `.env` with production values:

```bash
# Required — replace all placeholder values
POSTGRES_PASSWORD=<strong-random-password>
DATABASE_URL=postgresql://myortho_admin:<strong-random-password>@database:5432/myortho_tech
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
JWT_SECRET=<64-byte-random-hex>
ENCRYPTION_KEY=<32-byte-random-hex>
NODE_ENV=production
FRONTEND_URL=https://myortho.tech
NEXT_PUBLIC_API_URL=https://api.myortho.tech
NEXT_PUBLIC_AI_URL=https://ai.myortho.tech
```

> **Security:** Postgres and Redis are NOT exposed to the host (they use `expose`,
> not `ports`). They are only reachable inside the Docker Compose network.

---

## Step 2 — Build and start

```bash
# Build all images (first deploy or after code changes)
docker compose build --no-cache

# Start all services in detached mode
docker compose up -d

# Verify all containers are healthy
docker compose ps
```

Expected output — all services `Up (healthy)` or `Up`:

```
NAME                  STATUS
myortho-db            Up (healthy)
myortho-cache         Up
myortho-backend       Up (healthy)
myortho-frontend      Up
myortho-ai            Up
```

---

## Step 3 — Health checks

```bash
# Automated check (uses scripts/health-check.sh)
make health

# Manual checks
curl https://api.myortho.tech/health
curl https://ai.myortho.tech/health
curl -o /dev/null -s -w "%{http_code}" https://myortho.tech
```

Expected responses:
- `api.myortho.tech/health` → `{"status":"ok","service":"myortho-backend",...}`
- `ai.myortho.tech/health` → `{"status":"ok","service":"myortho-ai-engine",...}`
- `myortho.tech` → HTTP 200

---

## Step 4 — Nginx configuration

Nginx runs on the host (not in a container) and proxies each subdomain to the
appropriate container port.

```nginx
# /etc/nginx/sites-available/myortho.tech
server {
    server_name myortho.tech;
    location / { proxy_pass http://127.0.0.1:3005; }
    listen 443 ssl; # managed by Certbot
}
server {
    server_name api.myortho.tech;
    location / { proxy_pass http://127.0.0.1:4000; }
    listen 443 ssl; # managed by Certbot
}
server {
    server_name ai.myortho.tech;
    location / { proxy_pass http://127.0.0.1:8000; }
    listen 443 ssl; # managed by Certbot
}
```

TLS certificates are managed by Certbot (Let's Encrypt). Renew with:

```bash
certbot renew --nginx
```

---

## Step 5 — Database schema

The schema is applied automatically on first container start via Docker Compose's
`initdb.d` mount. To apply manually after a schema change:

```bash
docker compose exec database psql -U myortho_admin -d myortho_tech \
  -f /docker-entrypoint-initdb.d/schema.sql
```

The `auth.uid()` compatibility shim is included in `database/schema.sql` so the
schema works identically in local Docker Postgres and production Supabase.

---

## Step 6 — Updates and redeployment

```bash
cd /opt/myortho
git pull origin main
docker compose build --no-cache
docker compose up -d
make health
```

For zero-downtime: restart services one at a time:

```bash
docker compose up -d --no-deps backend
docker compose up -d --no-deps frontend
docker compose up -d --no-deps ai-engine
```

---

## Rollback

```bash
# Roll back to a previous image tag
git checkout <commit-sha>
docker compose build
docker compose up -d
```

---

## Kubernetes / Helm (future scaling)

The `deployment/k8s/` directory contains a Helm chart for horizontal Pod
autoscaling, multi-replica backend, and managed certificate issuance suitable
for AWS EKS or GKE. This is **not active in production today** — it is a
readiness artifact for when the platform reaches multi-clinic scale.

Do not apply the Helm chart to the current VPS — the network topology (services,
ingress, secrets) differs from the Docker Compose stack.
