# Clinician Onboarding Guide

Welcome to **MyOrtho.tech**. This guide gets a doctor or clinic staff member from
zero to running their first digital case. No engineering knowledge required — your
IT administrator handles installation; this guide covers daily clinical use.

---

## What the platform does

MyOrtho.tech takes a patient's **intraoral scan** and helps you go all the way to a
**manufactured appliance**:

1. **Import** the 3D scan (STL / DICOM) from your intraoral scanner.
2. **AI analysis** — automatic tooth segmentation, FDI numbering, landmark
   detection, and root prediction.
3. **Treatment planning** — review the AI proposal, adjust the plan, and generate
   aligner stages or restorative designs.
4. **Manufacturing** — route the finished design to an in-house 3D printer with
   automatic nesting, or export for an external lab.
5. **Monitor** — track case progress and collaborate with your team in real time.

---

## Before your first case

Ask your administrator to confirm:

- [ ] You have a clinician account and can sign in at your clinic's web address.
- [ ] Your intraoral scanner can export **STL** (and **DICOM** for CBCT cases).
- [ ] At least one printer is configured in the Manufacturing Center (if printing
      in-house).

---

## Your first case — step by step

### 1. Sign in
Open the platform in your browser (e.g. `https://yourclinic.myortho.tech` or
`http://localhost:3000` for a local install) and sign in.

### 2. Create a case
- Click **New Case** and enter the patient details.
- Upload the intraoral scan file from your scanner.

### 3. Review the AI analysis
The AI engine processes the scan automatically. When it finishes you'll see:
- Segmented teeth with FDI numbers
- Detected landmarks and predicted roots
- An arch analysis summary

**Always review AI output clinically.** The AI assists; the treating doctor makes
the final decision.

### 4. Plan the treatment
- For **aligners**: set your target and generate staged movements; scrub through the
  stages in the 3D viewer.
- For **restorative**: use the restorative workflow to design crowns/bridges.

### 5. Manufacture
- Send the approved design to the **Manufacturing Center**.
- Choose a printer; the system nests parts onto the build plate automatically.
- Track the print job to completion.

### 6. Follow up
Use remote monitoring and messaging to track the patient's progress and
collaborate with colleagues on the case.

---

## Using the 3D viewer

| Action | How |
|--------|-----|
| Rotate | Click + drag |
| Zoom | Scroll / pinch |
| Pan | Right-click + drag (or two-finger drag) |
| Step through aligner stages | Use the stage slider |

The same workflow is available on iPad via the companion iOS app.

---

## Data privacy

Patient scans and records are **Protected Health Information**. Only access cases
for patients under your care, and never share login credentials. See
[`../SECURITY.md`](../SECURITY.md) for the full policy.

---

## Getting help

- Clinical or workflow questions → your clinic administrator.
- Technical issues (errors, a service not loading) → your IT contact, who can run
  `make health` to diagnose the platform.
