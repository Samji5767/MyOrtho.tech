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
    maturity: "simulated",
    summary: "Define target occlusion and sequence tooth movements toward the planned result.",
    statusNote: "Treatment plan timeline page exists; planning state is representative.",
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
    name: "Aligner Review",
    phase: "manufacture",
    maturity: "simulated",
    summary: "Stage-by-stage review of movements, IPR, and active attachments per aligner.",
    statusNote: "Stage preview exists; AlignerPlan/AlignerStage models define per-stage data.",
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
