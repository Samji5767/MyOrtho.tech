# Clinician User Guide — MyOrtho 2.0 RC1

For the orthodontist managing cases from scan upload through to export.

---

## Getting Started

### Logging in

1. Go to your clinic's MyOrtho URL.
2. Enter your email and password.
3. On first login you will be guided through a short setup wizard (role, practice size, preferences).

---

## Complete Clinical Workflow

### Step 1 — Create a Patient

1. Navigate to **Patients** in the sidebar.
2. Click **Add Patient**.
3. Enter first name, last name, date of birth, and gender. These fields are encrypted at rest.
4. Click **Save**. The patient is created and you are taken to their profile.

### Step 2 — Create a Case

1. From the patient profile, click **New Case**.
2. Enter a case reference and select the treatment type.
3. Click **Create Case**. You are taken to the case detail view.

### Step 3 — Upload Scans

1. In the case detail, go to the **Scans** tab.
2. Click **Upload** and select your STL files (upper arch, lower arch).
3. Files are validated on upload: watertightness, face count, and bounding box checks run automatically.
4. A scan with invalid geometry will be rejected with an error message.

### Step 4 — AI Segmentation

1. After upload, click **Run Segmentation**.
2. The AI engine segments the scan into individual teeth (FDI 11–48).
3. Segmentation typically takes 60–120 seconds. A progress indicator is shown.
4. Review the segmentation result in the 3D Viewer. Teeth are colour-coded by quadrant.

### Step 5 — Segmentation Review

1. Navigate to the **Studio** tab.
2. In the **Viewer** panel, confirm all teeth are correctly identified.
3. If a tooth is missing or mislabelled, use the **Edit Segmentation** tool to correct it.
4. When satisfied, click **Approve Segmentation**. The case status advances to `segmentation_reviewed`.

### Step 6 — Treatment Planning

1. Go to **Treatment Plan** (sidebar or case tab).
2. Click **Create Plan**.
3. Enter the target stage count (1–60) and the plan name.
4. Click **Generate Stages** to request AI-generated tooth movement staging.

### Step 7 — Movement Editing

1. In the **Plan** tab, select a stage to edit.
2. Use the movement sliders to adjust each tooth:
   - Translation (mesial/distal, buccal/lingual, intrusion/extrusion) in mm
   - Rotation (torque, tip, rotation) in degrees
3. Movements are validated against safe clinical ranges. Out-of-range values are flagged.
4. Click **Save Stage** after editing each stage.

### Step 8 — Clinical Review and Approval

1. Navigate to **Plan** → **Review**.
2. Review the full treatment sequence using the stage playback controls.
3. The clinical disclaimer banner is always visible during review.
4. Click **Approve Plan** to formally sign off. Your identity and timestamp are recorded in the audit log.
5. Plans with any simulated stages cannot be approved.

### Step 9 — Export for Manufacturing

1. Navigate to **Export**.
2. Click **Create Export Package** and select:
   - Export type (stage models, aligner models, full case package)
   - Stage range
   - File format (STL recommended)
3. The export package runs 14 automated quality checks. Any failure is shown with a description.
4. If all checks pass, click **Approve Export**.
5. Click **Mark as Exported** to confirm handoff to manufacturing.

### Step 10 — Archive Case

1. When treatment is complete, open the case detail.
2. Set the case status to **Completed** using the status dropdown.
3. The case moves to the archive view and is excluded from active pipeline counts.

---

## 3D Viewer Controls

| Action | Control |
|---|---|
| Rotate | Left click + drag |
| Pan | Right click + drag (or middle click) |
| Zoom | Scroll wheel |
| Reset view | Double-click |
| Measurement tool | Click the ruler icon, then click two points on the mesh |
| Clip plane | Click the scissors icon, drag the slider |
| Toggle wireframe | W key |
| Screenshot | Camera icon in toolbar |

---

## Clinical Disclaimer

All AI-generated treatment suggestions are for clinical decision support only. The treating orthodontist is responsible for verifying every stage, reviewing all suggested movements, and making independent clinical judgements before approving a plan. MyOrtho does not make medical recommendations.

---

## Getting Help

- Contact your clinic administrator for account issues.
- For clinical workflow questions, contact MyOrtho support at support@myortho.tech.
- For urgent issues during pilot deployment, use the priority support channel provided in your onboarding package.
