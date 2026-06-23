/**
 * Extended CAD roadmap registry.
 *
 * This extends the base CadCapability model with stakeholder, risk, and
 * validation fields required for the professional capability roadmap view.
 * It re-exports all base capabilities plus adds the new roadmap-only entries
 * for capabilities beyond what capabilities.ts covers.
 *
 * Maturity rules (same as capabilities.ts):
 *   "implemented"  — working interaction in the app today
 *   "simulated"    — realistic UI; representative data; not a validated engine
 *   "planned"      — model/seam defined; interaction not yet built
 *
 * NEVER label planned features as implemented.
 */

import { CAD_CAPABILITIES, type CadCapability, type CapabilityMaturity, type CapabilityPhase } from "./capabilities";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface RoadmapCapability extends CadCapability {
  /** Who benefits from this capability. */
  stakeholderValue: string;
  /** What inputs are required to use this capability. */
  requiredInputs: string[];
  /** What the capability produces. */
  output: string;
  /** Clinical risk if output is used without clinician review. */
  clinicalRisk: RiskLevel;
  /** What validation is needed before clinical use. */
  validationRequirement: string;
}

const RISK_META: Record<RiskLevel, { label: string; tone: "success" | "info" | "warning" | "danger" }> = {
  low:      { label: "Low",      tone: "success" },
  medium:   { label: "Medium",   tone: "info"    },
  high:     { label: "High",     tone: "warning" },
  critical: { label: "Critical", tone: "danger"  },
};

export { RISK_META };

// Supplement base capabilities with roadmap metadata
const ROADMAP_SUPPLEMENTS: Record<string, Partial<RoadmapCapability>> = {
  "case-review": {
    stakeholderValue: "Orthodontist, Clinical Director — structured review before entering planning",
    requiredInputs: ["Uploaded STL/PLY/OBJ", "Patient demographics", "Chief complaint"],
    output: "Case review summary with malocclusion class, urgency, and next step",
    clinicalRisk: "low",
    validationRequirement: "Clinician must confirm findings before proceeding to treatment planning",
  },
  "arch-analysis": {
    stakeholderValue: "Orthodontist, Resident — quantified arch measurements for diagnosis",
    requiredInputs: ["Segmented dental model", "Landmark positions"],
    output: "Arch width, length, intercanine/intermolar distances, curve of Spee index",
    clinicalRisk: "medium",
    validationRequirement: "Automated measurements require clinician review; landmarks may require correction",
  },
  "occlusal-analysis": {
    stakeholderValue: "Orthodontist — precision contact mapping for occlusal planning",
    requiredInputs: ["Upper and lower arch STL", "Occlusal registration"],
    output: "Per-tooth contact map with penetration depth and clearance values",
    clinicalRisk: "high",
    validationRequirement: "Full validation against physical occlusal analysis required before clinical adoption",
  },
  "clinical-measurements": {
    stakeholderValue: "Orthodontist, Resident, Lab Technician — real on-mesh dimensional data",
    requiredInputs: ["Any imported 3D model (STL/PLY/OBJ)"],
    output: "Distance, angle, overjet, overbite values with CSV export",
    clinicalRisk: "low",
    validationRequirement: "Measurements are user-placed; accuracy depends on correct landmark selection",
  },
  "treatment-planning": {
    stakeholderValue: "Orthodontist — structured planning from diagnosis to appliance prescription",
    requiredInputs: ["Approved case", "Target occlusion goals"],
    output: "Stage-by-stage treatment plan with movement targets and IPR schedule",
    clinicalRisk: "high",
    validationRequirement: "All plans require orthodontist review and approval before manufacturing release",
  },
  "movement-vectors": {
    stakeholderValue: "Orthodontist, Digital Designer — precise tooth movement prescription",
    requiredInputs: ["Segmented tooth models", "Treatment goals"],
    output: "Per-tooth 6-DoF transformation with PDL limit validation",
    clinicalRisk: "high",
    validationRequirement: "PDL limits are reference values; biomechanical validation by clinician required",
  },
  "ipr-planning": {
    stakeholderValue: "Orthodontist — controlled space creation without extraction",
    requiredInputs: ["Bolton analysis results", "Crowding assessment"],
    output: "IPR site list with amounts, stripping tools, and stage timing",
    clinicalRisk: "high",
    validationRequirement: "IPR amounts must be reviewed by treating orthodontist; irreversible procedure",
  },
  "bolton-analysis": {
    stakeholderValue: "Orthodontist — identify tooth-size discrepancies before prescribing movements",
    requiredInputs: ["Tooth width measurements (manual or segmented)"],
    output: "Anterior 6:6 and overall 12:12 Bolton ratios with clinical interpretation",
    clinicalRisk: "medium",
    validationRequirement: "Tooth widths require clinician verification; automated measurement is decision support only",
  },
  "attachment-placement": {
    stakeholderValue: "Orthodontist, Digital Designer — retention force for complex movements",
    requiredInputs: ["Treatment plan", "Movement vectors", "Stage count"],
    output: "Attachment position, shape, and activation stage per tooth",
    clinicalRisk: "medium",
    validationRequirement: "Placement must be approved by prescribing orthodontist",
  },
  "cross-sections": {
    stakeholderValue: "Orthodontist, Lab Technician — inspect internal anatomy and interproximal contacts",
    requiredInputs: ["Any imported 3D model"],
    output: "Real-time cross-section view with adjustable plane and position",
    clinicalRisk: "low",
    validationRequirement: "Visualization aid; no clinical decision output",
  },
  "manufacturing-preparation": {
    stakeholderValue: "Lab Technician, Lab Manager — print-ready model output",
    requiredInputs: ["Approved treatment plan", "Printer profile"],
    output: "Hollowed, labelled, watertight mesh with nesting instructions",
    clinicalRisk: "medium",
    validationRequirement: "Output requires QC check before physical thermoforming",
  },
  "export-workflow": {
    stakeholderValue: "All roles — structured handoff package for lab or external lab",
    requiredInputs: ["Completed and approved CAD session"],
    output: "JSON CAD package with movements, attachments, IPR, and stage timeline",
    clinicalRisk: "low",
    validationRequirement: "Package must be validated on receipt by lab; format is proprietary",
  },
};

// Extended capabilities — planned items not yet in base capabilities.ts
const ROADMAP_ONLY: RoadmapCapability[] = [
  {
    id: "occlusal-heatmap",
    name: "Occlusal Heatmap",
    phase: "design",
    maturity: "planned",
    summary: "Colour-coded contact intensity map showing occlusal load distribution at each aligner stage.",
    statusNote: "Depends on occlusal-analysis; heatmap rendering and stage-animation planned.",
    surface: null,
    stakeholderValue: "Orthodontist, Clinical Director — visual occlusal assessment at each stage",
    requiredInputs: ["Upper and lower arch models", "Bite registration", "Stage-wise movement data"],
    output: "Per-stage heatmap overlay with penetration depth spectrum",
    clinicalRisk: "medium",
    validationRequirement: "Heatmap values require validation against articulator measurements",
  },
  {
    id: "contact-mapping",
    name: "Contact Mapping",
    phase: "review",
    maturity: "planned",
    summary: "Per-tooth contact point identification with occlusal contact sequence analysis.",
    statusNote: "Model defined; contact computation and UI planned after occlusal-analysis lands.",
    surface: null,
    stakeholderValue: "Orthodontist — identify premature contacts and interferences",
    requiredInputs: ["Segmented upper and lower arches", "Occlusal registration"],
    output: "Contact point list with sequence and intensity per tooth",
    clinicalRisk: "high",
    validationRequirement: "Clinical validation required; compare to T-Scan or articulator data",
  },
  {
    id: "root-aware-movement",
    name: "Root-Aware Movement Simulation",
    phase: "plan",
    maturity: "planned",
    summary: "Simulate tooth movements including root position to predict root resorption risk and bone clearance.",
    statusNote: "Requires CBCT-derived root models; simulation engine and risk model planned.",
    surface: null,
    stakeholderValue: "Orthodontist, Clinical Director — reduce iatrogenic root resorption risk",
    requiredInputs: ["CBCT-derived root models", "Planned movement vectors", "Bone level data"],
    output: "Root position per stage, clearance warnings, resorption risk score",
    clinicalRisk: "critical",
    validationRequirement: "Must be validated against CBCT in longitudinal clinical trials before clinical use",
  },
  {
    id: "ai-segmentation",
    name: "AI Segmentation",
    phase: "review",
    maturity: "planned",
    summary: "Automated per-tooth segmentation of intraoral scans using a trained deep learning model.",
    statusNote: "ai-engine segmentation endpoint exists with MONAI backbone; model not yet trained on sufficient clinical data for production use.",
    surface: "/ai-analysis",
    stakeholderValue: "Orthodontist, Lab Technician — eliminate manual segmentation (hours → seconds)",
    requiredInputs: ["Full-arch intraoral scan (STL)", "Arch type (upper/lower)"],
    output: "Per-tooth segmented mesh with tooth ID labels and confidence scores",
    clinicalRisk: "high",
    validationRequirement: "Segmentation results must be reviewed and corrected by a trained technician before use in treatment planning",
  },
  {
    id: "ai-landmark-detection",
    name: "AI Landmark Detection",
    phase: "review",
    maturity: "planned",
    summary: "Automated detection of cephalometric and dental landmarks for arch analysis and movement planning.",
    statusNote: "Endpoint seam exists; landmark model not yet trained on annotated clinical data.",
    surface: "/ai-analysis",
    stakeholderValue: "Orthodontist, Resident — reduce manual landmark identification time",
    requiredInputs: ["Digital model or CBCT", "Arch orientation"],
    output: "Landmark coordinates with confidence intervals per point",
    clinicalRisk: "high",
    validationRequirement: "Automated landmarks require manual verification; accuracy must be validated against expert annotation",
  },
  {
    id: "auto-setup-proposal",
    name: "Auto Setup Proposal",
    phase: "plan",
    maturity: "planned",
    summary: "AI-generated initial treatment setup proposal based on malocclusion class and treatment goals.",
    statusNote: "Depends on AI segmentation and landmark detection; proposal engine not yet built.",
    surface: null,
    stakeholderValue: "Orthodontist — starting point for treatment planning, not a replacement",
    requiredInputs: ["Segmented models", "Detected landmarks", "Treatment goals input"],
    output: "Proposed movement vectors and staging sequence for clinician review",
    clinicalRisk: "critical",
    validationRequirement: "All proposals must be reviewed and approved by the prescribing orthodontist. This is decision support, not autonomous treatment planning.",
  },
  {
    id: "refinement-prediction",
    name: "Refinement Prediction",
    phase: "plan",
    maturity: "planned",
    summary: "Predict likelihood of refinement stages needed based on case complexity and movement profile.",
    statusNote: "Outcome data model defined; prediction model requires clinical outcome dataset.",
    surface: null,
    stakeholderValue: "Orthodontist, Practice Owner — set realistic patient expectations and plan capacity",
    requiredInputs: ["Initial case data", "Treatment plan", "Historical outcome data"],
    output: "Refinement probability score with confidence range and key risk factors",
    clinicalRisk: "medium",
    validationRequirement: "Probability output requires validation against a representative clinical cohort",
  },
  {
    id: "trimline-design",
    name: "Trimline Design",
    phase: "design",
    maturity: "planned",
    summary: "Define the gingival aligner trimline with a scalloped or straight cut offset.",
    statusNote: "Trimline model defined; interactive trimline editing planned.",
    surface: null,
    stakeholderValue: "Lab Technician, Digital Designer — precise aligner boundary definition",
    requiredInputs: ["Full arch model", "Gingival margin position"],
    output: "Trimline curve on mesh, exportable for CNC or laser cutting",
    clinicalRisk: "medium",
    validationRequirement: "Lab review of trimline before physical production",
  },
  {
    id: "margin-drawing",
    name: "Margin Drawing",
    phase: "design",
    maturity: "planned",
    summary: "Draw and finalize restorative margin lines on the prepared tooth surface.",
    statusNote: "MarginLine/CurveOnMesh model defined; on-mesh curve drawing planned.",
    surface: null,
    stakeholderValue: "Lab Technician — digital margin definition for crown or veneer cases",
    requiredInputs: ["Prepared tooth scan"],
    output: "Margin curve on mesh with export to CAM system",
    clinicalRisk: "high",
    validationRequirement: "Margin must be verified by lab supervisor before milling",
  },
  {
    id: "undercut-detection",
    name: "Undercut Detection",
    phase: "design",
    maturity: "planned",
    summary: "Detect undercuts against the path of insertion for reliable aligner seating.",
    statusNote: "UndercutRegion model defined; tooth–tooth collision exists, undercut analysis planned.",
    surface: null,
    stakeholderValue: "Lab Technician, Digital Designer — prevent aligner seating problems",
    requiredInputs: ["Full arch model", "Path of insertion direction"],
    output: "Undercut region highlight with severity and blockout recommendation",
    clinicalRisk: "low",
    validationRequirement: "Physical try-in remains the gold standard; digital detection is a pre-check",
  },
  {
    id: "blockout-visualization",
    name: "Blockout Visualization",
    phase: "design",
    maturity: "planned",
    summary: "Visualize and fill undercut regions blocked out prior to thermoforming.",
    statusNote: "Depends on undercut detection; blockout overlay planned.",
    surface: null,
    stakeholderValue: "Lab Technician — prevent voids and tears in thermoformed aligners",
    requiredInputs: ["Undercut detection results"],
    output: "Blockout fill visualization with virtual model preview",
    clinicalRisk: "low",
    validationRequirement: "Visual confirmation by lab technician required",
  },
  {
    id: "button-placement",
    name: "Button & Hook Placement",
    phase: "design",
    maturity: "planned",
    summary: "Place cutouts, bonded buttons, and precision hooks for elastics.",
    statusNote: "ButtonPlacement model defined; placement interaction planned.",
    surface: null,
    stakeholderValue: "Lab Technician, Digital Designer — elastic attachment and ancillary appliance integration",
    requiredInputs: ["Aligner shell model", "Treatment plan"],
    output: "Button/hook positions with cutout geometry for printing",
    clinicalRisk: "medium",
    validationRequirement: "Positions must be reviewed by prescribing orthodontist",
  },
];

// Merge base capabilities with roadmap metadata
export const ROADMAP_CAPABILITIES: RoadmapCapability[] = [
  // Base capabilities supplemented with roadmap metadata
  ...CAD_CAPABILITIES.map(cap => ({
    ...cap,
    stakeholderValue: ROADMAP_SUPPLEMENTS[cap.id]?.stakeholderValue ?? "Clinical and lab teams",
    requiredInputs:   ROADMAP_SUPPLEMENTS[cap.id]?.requiredInputs   ?? ["3D dental model"],
    output:           ROADMAP_SUPPLEMENTS[cap.id]?.output           ?? "See capability summary",
    clinicalRisk:     (ROADMAP_SUPPLEMENTS[cap.id]?.clinicalRisk    ?? "medium") as RiskLevel,
    validationRequirement: ROADMAP_SUPPLEMENTS[cap.id]?.validationRequirement ?? "Clinician review required",
  } as RoadmapCapability)),
  // Roadmap-only capabilities not yet in base registry
  ...ROADMAP_ONLY,
];

export function roadmapByPhase(phase: CapabilityPhase): RoadmapCapability[] {
  return ROADMAP_CAPABILITIES.filter(c => c.phase === phase);
}

export function roadmapByMaturity(maturity: CapabilityMaturity): RoadmapCapability[] {
  return ROADMAP_CAPABILITIES.filter(c => c.maturity === maturity);
}

export function roadmapCounts(): Record<CapabilityMaturity, number> {
  return ROADMAP_CAPABILITIES.reduce(
    (acc, c) => { acc[c.maturity]++; return acc; },
    { implemented: 0, simulated: 0, planned: 0 } as Record<CapabilityMaturity, number>,
  );
}
