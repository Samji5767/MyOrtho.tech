# Integration Health Monitoring

Integration health is monitored by scheduling `integration.health_check` background jobs for every enabled provider. Results are written to `integration_health_logs` and update `integration_providers.health_status`.

## Health Statuses

| Status | Meaning |
|--------|---------|
| `healthy` | Provider responded normally within expected latency |
| `degraded` | Provider responded but with elevated latency or partial errors |
| `unhealthy` | Provider did not respond or returned a critical error |
| `unknown` | No health check has been run since the provider was registered |

## Scheduling Health Checks

```bash
# Trigger health checks for all enabled providers in your org
POST /api/integration-providers/run-health-checks
Authorization: Bearer <token>

# Response
{
  "scheduled": 3,
  "providerIds": ["prov-1", "prov-2", "prov-3"]
}
```

This enqueues one `integration.health_check` job per enabled provider. The worker picks them up and runs them within the next poll interval (5 seconds). Idempotency keys prevent duplicate checks within the same clock hour.

## Manual Health Check

To record a health check result directly (e.g., from an external monitoring system):

```bash
POST /api/integration-providers/:id/health-check
{
  "status": "healthy",
  "responseTimeMs": 145,
  "errorMessage": null
}
```

## Viewing Health Logs

```bash
GET /api/integration-providers/:id/health-logs?limit=50
```

Returns the most recent 50 health check results for a provider, newest first.

## Provider Types

Health checks are supported for all registered provider types:

- `dicom_pacs` — DICOM/PACS connectivity
- `hl7_fhir` — HL7 FHIR endpoint availability
- `pms` — Practice management system API
- `scanner` — 3D scanner device connectivity
- `printer` — 3D printer API/network
- `payment` — Payment gateway health
- `email`, `sms`, `calendar` — Notification service availability

## Recommended Monitoring Schedule

Use a cron job or workflow trigger to call `POST /api/integration-providers/run-health-checks` every 15 minutes. Alert on any provider with `health_status = 'unhealthy'` for more than two consecutive checks.
