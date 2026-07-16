# Backup and Restore — MyOrtho 2.0

---

## What to Back Up

| Data | Location | Criticality |
|---|---|---|
| PostgreSQL database | `myortho` DB on the `postgres` container | **Critical** — all patient, case, and plan data |
| Uploaded scan files | `STORAGE_PATH` volume (default: `/data/uploads`) | **Critical** — original STL/PLY scan files |
| AI model checkpoint | `MODEL_CHECKPOINT` path (container volume) | High — restore from model registry if lost |
| Environment config | `.env` file (host machine) | **Critical** — losing `ENCRYPTION_KEY` means PHI is permanently unreadable |

---

## Database Backup

### Manual

```bash
docker exec myortho-postgres pg_dump -U myortho -d myortho -Fc \
  > backup_$(date +%Y%m%d_%H%M%S).dump
```

### Automated (cron — runs daily at 02:00)

```cron
0 2 * * * docker exec myortho-postgres pg_dump -U myortho -d myortho -Fc \
  > /backups/myortho_$(date +\%Y\%m\%d).dump && \
  find /backups -name "myortho_*.dump" -mtime +30 -delete
```

Verify backups weekly:

```bash
pg_restore --list backup_YYYYMMDD_HHMMSS.dump | head -20
```

---

## File Storage Backup

```bash
rsync -av /data/uploads/ /backups/uploads_$(date +%Y%m%d)/
```

Or use your cloud provider's volume snapshot feature (AWS EBS, GCP Persistent Disk, etc.).

---

## Full Restore

### 1. Restore environment

```bash
# Ensure .env is present with the original ENCRYPTION_KEY
# PHI fields are AES-256-GCM encrypted at rest; the original key is required to read them
cp .env.backup .env
```

### 2. Restore database

```bash
docker compose up -d postgres
docker exec -i myortho-postgres psql -U myortho -d postgres \
  -c "DROP DATABASE IF EXISTS myortho; CREATE DATABASE myortho;"
docker exec -i myortho-postgres pg_restore -U myortho -d myortho < backup_YYYYMMDD.dump
```

### 3. Restore uploads

```bash
rsync -av /backups/uploads_YYYYMMDD/ /data/uploads/
```

### 4. Start services

```bash
docker compose up -d
```

### 5. Verify

```bash
curl http://localhost:3001/api/health
# Log in as admin and confirm patient count matches expectations
```

---

## Key Management Warning

The `ENCRYPTION_KEY` is used for AES-256-GCM field encryption of all PHI. **If this key is lost, encrypted PHI cannot be recovered.** Store it in a hardware security module (HSM) or a secrets manager (AWS Secrets Manager, HashiCorp Vault, GCP Secret Manager) and back it up separately from the database.

Key rotation requires a migration script that decrypts all PHI with the old key and re-encrypts with the new key. Do not rotate the key without a planned migration procedure.

---

## Pilot Clinic Recommendations

- Run database backups at minimum daily; retain for 90 days
- Test restore quarterly from a fresh environment
- Store backups off-site (different cloud region or physical location)
- Back up `.env` to a separate secrets manager, never to the same storage as the database dump
