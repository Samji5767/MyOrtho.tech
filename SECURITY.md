# Security & Compliance Policy

MyOrtho.tech processes **Protected Health Information (PHI)** — patient scans,
clinical records, treatment plans, and identifiers. Anyone deploying or operating
this platform is responsible for handling that data lawfully and securely.

> This document describes engineering controls and expectations. It is **not legal
> advice.** Consult your compliance officer for HIPAA, GDPR, or local medical-data
> obligations in your jurisdiction.

---

## Reporting a vulnerability

If you discover a security issue, **do not open a public GitHub issue.** Email the
maintainers privately with:

- A description of the vulnerability and its impact
- Steps to reproduce
- Affected service(s) and versions

You will receive an acknowledgement within 72 hours.

---

## Data classification

| Class | Examples | Handling |
|-------|----------|----------|
| **PHI** | Intraoral scans, patient name/DOB, treatment plans, DICOM | Encrypt at rest & in transit; access-logged; minimum necessary |
| **Confidential** | Clinic billing, API keys, service-role tokens | Secrets manager only; never in source or logs |
| **Internal** | Aggregated/anonymized metrics | Restricted to authenticated operators |
| **Public** | Marketing pages, docs | No restriction |

---

## Required controls before production

- [ ] **Secrets** — every `change_me` / placeholder value in `.env` replaced with a
      strong, unique secret (`openssl rand -hex 32`). `.env` is git-ignored — keep it
      that way.
- [ ] **Transport encryption** — TLS terminated in front of every public service.
      No plaintext HTTP for PHI.
- [ ] **Encryption at rest** — database volume and object storage encrypted;
      `ENCRYPTION_KEY` set for application-level PHI encryption.
- [ ] **Authentication** — Supabase keys are environment-specific; service-role key
      is never exposed to the frontend.
- [ ] **Access control** — least-privilege roles; clinician accounts cannot access
      data outside their clinic.
- [ ] **Audit logging** — all PHI reads/writes logged with actor, timestamp, and
      record id; logs retained per policy.
- [ ] **Backups** — automated, encrypted, and tested for restore. See
      `deployment/disaster_recovery.md`.
- [ ] **Dependency hygiene** — CI dependency scanning enabled; no known-critical CVEs
      shipped.

---

## Secrets management

- The default values in `docker-compose.yml` and `.env.example` are **development
  placeholders only**. They must never reach a production environment.
- Use a real secrets manager (AWS Secrets Manager, Vault, Kubernetes Secrets with
  encryption-at-rest) for production deployments.
- Rotate `JWT_SECRET`, `ENCRYPTION_KEY`, and database credentials on a defined
  schedule and immediately after any suspected exposure.

---

## Supported versions

Security fixes are applied to the `main` branch. Pin deployments to a tagged
release and track this repository for advisories.
