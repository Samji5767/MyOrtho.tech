/**
 * The MyOrtho Dental CAD capability registry.
 *
 * This is the single source of truth for what the CAD Studio claims to do and
 * — critically — how far along each capability actually is. The UI reads this
 * to communicate capabilities honestly to clinicians, labs, and evaluators.
 *
 * Maturity is deliberate and conservative:
 *   - "implemented" — a real, working interaction exists in the app today.
 *   - "simulated"   — the UI/data model exists and behaves realistically, but
 *                     the underlying clinical computation is representative,
 *                     not a validated production engine.
 *   - "planned"     — typed model + seam exist; interaction is not built yet.
 *
 * We never label something "implemented" to imply validated clinical AI that
 * is not actually wired up. See `lib/cad/models.ts` for the typed data models.
 */

export type CapabilityMaturity = "implemented" | "simulated" | "planned";

export type CapabilityPhase = "review" | "plan" | "design" | "manufacture" | "export";

export interface CadCapability {
  id: string;
  name: string;
  phase: CapabilityPhase;
  maturity: CapabilityMaturity;
  /** One-line clinical description of what the capability does. */
  summary: string;
  /** Honest note on the current state / what is and isn't wired up. */
  statusNote: string;
  /** Where this capability lives today (component/route), or null if planned. */
  surface: string | null;
}

export const CAPABILITY_PHASES: { key: CapabilityPhase; label: string }[] = [
  { key: "review", label: "Case Review" },
  { key: "plan", label: "Treatment Planning" },
  { key: "design", label: "Appliance Design" },
  { key: "manufacture", label: "Manufacturing" },
  { key: "export", label: "Export & Handoff" },
];

export const MATURITY_META: Record<
  CapabilityMaturity,
  { label: string; tone: "success" | "info" | "neutral"; description: string }
> = {
  implemented: {
    label: "Implemented",
    tone: "success",
    description: "Working interaction available in the app today.",
  },
  simulated: {
    label: "Simulated",
    tone: "info",
    description: "Realistic UI and data model; representative computation, not a validated engine.",
  },
  planned: {
    label: "Planned",
    tone: "neutral",
    description: "Typed model and integration seam exist; interaction not yet built.",
  },
};

export const CAD_CAPABILITIES: CadCapability[] = [
  {
    id: "case-review",
    name: "Case Review",
    phase: "review",
    maturity: "simulated",
    summary: "Review patient scan, malocclusion class, crowding, and chief complaint before planning.",
    statusNote: "Case list/detail exist; CAD-context review summary is modelled and surfaced, not yet persisted.",
    surface: "/cases",
  },
  {
    id: "arch-analysis",
    name: "Arch Analysis",
    phase: "review",
    maturity: "simulated",
    summary: "Arch length/width, intercanine & intermolar distances, curve of Spee, symmetry index.",
    statusNote: "Backend ai-engine arch_analysis exists; frontend reads a typed ArchAnalysis model.",
    surface: "/ai-analysis",
  },
  {
    id: "occlusal-analysis",
    name: "Occlusal Analysis",
    phase: "review",
    maturity: "planned",
    summary: "Per-tooth occlusal contact map with penetration/clearance intensity vs antagonist.",
    statusNote: "OcclusalContact model defined; contact-mapping interaction not yet built.",
    surface: null,
  },
  {
    id: "clinical-measurements",
    name: "Clinical Measurements",
    phase: "review",
    maturity: "implemented",
    summary: "On-mesh distance, 3-point angle, horizontal overjet, and vertical overbite measurement tools.",
    statusNote: "Implemented in Viewer3D: raycasting point-pick on real imported geometry (STL/PLY/OBJ). Distance uses Euclidean length; angle uses dot-product of arm vectors; overjet reports |ΔX|; overbite reports |ΔY|. Results shown as overlays, stored in history, exportable as CSV.",
    surface: "Viewer3D",
  },
  {
    id: "treatment-planning",
    name: "Treatment Planning",
    phase: "plan",
    maturity: "implemented",
    summary: "Create treatment plans with estimated stage counts and doctor approval workflow. Plans linked to cases via patientId.",
    statusNote: "Fully wired in Phase 22: TreatmentPlansPanel → POST /api/cases/:id/plans → PostgreSQL treatment_plans table. Doctor approval writes approved_at + signature. Plan creation page is case-aware via ?caseId= URL param.",
    surface: "/treatment-plan",
  },
  {
    id: "movement-vectors",
    name: "Movement Vectors",
    phase: "plan",
    maturity: "implemented",
    summary: "Interactive per-tooth translation/rotation with live biomechanical limit validation.",
    statusNote: "Working in CAD Engine: transform gizmos, collision detection, PDL limit checks.",
    surface: "CADEngine",
  },
  {
    id: "ipr-planning",
    name: "IPR Planning",
    phase: "plan",
    maturity: "simulated",
    summary: "Plan interproximal reduction sites, amounts, and the stage before which to perform them.",
    statusNote: "IPR markers render in the CAD Engine; stage plan export (CSV) includes the IPR stage; IprSite model defined for per-site amounts.",
    surface: "CADEngine",
  },
  {
    id: "margin-drawing",
    name: "Margin Drawing",
    phase: "design",
    maturity: "planned",
    summary: "Draw and finalize restorative margin lines on the prepared tooth surface.",
    statusNote: "MarginLine/CurveOnMesh model defined; on-mesh curve drawing planned.",
    surface: null,
  },
  {
    id: "trimline-design",
    name: "Trimline Design",
    phase: "design",
    maturity: "planned",
    summary: "Define the gingival aligner trimline with a scalloped or straight cut offset.",
    statusNote: "Trimline model defined; interactive trimline editing planned.",
    surface: null,
  },
  {
    id: "attachment-placement",
    name: "Attachment Placement",
    phase: "design",
    maturity: "simulated",
    summary: "Place optimized and conventional attachments with shape and activation stage.",
    statusNote: "Attachments render in the CAD Engine; Attachment model supports shape/stage.",
    surface: "CADEngine",
  },
  {
    id: "button-placement",
    name: "Button Placement",
    phase: "design",
    maturity: "planned",
    summary: "Place cutouts, bonded buttons, and precision hooks for elastics.",
    statusNote: "ButtonPlacement model defined; placement interaction planned.",
    surface: null,
  },
  {
    id: "cross-sections",
    name: "Cross Sections",
    phase: "design",
    maturity: "implemented",
    summary: "Slice the model along arbitrary planes to inspect interproximal and root anatomy.",
    statusNote: "Live in CAD Engine: toggle + axis selector (X/Y/Z) + position slider. Clipping is applied to all tooth materials in real time.",
    surface: "CADEngine",
  },
  {
    id: "undercut-detection",
    name: "Undercut Detection",
    phase: "design",
    maturity: "planned",
    summary: "Detect undercuts against the path of insertion for reliable aligner seating.",
    statusNote: "UndercutRegion model defined; tooth–tooth collision exists, undercut analysis planned.",
    surface: null,
  },
  {
    id: "blockout-visualization",
    name: "Blockout Visualization",
    phase: "design",
    maturity: "planned",
    summary: "Visualize and fill undercut regions blocked out prior to thermoforming.",
    statusNote: "Depends on undercut detection; blockout overlay planned.",
    surface: null,
  },
  {
    id: "annotation-layering",
    name: "Annotation Layering",
    phase: "design",
    maturity: "planned",
    summary: "Layered clinical, lab, AI, and manufacturing annotations anchored to the mesh.",
    statusNote: "Annotation model with layers defined; anchored annotation UI planned.",
    surface: null,
  },
  {
    id: "manufacturing-preparation",
    name: "Manufacturing Preparation",
    phase: "manufacture",
    maturity: "simulated",
    summary: "Hollow, label, base, and watertight-check the model for printing.",
    statusNote: "ai-engine mesh hollow/label endpoint exists; ManufacturingPrep model surfaces status.",
    surface: "/manufacturing",
  },
  {
    id: "aligner-review",
    name: "Aligner Stage Review",
    phase: "manufacture",
    maturity: "implemented",
    summary: "Stage-by-stage review of cumulative tooth movements (mesial/distal/buccal/lingual/torque) across all 28 FDI arch teeth.",
    statusNote: "Fully wired in Phase 22: TreatmentPlansPanel stage chip strip + MovementTable. Stages generated via POST .../stages/generate with linear interpolation from crowding-based total movements. Persisted to aligner_stages table.",
    surface: "/treatment-plan",
  },
  {
    id: "export-workflow",
    name: "Export Workflow",
    phase: "export",
    maturity: "implemented",
    summary: "Generate a CAD package (movements, attachments, IPR) for printer or lab handoff.",
    statusNote: "Working in CAD Engine: exports a structured JSON CAD package today.",
    surface: "CADEngine",
  },
  {
    id: "bolton-analysis",
    name: "Bolton Analysis",
    phase: "plan",
    maturity: "simulated",
    summary: "Compute anterior (6:6) and overall (12:12) tooth-width discrepancy ratios.",
    statusNote: "Live in CAD Engine: editable tooth-width inputs compute anterior ratio vs. 77.2 ± 1.65% norm with clinical interpretation. Overall ratio uses the same inputs extended to first molars.",
    surface: "CADEngine",
  },
  {
    id: "precision-cut-designer",
    name: "Precision Cut Designer",
    phase: "design",
    maturity: "planned",
    summary: "Design precision-cut windows for button bonding and elastic attachment on aligner shells.",
    statusNote: "PrecisionCut model defined in lib/cad/models.ts; on-shell cut interaction planned.",
    surface: null,
  },
  {
    id: "pontic-designer",
    name: "Pontic Designer",
    phase: "design",
    maturity: "planned",
    summary: "Design pontic spaces in aligner arches for edentulous sites during orthodontic space management.",
    statusNote: "Pontic model defined; space-management interaction planned.",
    surface: null,
  },
  {
    id: "bite-ramp-designer",
    name: "Bite Ramp Designer",
    phase: "design",
    maturity: "planned",
    summary: "Add lingual bite ramps to upper aligners to open the bite and disengage posterior teeth.",
    statusNote: "BiteRamp model defined; ramp geometry tooling planned for the design phase.",
    surface: null,
  },
  // ─── Phase 19 additions ───────────────────────────────────────────────────
  {
    id: "cephalometric-analysis",
    name: "Cephalometric Analysis",
    phase: "review",
    maturity: "implemented",
    summary: "Manual landmark entry with SNA, SNB, ANB, Wits, FMA, IMPA + 7 more measurements against population norms.",
    statusNote: "Fully wired in Phase 19: CephalometricPanel.tsx POSTs to /api/cases/:id/ceph; PostgreSQL cephalometric_analyses table; skeletal class, vertical pattern, and growth pattern auto-classified from ANB/FMA/Facial Axis.",
    surface: "/cases/[id]#ceph",
  },
  {
    id: "photo-documentation",
    name: "Photo Documentation",
    phase: "review",
    maturity: "implemented",
    summary: "15-type standardised photo set: facial, intraoral, and radiographic records with before/after comparison.",
    statusNote: "Fully wired in Phase 19: PatientPhotosPanel.tsx with slot-based photo grid, lightbox, upload modal. REST CRUD via /api/cases/:id/photos backed by patient_photos table.",
    surface: "/cases/[id]#photos",
  },
  {
    id: "aligner-stage-persistence",
    name: "Aligner Stage Persistence",
    phase: "manufacture",
    maturity: "implemented",
    summary: "Per-stage tooth movement vectors, attachments, and IPR events stored in DB with doctor approval workflow.",
    statusNote: "Fully wired in Phase 19: aligner_stages table; POST /api/cases/:id/plans/:id/stages/generate auto-generates N stages with movement interpolation; PATCH .../approve writes approval signature.",
    surface: "/cases/[id]#plans",
  },
  {
    id: "surgical-implant-planning",
    name: "Surgical Implant Planning",
    phase: "plan",
    maturity: "implemented",
    summary: "Implant library with pitch/roll safety scoring, TAD root collision risk, and surgical guide STL export.",
    statusNote: "Fully wired in Phase 18: SurgicalPlanningPanel.tsx → /api/cases/:id/surgical/placements|tads|guides backed by PostgreSQL.",
    surface: "/cases/[id]#surgical",
  },
  // ─── Phase 22 additions ───────────────────────────────────────────────────
  {
    id: "biomechanics-engine",
    name: "Clinical Biomechanics Assessment",
    phase: "plan",
    maturity: "implemented",
    summary: "Per-stage movement-limit validation against accepted aligner biomechanics thresholds (Kravitz): translation, tip, torque, rotation, intrusion, extrusion. Adjacent-tooth collision detection.",
    statusNote: "Fully wired in Phase 22: BiomechanicsPanel → POST /api/cases/:id/plans/:id/biomechanics/assess. Rule engine with safe/warning/unsafe classification per FDI and stage. Anchorage, root-control, and difficulty scores. Findings stored in biomechanics_assessments table.",
    surface: "/treatment-plan",
  },
  {
    id: "attachment-planner",
    name: "Attachment Planner",
    phase: "design",
    maturity: "implemented",
    summary: "8 attachment types (vertical/horizontal rectangular, optimized, rotation, extrusion, root-control, retention, beveled) with AI auto-recommendation, per-tooth assignment, and clinician approval.",
    statusNote: "Fully wired in Phase 22: AttachmentPlanner panel → /api/cases/:id/plans/:id/attachments. Auto-recommend from final-stage movement data. CRUD + approve workflow. treatment_attachments table.",
    surface: "/treatment-plan",
  },
  {
    id: "ipr-planner",
    name: "IPR Planning & Safety",
    phase: "plan",
    maturity: "implemented",
    summary: "Interproximal reduction schedule with per-site amount (mm), timing by stage, enamel-thickness safety validation (Sheridan 0.5 mm minimum remaining), and AI auto-recommendation from crowding analysis.",
    statusNote: "Fully wired in Phase 22: IPRPlanner panel → /api/cases/:id/plans/:id/ipr. Safety status (safe/warning/unsafe) computed from per-tooth enamel thickness estimates. ipr_plan_items table. Auto-recommend from case_analyses crowding data.",
    surface: "/treatment-plan",
  },
  {
    id: "refinement-workflow",
    name: "Refinement Cycle Workflow",
    phase: "plan",
    maturity: "implemented",
    summary: "Mid-treatment refinement cycle tracking: stage restart, new scan linkage, status progression (pending → planning → stages_generated → approved), and cycle history.",
    statusNote: "Fully wired in Phase 22: RefinementPanel → /api/cases/:id/plans/:id/refinement. CRUD for cycles with status lifecycle. refinement_cycles table. Linked to scans table for new scan upload.",
    surface: "/treatment-plan",
  },
  {
    id: "workflow-pipeline",
    name: "Treatment Workflow Pipeline",
    phase: "plan",
    maturity: "implemented",
    summary: "Full-case pipeline visualization (Patient → Scan → Segment → Analysis → Plan → Biomechanics → Attachments → IPR → Stages → QA → Approval → Export) with step completion tracking.",
    statusNote: "Fully wired in Phase 22: WorkflowPipelineBar component, case_workflow_steps table. Progress bar and step-node UI. Integrated in TreatmentPlansPanel sub-tabs.",
    surface: "/treatment-plan",
  },
  // ─── Phase 21 additions ───────────────────────────────────────────────────
  {
    id: "ai-tooth-segmentation",
    name: "AI Tooth Segmentation",
    phase: "review",
    maturity: "implemented",
    summary: "Full-arch tooth detection with FDI/Universal numbering, confidence scoring, per-tooth corrections, and correction history.",
    statusNote: "Fully wired in Phase 21: AISegmentationCenter.tsx calls /api/cases/:id/segmentation/jobs. Supports external AI via AI_SEGMENTATION_URL env; falls back to deterministic FDI-chart rule engine. 13 correction types persisted to segmentation_corrections. Version history tracked per tooth.",
    surface: "/cases/[id]#segment",
  },
  {
    id: "ai-treatment-proposal",
    name: "AI Treatment Proposal",
    phase: "plan",
    maturity: "implemented",
    summary: "Clinical rule engine generates treatment stage count, IPR, attachment, anchorage, and expansion recommendations from Bolton ratios and crowding severity.",
    statusNote: "Fully wired in Phase 21: AIProposalPanel.tsx → /api/cases/:id/proposals/generate. Clinical rules: crowding-based stage count 14–26, Class II/III +4–6 stages, Bolton anterior < 73.9% triggers expansion recs, IPR for crowding > 2 mm. Clinician accept/reject with notes stored in DB.",
    surface: "/cases/[id]#proposal",
  },
  {
    id: "preexport-qa",
    name: "Pre-Export Quality Assurance",
    phase: "manufacture",
    maturity: "implemented",
    summary: "10-check pre-export validation: missing teeth, numbering, mesh integrity, wall thickness, attachment validity, trim continuity, occlusion, collision, printable geometry, stage consistency.",
    statusNote: "Fully wired in Phase 21: PreExportQAPanel.tsx → /api/cases/:id/preexport-qa/run. Each check returns pass/warning/fail with detail text. Clinician sign-off required; approvedAt stored in preexport_qa_reports.",
    surface: "/cases/[id]#export",
  },
  {
    id: "manufacturing-export",
    name: "Manufacturing Export Package",
    phase: "export",
    maturity: "implemented",
    summary: "Generate STL/OBJ/3MF/PLY/ZIP export packages for stage models, aligner shells, attachment templates, IBT, surgical guides, or full case bundles.",
    statusNote: "Fully wired in Phase 21: manufacturing-prep controller → /api/cases/:id/manufacture/exports. Deterministic file manifest generation by export type and stage count; job lifecycle tracked in manufacture_exports table.",
    surface: "/cases/[id]#export",
  },
  // ─── Phase 24 additions ───────────────────────────────────────────────────
  {
    id: "segmentation-mask-editor",
    name: "Segmentation Mask Editor",
    phase: "review",
    maturity: "implemented",
    summary: "Interactive per-tooth mask editing with 8 operations: brush, erase, grow, shrink, boundary smoothing, region grow, smart merge, smart split. Per-region type (crown/root/gingiva/implant/restoration/supernumerary), undo/redo, and full history stack.",
    statusNote: "Fully wired in Phase 24: SegmentationMaskEditor.tsx → /api/cases/:id/segmentation/jobs/:id/masks. Vertex-set operations stored in segmentation_masks; full history in segmentation_history. Confidence heatmap per tooth from getConfidenceHeatmap endpoint.",
    surface: "/cases/[id]#segment",
  },
  {
    id: "segmentation-job-monitor",
    name: "Segmentation Job Queue Monitor",
    phase: "review",
    maturity: "implemented",
    summary: "Real-time segmentation job queue with progress bars, model type display (MONAI/nnU-Net/ONNX/PyTorch/CPU), GPU acceleration toggle, auto-polling during active jobs, and result summary (teeth found, avg confidence).",
    statusNote: "Fully wired in Phase 24: SegmentationJobMonitor.tsx → /api/cases/:id/segmentation/jobs. 3-second polling during processing state. GPU request flag and ONNX model path stored per job. Job history with duration tracking.",
    surface: "/cases/[id]#segment",
  },
  {
    id: "segmentation-confidence-heatmap",
    name: "Segmentation Confidence Heatmap",
    phase: "review",
    maturity: "implemented",
    summary: "Per-tooth confidence visualization as a color-coded FDI grid (red < 75%, amber 75–90%, green ≥ 90%) with per-region heatmap breakdowns. Loaded on mask editor open.",
    statusNote: "Fully wired in Phase 24: /api/cases/:id/segmentation/jobs/:id/heatmap. Aggregates confidence scores from segmentation_masks.confidence_heatmap JSONB column. Missing teeth shown as grey. Drives tooth selection priority for manual correction.",
    surface: "/cases/[id]#segment",
  },
  // ─── Phase 25 additions ───────────────────────────────────────────────────
  {
    id: "auto-segmentation-analysis",
    name: "Automated Segmentation Analysis",
    phase: "review",
    maturity: "implemented",
    summary: "10-class deterministic issue detector: low confidence, missing tooth, sparse mask, no gingival margin, adjacent collision, arch imbalance, surface area anomaly, volume anomaly, supernumerary unclassified, impacted unlabeled. Mesh validity score 0–100% derived from issue distribution.",
    statusNote: "Fully wired in Phase 25: AutoCorrectionService.analyzeJob → POST /api/cases/:id/segmentation/jobs/:id/analyze. Stores report in auto_correction_reports + items in auto_correction_items. Re-analyze deletes and recreates the report. Analysis runs in <200ms.",
    surface: "/cases/[id]#segment",
  },
  {
    id: "one-click-segmentation-repair",
    name: "One-Click Segmentation Repair",
    phase: "review",
    maturity: "implemented",
    summary: "Automated repair of 7 auto-fixable issue types: boundary smoothing for low confidence, region grow for sparse/volume issues, gingival brush for missing margins, shrink for large-surface collisions. Grouped repair-all or per-item repair with detailed repair receipts.",
    statusNote: "Fully wired in Phase 25: SegmentationAutoCorrector.tsx → repair-all and per-item endpoints. Repairs write to segmentation_masks and segmentation_corrections for full audit trail. Manual-only issues (missing teeth, arch imbalance) are clearly marked and excluded from auto-repair.",
    surface: "/cases/[id]#segment",
  },
];

export function capabilitiesByPhase(phase: CapabilityPhase): CadCapability[] {
  return CAD_CAPABILITIES.filter((c) => c.phase === phase);
}

export function maturityCounts(): Record<CapabilityMaturity, number> {
  return CAD_CAPABILITIES.reduce(
    (acc, c) => {
      acc[c.maturity] += 1;
      return acc;
    },
    { implemented: 0, simulated: 0, planned: 0 } as Record<CapabilityMaturity, number>,
  );
}
