# MyOrtho Product Maturity

> **Last updated**: 2026-06-23 — Phase 10: Enterprise onboarding and clinical AI readiness

This document is the single source of truth for what MyOrtho is — and is not — today.
It distinguishes between what is **implemented**, what is **simulated** (realistic UI with representative data, not a validated clinical engine), and what is **planned** (roadmap item with typed data models).

## Maturity Definitions

| Label | Meaning |
|---|---|
| **Implemented** | Working interaction in the app today. Real user input → real output. |
| **Simulated** | Realistic UI and data model. Representative data; NOT a validated production engine. Do not use for clinical decisions. |
| **Planned** | Typed model and API seam exist; interactive feature not yet built. |
| **Not started** | No code exists; conceptual only. |

---

## Frontend (Next.js)

### Authentication
| Capability | Status |
|---|---|
| Login page (email + password) | Implemented |
| HttpOnly JWT session cookie | Implemented |
| Route protection (AuthGate) | Implemented |
| Logout | Implemented |
| Session refresh on page load | Implemented |
| Role-based UI personalization | Implemented |
| Password reset flow | Not started |
| Multi-factor authentication | Not started |
| SSO / SAML | Not started |

### Clinical Workflows
| Capability | Status |
|---|---|
| Case list with filter chips | Implemented |
| Case detail with 3 tabs (Summary / Workflow / Audit) | Implemented |
| Workflow status machine (7 states, 4 actions) | Implemented |
| Clinical notes on workflow transitions | Implemented |
| Audit trail (11 event types, CSV export) | Implemented |
| Patient list | Simulated |
| Scan upload | Simulated |

### CAD Studio
| Capability | Status | Notes |
|---|---|---|
| STL import | Implemented | Three.js STLLoader |
| PLY import | Implemented | Three.js PLYLoader |
| OBJ import | Implemented | Three.js OBJLoader |
| Distance measurement | Implemented | Euclidean, raycasting |
| Angle measurement (3-point) | Implemented | Dot-product arm vectors |
| Overjet measurement | Implemented | |ΔX| horizontal |
| Overbite measurement | Implemented | |ΔY| vertical |
| Cross-section viewer | Simulated | Clipping plane |
| Bolton Analysis | Simulated | Editable inputs, representative |
| IPR planning | Simulated | Markers only |
| Attachment placement | Simulated | Visual only |
| Stage timeline | Simulated | Representative stages |
| Export workflow (JSON) | Implemented | Structured CAD package |
| Trimline design | Planned | |
| Margin drawing | Planned | |
| Undercut detection | Planned | |
| Occlusal heatmap | Planned | |
| Bite ramp designer | Planned | |
| Pontic designer | Planned | |
| AI segmentation | Planned | Endpoint exists; model not production-ready |
| AI landmark detection | Planned | Endpoint seam exists |
| Auto setup proposal | Planned | Requires AI segmentation + landmarks |

### Analytics & Dashboards
| Capability | Status |
|---|---|
| Monthly throughput chart | Simulated (representative data) |
| SLA metrics panel | Simulated |
| Stage distribution | Simulated |
| Approval turnaround histogram | Simulated |
| Provider performance table | Simulated |
| Live backend data | Not started (requires backend connection) |

### Onboarding
| Capability | Status |
|---|---|
| 7-step enterprise onboarding | Implemented |
| Role selection (15 roles) | Implemented |
| Organization type + name | Implemented |
| Practice scale collection | Implemented |
| Workflow preferences | Implemented |
| AI readiness preference | Implemented |
| Demo data toggle | Implemented |
| Role-specific success screen | Implemented |
| Role-specific workspace routing | Implemented |

---

## Backend (NestJS)

### Auth
| Capability | Status |
|---|---|
| POST /api/auth/login | Implemented |
| POST /api/auth/logout | Implemented |
| GET /api/auth/session | Implemented |
| POST /api/auth/onboarding | Implemented |
| GET /api/me | Implemented |
| Bootstrap admin from env | Implemented |
| Rate limiting (in-memory) | Implemented |
| Rate limiting (Redis-backed) | Planned |

### Cases API
| Capability | Status |
|---|---|
| GET /cases | Simulated (returns mock data) |
| POST /cases | Planned (endpoint seam exists) |
| PATCH /cases/:id/status | Simulated |
| GET /cases/:id | Planned |

### Manufacturing
| Capability | Status |
|---|---|
| Print queue management | Simulated |
| Job status tracking | Simulated |

### AI Integration
| Capability | Status |
|---|---|
| Segmentation endpoint | Planned (MONAI backbone exists; not production-validated) |
| Arch analysis endpoint | Simulated |
| Mesh hollowing | Planned |

---

## Database

### Tables in schema
| Table | Status |
|---|---|
| organizations | Implemented |
| auth_users | Implemented (Phase 8) |
| profiles (Supabase-dependent) | Legacy (migrating to auth_users) |
| patients | Schema only |
| cases | Schema only |
| treatment_plans | Schema only |
| aligner_stages | Schema only |
| printers | Schema only |
| print_jobs | Schema only |
| audit_logs | Schema only |

---

## What Is NOT Production-Ready

The following are explicitly **not production-certified** for live clinical use today:

1. **AI segmentation** — Model endpoint exists; clinical validation not complete.
2. **AI landmark detection** — Seam exists; annotated training data required.
3. **Bolton analysis** — UI implemented; values are representative, not validated from segmented models.
4. **Root prediction** — Not built. Requires CBCT integration.
5. **Analytics dashboards** — All data is representative; backend connection not yet live.
6. **Patient data persistence** — Frontend only; backend API not fully wired to database.
7. **HIPAA compliance** — Designed for, not certified. Requires BAA, policies, and penetration testing.
8. **Multi-tenant isolation** — Schema supports it; API enforcement is on the roadmap.

---

## Suggested Path to Clinical Certification

1. Wire backend API to live database (connect cases, patients, audit_logs tables)
2. Complete Redis-backed rate limiting and full RBAC API enforcement
3. Commission third-party penetration test
4. Execute clinical validation study for AI segmentation
5. Obtain Business Associate Agreements with any infrastructure vendors
6. Begin FDA 510(k) pre-submission (if AI features are promoted as clinical decision support)
7. Complete HIPAA Security Rule risk assessment
