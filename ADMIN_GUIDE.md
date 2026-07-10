# Administrator Guide — MyOrtho 2.0 RC1

This guide is for the platform administrator (`super_admin` role) responsible for managing a pilot clinic deployment.

---

## First Login

1. Navigate to `/login`.
2. Enter the email set in `MYORTHO_ADMIN_EMAIL` (default: `admin@myortho.tech`) and the password set in `MYORTHO_ADMIN_PASSWORD`.
3. Complete the onboarding wizard; select **Platform Admin** or **CEO** as your role.
4. You will land on the Dashboard.

---

## User Management

Navigate to `/admin` → **Users**.

### Adding a user

1. Click **Invite User**.
2. Enter name, email, and role.
3. The user receives an invitation email with a temporary password link.

### Roles

| Role | Access level |
|---|---|
| `super_admin` | Full platform access including admin panel |
| `admin` | Organization management, user management, audit log |
| `clinical_director` | All clinical functions, plan approval, audit |
| `orthodontist` | Case creation, treatment planning, approval |
| `dentist` | Case submission, patient management |
| `resident` | Read-only clinical access |
| `lab_manager` | Manufacturing queue, job routing, QC |
| `lab_technician` | CAD editing, print jobs |
| `vp_clinical` | Clinical analytics, read-only case access |
| `vp_manufacturing` | Manufacturing analytics |
| `executive` | Business analytics dashboard only |

### Disabling a user

User accounts have an `is_active` flag. To disable:

```sql
UPDATE auth_users SET is_active = false WHERE email = 'user@clinic.com';
```

The user's active sessions are not immediately revoked; they expire at their natural JWT expiry (default 24 hours). To force immediate logout, flush the Redis JTI blacklist entry or restart the backend.

---

## Organization Settings

Navigate to `/admin` → **Organization**.

- **Name** and **type**: updated here
- **Scanner integrations**: configure vendor credentials (required before scan import; the system throws an error rather than silently using sandbox credentials)
- **Feature flags**: enable/disable AI engine features, demo mode, and experimental tools

---

## Audit Log

Navigate to `/admin` → **Audit Log**.

All write operations (patient create/update, case create/update, plan approve, login, logout) are recorded with actor ID, resource type, resource ID, IP address, and timestamp.

The audit log is append-only; entries cannot be edited or deleted from the UI. Direct database access is required to export in bulk:

```sql
SELECT * FROM audit_events
WHERE organization_id = '<org-uuid>'
ORDER BY created_at DESC
LIMIT 1000;
```

---

## Platform Health

Navigate to `/admin` → **Platform** or `/platform-health` for a full report.

Monitors: database connectivity, Redis connectivity, AI engine availability, disk usage, memory, and recent error rates.

---

## Managing the Admin Account

The admin account is bootstrapped on first start from environment variables. To change the password after initial setup, use the **Settings → Profile** page or update via the API:

```
PATCH /api/auth/profile
{ "password": "new-strong-password" }
```

To change the admin email, update the `auth_users` table directly:

```sql
UPDATE auth_users SET email = 'new-admin@clinic.com' WHERE role = 'super_admin';
```

---

## Backup and Recovery

See [BACKUP_RESTORE.md](./BACKUP_RESTORE.md).

---

## Known Admin Limitations (RC1)

- CSRF protection is not yet deployed; keep admin access to trusted networks
- No SSO/SAML integration in RC1
- Password complexity rules are enforced at the API but not yet in the UI (all passwords accepted if ≥ 8 chars in UI)
- Bulk user import (CSV) is not yet available
