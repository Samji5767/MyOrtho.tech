# User Guide — MyOrtho.tech v2.0.0-rc1

For orthodontists, clinical directors, residents, and clinical support staff using the MyOrtho.tech web application.

> **AI Disclaimer:** All AI-assisted outputs — including segmentation results, treatment plan stage suggestions, and Copilot recommendations — are recommendations only. Final clinical decisions remain the responsibility of the licensed orthodontist. AI outputs must be reviewed and approved by a qualified clinician before any treatment action is taken.

---

## Login

Navigate to `https://your-domain.com` and enter your email address and password on the login page. Your session is maintained via an HttpOnly cookie (`mo_session`) that persists until you log out or the session expires (24 hours). Sessions cannot be extended — re-authenticate after expiry.

If MFA is enabled for your account, you will be prompted for a time-based one-time code after entering your password.

Single sign-on (SSO) users: click **Sign in with SSO** and enter your organization's SSO identifier. You will be redirected to your identity provider.

---

## Dashboard Overview

After login the dashboard presents:

- **Active cases** — cases assigned to you that are in `scan_review`, `clinical_review`, or `planning` status
- **Pending approvals** — treatment plans awaiting your sign-off (requires `cases:approve` permission)
- **Recent patients** — last 10 patients you accessed
- **AI Copilot** — contextual assistant visible in the right sidebar (available when enabled by your administrator)
- **Notifications** — case status changes and manufacturing queue updates

The top navigation provides access to Patients, Cases, Reports, Analytics, and Settings.

---

## Creating a Patient

1. Click **Patients** in the top navigation, then **New Patient**.
2. Enter the patient's legal name, date of birth, and gender. These fields are encrypted at rest.
3. Add contact information and any relevant clinical notes.
4. Click **Save Patient**.

Patient PHI is encrypted with AES-256-GCM. Only users with `patients:read` or `patients:write` permissions can view or modify patient records.

---

## Creating a Case

Cases can be created from a patient record or independently with a new patient in one step.

**From a patient record:**
1. Open the patient record and click **New Case**.
2. Select the case type and assign a treating orthodontist.
3. Click **Create Case**. The case is created in `draft` status.

**With a new patient in one step:**
1. Click **Cases** → **New Case with New Patient**.
2. Complete both the patient details and case details forms.
3. Click **Create**. Both records are created atomically.

---

## Uploading Scans

Scans are accepted in **binary STL format only**. PLY and OBJ files are not supported in this release.

1. Open a case and navigate to the **Scans** tab.
2. Click **Upload Scan**.
3. Select the STL file from your local filesystem. Maximum file size is 200 MB per scan.
4. Add a label (e.g., upper arch, lower arch, bite registration) and click **Upload**.

Upload progress is displayed as an animated indicator. Note that progress is simulated — the actual transfer happens as a single request. Large files (>50 MB) may take 15–60 seconds on a typical VPS connection.

After upload, the scan appears in the scan list. Click a scan to open it in the 3D CAD Studio.

---

## 3D CAD Studio and Viewing AI Segmentation

The CAD Studio provides an in-browser 3D viewer for uploaded STL scans.

**Controls:**
- Left-click drag — rotate
- Right-click drag / scroll — zoom
- Middle-click drag — pan

**Mesh decimation:** Use the decimation slider to reduce polygon count for smoother interaction on large meshes. Decimation is non-destructive — the original scan file is preserved.

**Tooth segmentation:**
1. Open a scan in the CAD Studio.
2. Click **Run Segmentation**. If the AI engine is configured and a model checkpoint is available, segmentation runs automatically and highlights individual teeth.
3. If AI segmentation is not available, the studio opens in manual segmentation mode. Draw regions on the mesh to segment teeth manually.

Review AI segmentation results carefully. The AI identifies tooth boundaries based on mesh geometry and may produce incorrect results on low-quality or damaged scans. Correct any misidentified segments before advancing the case.

---

## Treatment Planning

Once scans are segmented and the case is in `planning` status:

1. Open the case and navigate to the **Treatment Plan** tab.
2. Click **Generate Plan**. If `TREATMENT_PLAN_AI_URL` is configured, the AI engine proposes a stage-by-stage aligner sequence. Otherwise, click **Add Stage Manually** to build the plan.
3. Review each stage: tooth movements, torque values, and aligner specifications.
4. Edit individual stages as needed. The plan is auto-saved on each edit.
5. When satisfied, click **Submit for Approval**.

AI-generated stage proposals are starting points only. The treating orthodontist must review and approve every stage before the plan is finalized.

---

## Approving a Plan

**Required permission:** `cases:approve`

This permission is available to `orthodontist`, `clinical_director`, and `super_admin` roles by default.

1. Open the case and navigate to the **Treatment Plan** tab.
2. Review all stages carefully.
3. Click **Approve Plan**.
4. Enter your digital signature (full name as it appears in your account) in the confirmation dialog and click **Confirm Approval**.

The approved plan is locked for editing. Subsequent changes require creating a new plan version or initiating a refinement case.

---

## Exporting to Manufacturing

**Required permission:** `cases:send_to_manufacturing`

Available to `lab_manager`, `clinical_director`, `vp_manufacturing`, and `super_admin` by default.

1. From an approved treatment plan, click **Export to Manufacturing**.
2. Select the export format and aligner batch size.
3. Click **Create Export Package**. The package is queued for the manufacturing team.

The export package appears in the **Manufacturing** queue for lab technicians to process.

---

## Clinical Reports

Three report types are available per case:

| Report | Description |
|---|---|
| Treatment Summary | Full case narrative including diagnosis, planned movements, and expected timeline |
| Aligner Progress | Stage-by-stage progress tracker for patient and clinician |
| Insurance Pre-Authorization | Clinical justification formatted for insurance submission |

To generate a report:
1. Open the case and navigate to the **Reports** tab.
2. Click **Generate** next to the desired report type.
3. Once generated, click **Download** to retrieve the report as a PDF-ready file.

Reports can be regenerated at any time. Each download is logged in the audit trail.

---

## Mobile Access

The full patient and case management interface is optimized for desktop browsers. On mobile devices, the following are accessible via **Settings → Clinical tools**:

- Treatment Plan review (view only)
- Analytics dashboard
- Export Package status

Scan upload and CAD Studio are not supported on mobile in this release.

---

## Getting Help

- **AI Copilot** — available in the right sidebar for clinical questions. Requires COPILOT_LLM_PROVIDER to be configured by your administrator.
- **Platform issues** — contact your system administrator or open a support ticket.
- **Clinical questions** — consult your clinical director. AI outputs are not a substitute for clinical judgment.
