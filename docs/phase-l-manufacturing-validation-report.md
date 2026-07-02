# Phase L — Manufacturing Validation Report

**Date**: 2026-07-02  
**Branch**: `claude/myortho-production-validation-dlmvsi`  
**Method**: Source code audit of manufacturing, print-farm, lab-orders, batch-manufacturing, and device-tracking modules.

---

## Modules Audited

| Module | Controller | Service | DTOs |
|--------|-----------|---------|------|
| `manufacturing` | `ManufacturingController`, `PrinterRegistryController` | `ManufacturingService`, `ManufacturingRouterService` | `CreatePrintJobDto`, `UpdatePrintJobStatusDto` |
| `print-farm` | `PrintFarmController` | `PrintFarmService` | — |
| `lab-orders` | `LabOrdersController` | `LabOrdersService` | — |
| `batch-manufacturing` | `BatchManufacturingController` | `BatchManufacturingService` | — |
| `device-tracking` | `DeviceTrackingController` | `DeviceTrackingService` | — |

---

## L1 — Manufacturing Job API (`/api/manufacturing/jobs`)

| Endpoint | Auth | Multi-tenant | Status |
|----------|------|-------------|--------|
| `GET /api/manufacturing/jobs` | AuthGuard ✓ | `org_scoped: true` ✓ | PASS |
| `POST /api/manufacturing/jobs` | AuthGuard ✓ | `org_scoped: true` ✓ | PASS |
| `GET /api/manufacturing/jobs/:id` | AuthGuard ✓ | `org_scoped: true` ✓ | PASS |
| `PATCH /api/manufacturing/jobs/:id/status` | AuthGuard ✓ | `org_scoped: true` ✓ | PASS |
| `POST /api/manufacturing/jobs/:id/retry` | AuthGuard ✓ | `org_scoped: true` ✓ | PASS |
| `POST /api/manufacturing/jobs/:id/cancel` | AuthGuard ✓ | `org_scoped: true` ✓ | PASS |
| `GET /api/printers` | AuthGuard ✓ | `org_scoped: true` ✓ | PASS |

Auth helper uses correct `req.user.orgId` field.

**Finding (L1-F1) — No PermissionsGuard**: Manufacturing endpoints use `AuthGuard` only with no `@RequirePermission` decorator. A user with any authenticated role (e.g., `receptionist`) can create print jobs, cancel jobs, and list printers. A `manufacturing:write` permission should be required for job creation/cancel/retry.

---

## L2 — Printer Profiles

`ManufacturingService.listPrinters()` queries `printers` table for org-scoped entries. Printer profiles stored in the DB include fields for:
- Vendor (`vendor` TEXT)
- Model (`model` TEXT)
- Print volume dimensions
- Connector status (`connector_status`)
- Resin/material compatibility

**Finding (L2-F1)**: No validation that the printer in a print job matches the material required by the aligner stage. The `CreatePrintJobDto` accepts `printerId` (a UUID) and `quantity`, but no check verifies that the printer's material capabilities match the order's resin type. This is an application-layer gap, not a DB constraint.

**Finding (L2-F2)**: Real-time printer telemetry is noted as requiring "a configured vendor connector" in source code comments. No vendor connector integration exists in the codebase. The `connector_status` column is manually set. No actual printer communication (OctoPrint, Formlabs API, Carbon API) is implemented.

---

## L3 — Aligner Generation and Export

`aligner-generation.service.ts` generates aligner stage sequences and stores movement data in `tooth_movements`. The service is integrated with the treatment planning workflow.

**Finding (L3-F1)**: The `export-package` module (`ExportPackageService`) creates export records in the DB but does not generate actual 3D files for manufacturing. Export records contain metadata (planned movements, stage counts) stored as JSONB. No STL/OBJ file for the physical aligner is produced by this service.

**Finding (L3-F2)**: The CAD export (from `CADEngine.tsx`) produces JSON labeled as STL (documented in Phase I). This means the manufacturing pipeline lacks a valid 3D file at every stage — from planning export through lab order.

---

## L4 — Lab Orders (`/api/lab-orders`)

Lab orders endpoint is implemented with CRUD operations. Queries are org-scoped. Auth is enforced via `AuthGuard`.

**Finding (L4-F1)**: No PermissionsGuard on lab order endpoints — same issue as manufacturing jobs.

**Finding (L4-F2)**: Lab order status transitions (`pending` → `submitted` → `in_production` → `shipped` → `delivered`) are stored but not validated. Any status can be set to any value via PATCH without transition rules.

---

## L5 — Batch Manufacturing (`/api/batch-manufacturing`)

`BatchManufacturingService` groups print jobs into batches for efficiency. Batch creation, status management, and assignment to printers are implemented.

**Finding (L5-F1)**: Batch job scheduling uses no priority queue. Jobs are batched by `created_at` order. No optimization for printer utilization is implemented.

---

## L6 — Device Tracking (`/api/device-tracking`)

Device tracking maintains a ledger of aligner devices delivered to patients, with tracking codes and delivery status.

**Finding (L6-F1)**: Device history records have no `created_at` or `updated_at` columns in the schema (documented in Phase J). Timeline cannot be established for device custody chain.

---

## L7 — Test Coverage

**Zero manufacturing-specific unit tests exist.**

All 75 backend unit tests cover: Bolton analysis, IPR planner, treatment monitoring, cases controller, and common filters. No test covers:
- Print job creation and status transitions
- Batch assembly logic
- Lab order workflow
- Printer assignment validation
- Aligner stage export

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| Manufacturing job API | IMPLEMENTED | Auth correct; no PermissionsGuard |
| Printer profiles | PARTIAL | DB storage only; no real printer communication |
| Aligner export (3D file) | NOT IMPLEMENTED | JSON metadata only; no actual STL/OBJ output |
| Lab orders | IMPLEMENTED | Auth correct; no transition validation |
| Batch manufacturing | IMPLEMENTED | No priority queue |
| Device tracking | IMPLEMENTED | Missing schema timestamps |
| Unit tests | NONE | 0 manufacturing-specific tests |

**Manufacturing Readiness Score**: 45/100  
Rationale: API endpoints for the full manufacturing workflow exist and are correctly authenticated. Critical gaps: no real printer communication, no actual 3D file generation for manufacturing, no unit tests. The workflow is a skeleton that can accept and track jobs but cannot physically produce aligners or verify geometry.
