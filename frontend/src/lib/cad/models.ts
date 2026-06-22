/**
 * Typed clinical CAD data models for the MyOrtho Dental CAD Studio.
 *
 * These are the canonical shapes the planning, design, and manufacturing
 * workflows read and write. They are intentionally backend-agnostic: the
 * adapter seam in `lib/data/*` is responsible for persistence (Supabase /
 * NestJS) once those integrations land.
 *
 * NOTHING here fabricates clinical AI output. Where a model represents data
 * that would normally be produced by an engine that is not yet wired up, the
 * value is simply absent (null / empty) rather than faked.
 */

/** FDI two-digit tooth notation (e.g. 11 = upper right central incisor). */
export type FdiNumber = number;

export type ArchType = "maxillary" | "mandibular";

/** A 3D point in scan/model space (millimetres). */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ─── Case review ────────────────────────────────────────────────────────────

export interface CaseReviewSummary {
  caseId: string;
  patientRef: string;
  malocclusionClass: "I" | "II-div1" | "II-div2" | "III" | null;
  crowdingMm: { maxillary: number | null; mandibular: number | null };
  chiefComplaint: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
}

// ─── Margin & trimline (restorative + aligner) ──────────────────────────────

/** An ordered polyline of points defining a margin or trimline on a mesh. */
export interface CurveOnMesh {
  id: string;
  fdi: FdiNumber | null;
  points: Vec3[];
  closed: boolean;
  /** True once the clinician has explicitly accepted the curve. */
  finalized: boolean;
}

export interface MarginLine extends CurveOnMesh {
  kind: "margin";
  /** Restorative margin depth offset in mm, if applied. */
  offsetMm: number | null;
}

export interface Trimline extends CurveOnMesh {
  kind: "trimline";
  /** Gingival scallop offset for the aligner cut, in mm. */
  scallopMm: number;
}

// ─── Attachments & buttons ──────────────────────────────────────────────────

export type AttachmentShape =
  | "horizontal-rectangular"
  | "vertical-rectangular"
  | "optimized-rotation"
  | "optimized-extrusion"
  | "bevel-ellipsoid";

export interface Attachment {
  id: string;
  fdi: FdiNumber;
  shape: AttachmentShape;
  /** Local placement on the crown surface. */
  position: Vec3;
  /** Aligner stage at which the attachment is bonded. */
  activationStage: number;
}

export type ButtonType = "cutout" | "bonded-button" | "precision-hook";

export interface ButtonPlacement {
  id: string;
  fdi: FdiNumber;
  type: ButtonType;
  position: Vec3;
  /** Elastic configuration this button anchors, if any. */
  elasticClass: string | null;
}

// ─── IPR (interproximal reduction) ──────────────────────────────────────────

export interface IprSite {
  id: string;
  /** Contact is between `mesialFdi` and `distalFdi`. */
  mesialFdi: FdiNumber;
  distalFdi: FdiNumber;
  amountMm: number;
  /** Stage before which the reduction must be performed. */
  performBeforeStage: number;
}

// ─── Movement vectors ───────────────────────────────────────────────────────

export interface MovementVector {
  fdi: FdiNumber;
  /** Net translation across the whole plan, mm. */
  translation: Vec3;
  /** Net rotation across the whole plan, degrees (Euler XYZ). */
  rotation: Vec3;
  /** True if any per-stage step exceeds biomechanical limits. */
  exceedsLimit: boolean;
}

// ─── Arch & occlusal analysis ───────────────────────────────────────────────

export interface ArchAnalysis {
  arch: ArchType;
  archLengthMm: number | null;
  archWidthIntercanineMm: number | null;
  archWidthIntermolarMm: number | null;
  curveOfSpeeMm: number | null;
  symmetryIndex: number | null;
}

export interface OcclusalContact {
  fdi: FdiNumber;
  /** Penetration/clearance vs antagonist, mm (negative = clearance). */
  intensityMm: number;
  position: Vec3;
}

// ─── Cross sections ─────────────────────────────────────────────────────────

export interface CrossSectionPlane {
  id: string;
  /** Plane origin and normal in model space. */
  origin: Vec3;
  normal: Vec3;
  label: string;
}

// ─── Undercut & blockout ────────────────────────────────────────────────────

export interface UndercutRegion {
  fdi: FdiNumber;
  /** Path-of-insertion the undercut was evaluated against. */
  insertionAxis: Vec3;
  severityMm: number;
  /** True once filled in the blockout pass. */
  blockedOut: boolean;
}

// ─── Annotation ─────────────────────────────────────────────────────────────

export type AnnotationLayer = "clinical" | "lab" | "ai" | "manufacturing";

export interface Annotation {
  id: string;
  layer: AnnotationLayer;
  fdi: FdiNumber | null;
  anchor: Vec3;
  text: string;
  authorId: string;
  createdAt: string;
}

// ─── Clinical measurements ──────────────────────────────────────────────────

export type MeasurementKind = "distance" | "angle" | "tooth-width" | "overjet" | "overbite";

export interface ClinicalMeasurement {
  id: string;
  kind: MeasurementKind;
  value: number;
  unit: "mm" | "deg";
  points: Vec3[];
  label: string | null;
}

// ─── Manufacturing preparation ──────────────────────────────────────────────

export interface ManufacturingPrep {
  designId: string;
  hollowed: boolean;
  wallThicknessMm: number | null;
  engravedLabel: string | null;
  baseAdded: boolean;
  /** Watertight check result from the mesh engine, if it has run. */
  watertight: boolean | null;
}

// ─── Aligner review ─────────────────────────────────────────────────────────

export interface AlignerStage {
  index: number;
  movements: MovementVector[];
  iprSites: IprSite[];
  attachmentsActive: FdiNumber[];
}

export interface AlignerPlan {
  designId: string;
  stages: AlignerStage[];
  overcorrectionStages: number;
  estimatedRefinements: number;
}

// ─── Export ─────────────────────────────────────────────────────────────────

export type ExportTarget = "in-house-printer" | "external-lab" | "archive";

export interface ExportManifest {
  designId: string;
  target: ExportTarget;
  includesStl: boolean;
  includesAttachments: boolean;
  includesIprSheet: boolean;
  generatedAt: string;
}
