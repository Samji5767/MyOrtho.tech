# MyOrtho.tech - Disaster Recovery Plan

This document establishes the Standard Operating Procedures (SOP) for restoring **MyOrtho.tech** services during critical outages, database corruption, or regional cloud failures.

---

## 1. Database Backup & Point-in-Time Recovery (PITR)

Our database layer utilizes Supabase (PostgreSQL) with automated WAL archiving to support Point-in-Time Recovery (PITR).

### Daily Automated Backup Retention
- **Retention Limit**: 30 days
- **Storage Target**: Multi-region encrypted S3/Cloudflare R2 bucket.

### Manual Database Snapshot Trigger
To trigger a manual snapshot of the database prior to major schema modifications:

```bash
# Export schema and data using pg_dump
pg_dump -h db.myortho.tech -U postgres -d myortho -F c -b -v -f "/backups/myortho-pre-migration-$(date +%F).backup"
```

### Performing Point-in-Time Recovery
To recover to a specific timestamp (e.g. before an accidental data drop):

1. Access the cloud provider console (Supabase Dashboard or AWS RDS console).
2. Select **Restore Point-in-Time**.
3. Specify the Target Recovery Time (UTC): `2026-06-15T18:00:00Z`.
4. Spin up the recovered instance as a staging database.
5. Verify schema integrity, then swap the DNS records/Kubernetes secrets to point to the new database URL.

---

## 2. Print Queue Failover Recovery

In the event of a physical or API connection failure for a localized 3D printer fleet, print jobs must be auto-rerouted.

### Failover Trigger Rules
1. If a printer's status switches to `offline` or `error` during a print run.
2. The print routing service detects capacity limits are exceeded at a local site.

### Kubernetes Pod Recovery
If NATS or Redis connections are disrupted, local in-memory fallback queues preserve job states. To force restart a print orchestration queue worker pod:

```bash
kubectl rollout restart deployment/myortho-backend -n myortho-prod
```

---

## 3. High Availability Failback

Once the primary region or database recovers, proceed with failback:

1. **Pause Ingress Traffic**: Place site under maintenance mode via NGINX ingress annotation:
   ```yaml
   nginx.ingress.kubernetes.io/configuration-snippet: |
     return 503;
   ```
2. **Re-Sync Delta**: Export updates since outage from failover site and apply to primary database.
3. **Point DNS Back**: Re-route Ingress hosts (`app.myortho.tech`) back to primary region.
4. **Remove Maintenance Mode**: Verify live system metrics on Grafana/Prometheus dashboard before opening to clinics.
