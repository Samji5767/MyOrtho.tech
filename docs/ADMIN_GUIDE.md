# Admin Guide — MyOrtho.tech v2.0.0-rc1

This guide covers platform administration tasks performed via the API or admin portal. All admin endpoints require an authenticated session with the `super_admin` or `admin` role unless stated otherwise.

---

## Bootstrap Admin Account

The first admin account is created automatically on first startup. Set the following in `.env` **before** the initial `docker compose up`:

```dotenv
MYORTHO_ADMIN_EMAIL=admin@your-domain.com
MYORTHO_ADMIN_PASSWORD=<strong password, min 12 chars>
MYORTHO_ADMIN_NAME=Platform Admin
```

The backend reads these values on startup and creates the user if no admin account exists. On subsequent restarts these variables are ignored (the account already exists in the database). After first boot you may remove them from `.env` for security, but storing them in a secrets manager for recovery purposes is recommended.

To reset a lost admin password, see the **Resetting Admin Password** section below.

---

## User Management

### Create a user

```bash
curl -s -X POST https://your-domain.com/api/admin/users \
  -H "Content-Type: application/json" \
  -b "mo_session=<your session cookie>" \
  -d '{
    "email": "dr.smith@clinic.com",
    "name": "Dr. Jane Smith",
    "role": "orthodontist",
    "password": "TemporaryPassword1!"
  }'
```

Valid roles: `super_admin`, `admin`, `clinical_director`, `orthodontist`, `dentist`, `resident`, `lab_manager`, `lab_technician`, `vp_clinical`, `vp_manufacturing`, `executive`

### Deactivate a user

Setting `is_active: false` invalidates the user's session on next token verification. The effect is immediate — no logout required.

```bash
curl -s -X PATCH https://your-domain.com/api/admin/users/<userId> \
  -H "Content-Type: application/json" \
  -b "mo_session=<your session cookie>" \
  -d '{"is_active": false}'
```

### List users

```bash
curl -s https://your-domain.com/api/admin/users \
  -b "mo_session=<your session cookie>" | jq .
```

---

## Resetting Admin Password

There is no self-service password reset in v2.0.0-rc1. To reset a lost admin password:

1. Connect to the database container:

```bash
docker compose exec database psql -U myortho_admin -d myortho_tech
```

2. Generate a bcrypt hash for the new password using any bcrypt tool (cost factor 12 minimum), then update the record:

```sql
UPDATE users
SET password_hash = '<bcrypt_hash>',
    updated_at = NOW()
WHERE email = 'admin@your-domain.com';
```

3. Alternatively, set `MYORTHO_ADMIN_EMAIL` and `MYORTHO_ADMIN_PASSWORD` to the **new** values, then temporarily set a flag that forces re-creation, or use the Makefile target if available:

```bash
make seed-admin   # if the Makefile provides this target
```

---

## Feature Flags

Feature flags control the availability of platform capabilities per organization at runtime without code deployment.

### List all flags

```bash
curl -s https://your-domain.com/api/feature-flags \
  -b "mo_session=<your session cookie>" | jq .
```

### Create a flag

```bash
curl -s -X POST https://your-domain.com/api/feature-flags \
  -H "Content-Type: application/json" \
  -b "mo_session=<your session cookie>" \
  -d '{
    "name": "ai_copilot",
    "enabled": true,
    "rolloutPercentage": 100,
    "description": "AI Copilot assistant for clinical staff"
  }'
```

### Update a flag

```bash
curl -s -X PATCH https://your-domain.com/api/feature-flags/<flagId> \
  -H "Content-Type: application/json" \
  -b "mo_session=<your session cookie>" \
  -d '{"enabled": false}'
```

Rollout uses deterministic SHA-256 hash bucketing per organization ID, so the same organization always lands in the same bucket for a given rollout percentage.

---

## Platform Health

```bash
curl -s https://your-domain.com/api/platform-health/status \
  -b "mo_session=<your session cookie>" | jq .
```

Returns status of database connectivity, Redis connectivity, AI engine reachability, and active feature flags.

---

## Audit Log Access

All PHI access, case transitions, plan approvals, and admin actions are written to the audit log.

```bash
# Recent audit events (paginated, newest first)
curl -s "https://your-domain.com/api/audit/logs?limit=50&page=1" \
  -b "mo_session=<your session cookie>" | jq .

# Filter by event type
curl -s "https://your-domain.com/api/audit/logs?eventType=case.transitioned" \
  -b "mo_session=<your session cookie>" | jq .
```

Audit logs are append-only. Deletion is not exposed via the API.

---

## Organization Management

```bash
# Read organization settings
curl -s https://your-domain.com/api/admin/org \
  -b "mo_session=<your session cookie>" | jq .

# Update organization settings (name, timezone, billing plan)
curl -s -X PATCH https://your-domain.com/api/admin/org \
  -H "Content-Type: application/json" \
  -b "mo_session=<your session cookie>" \
  -d '{"name": "Westside Orthodontics", "timezone": "America/Los_Angeles"}'
```

---

## Security Key Rotation

### Rotating JWT_SECRET

JWT_SECRET rotation invalidates **all active user sessions immediately**. Every user will be logged out and must re-authenticate.

1. Generate a new secret: `openssl rand -hex 32`
2. Update JWT_SECRET in `.env`
3. Restart the backend: `docker compose restart backend`

All `mo_session` cookies issued under the old secret are immediately invalid. The Redis blocklist is also cleared on restart if using the in-memory fallback — use Redis in production to avoid this.

Plan a maintenance window or communicate to users before rotating in a live environment.

### Rotating ENCRYPTION_KEY

**This is a destructive operation. Read this section in full before proceeding.**

The ENCRYPTION_KEY encrypts all PHI fields (patient names, dates of birth, gender, clinical notes) using AES-256-GCM. Rotating the key requires re-encrypting every PHI field in the database with the new key before the old key is retired.

**If you start the application with a new ENCRYPTION_KEY before re-encrypting, all existing PHI will become unreadable and the data cannot be recovered without the old key.**

Rotation procedure:

1. Take a full database backup (see BACKUP_RESTORE.md) and store the backup alongside the **current** ENCRYPTION_KEY in a secure location.
2. Write and run a one-time migration script that:
   - Decrypts each PHI field with the old key
   - Re-encrypts it with the new key
   - Updates the record atomically
3. Verify PHI is readable with the new key on a staging environment before touching production.
4. Update ENCRYPTION_KEY in `.env` (and your secrets manager).
5. Restart the backend: `docker compose restart backend`

There is no built-in re-encryption utility in v2.0.0-rc1. This must be implemented as a one-off script before rotating keys in production.
