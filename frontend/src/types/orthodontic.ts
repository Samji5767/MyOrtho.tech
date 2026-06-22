// Comprehensive orthodontic data models for MyOrtho.tech — all 11 platform phases.
// All enums and interfaces are designed for clinical accuracy using FDI World Dental Federation notation.

// ─── Roles & Permissions (Phase 10) ──────────────────────────────────────────

export type OrthoRole =
  | 'super_admin'
  | 'clinic_admin'
  | 'orthodontist'
  | 'dentist'
  | 'treatment_planner'
  | 'lab_technician'
  | 'reviewer'
  | 'read_only';

export interface OrthoUser {
  id: string;
  email: string;
  fullName: string;
  role: OrthoRole;
  clinicId: string;
  clinicName: string;
  organizationId?: string;
  avatarInitials: string;
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
}

export interface Clinic {
  id: string;
  name: string;
  organizationId?: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  licenseNumber?: string;
  activeCases: number;
  totalPatients: number;
  isActive: boolean;
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  logoUrl?: string;
  clinics: Clinic[];
  subscriptionTier: 'starter' | 'professional' | 'enterprise';
  region: string;
  createdAt: string;
}

// ─── Patient Demographics (Phase 2) ──────────────────────────────────────────

export type Gender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-' | 'unknown';

export interface PatientDemographics {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: number;
  gender: Gender;
  phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  insuranceId?: string;
  referredBy?: string;
}

export interface ClinicalInfo {
  orthodontistId: string;
  orthodontistName: string;
  clinicId: string;
  clinicName: string;
  chiefComplaint: string;
  diagnosis: string;
  angleClassification: 'Class I' | 'Class II Div 1' | 'Class II Div 2' | 'Class III';
  skeletalPattern: 'I' | 'II' | 'III';
  overjet: number; // mm
  overbite: number; // mm
  crowdingUpper: number; // mm
  crowdingLower: number; // mm
  medicalHistory?: string;
  allergies?: string[];
  medications?: string[];
  treatmentStatus: 'consultation' | 'active' | 'retention' | 'completed' | 'discontinued';
  startDate?: string;
  estimatedEndDate?: string;
  notes?: string;
}

export interface PatientRecord {
  id: string;
  patientId: string;
  type: 'photo' | 'stl' | 'cbct' | 'xray' | 'treatment_plan' | 'consent' | 'document';
  fileName: string;
  fileSize: number;
  url?: string;
  uploadedBy: string;
  uploadedAt: string;
  notes?: string;
  tags: string[];
}

export interface PatientTimelineEvent {
  id: string;
  patientId: string;
  caseId?: string;
  eventType:
    | 'consultation'
    | 'scan_upload'
    | 'segmentation'
    | 'plan_generated'
    | 'approval'
    | 'manufacturing'
    | 'delivery'
    | 'refinement'
    | 'appointment'
    | 'note'
    | 'payment';
  title: string;
  description: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, string>;
}

export interface EnterprisePatient {
  demographics: PatientDemographics;
  clinicalInfo: ClinicalInfo;
  records: PatientRecord[];
  timeline: PatientTimelineEvent[];
  activeCaseId?: string;
  treatmentProgress: number; // 0-100
}

// ─── Scan Processing (Phase 3) ────────────────────────────────────────────────

export type ScanFormat = 'stl' | 'ply' | 'obj' | 'dcm' | 'cbct';
export type ScanIntegration = 'iTero' | 'Medit' | '3Shape TRIOS' | 'Carestream' | 'Shining3D' | 'manual';

export type ScanQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'invalid';
export type ScanStatus = 'queued' | 'uploading' | 'validating' | 'processing' | 'complete' | 'error' | 'review_needed';

export interface ScanValidationResult {
  isWatertight: boolean;
  triangleCount: number;
  vertexCount: number;
  surfaceAreaMm2: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  holeCount: number;
  invertedNormals: number;
  nonManifoldEdges: number;
  qualityScore: ScanQuality;
  warnings: string[];
  errors: string[];
}

export interface ScanItem {
  id: string;
  caseId: string;
  patientName: string;
  fileName: string;
  fileSize: number;
  format: ScanFormat;
  source: ScanIntegration;
  status: ScanStatus;
  progress: number;
  validation?: ScanValidationResult;
  uploadedAt: string;
  uploadedBy: string;
}

// ─── Segmentation (Phase 4) ───────────────────────────────────────────────────

export type ToothClass =
  | 'central_incisor'
  | 'lateral_incisor'
  | 'canine'
  | 'first_premolar'
  | 'second_premolar'
  | 'first_molar'
  | 'second_molar'
  | 'third_molar';

export type Arch = 'maxillary' | 'mandibular';

export interface ToothSegment {
  fdi: number;
  arch: Arch;
  toothClass: ToothClass;
  confidence: number; // 0-100
  isPresent: boolean;
  isMissing: boolean;
  isExtracted: boolean;
  hasRootFlag: boolean;
  hasGingivaWarning: boolean;
  contactPoints: number;
  crownFaces: number;
  archWidthMm: number;
  iprMm?: number;
  attachments: string[];
  position: { x: number; y: number; z: number };
}

export interface OcclusalLandmark {
  id: string;
  type: 'cusp' | 'incisal_edge' | 'contact_point' | 'fossa' | 'marginal_ridge';
  fdi: number;
  coordinates: { x: number; y: number; z: number };
  confidence: number;
}

export interface SegmentationResult {
  id: string;
  caseId: string;
  scanId: string;
  status: 'pending' | 'processing' | 'complete' | 'failed' | 'review_needed';
  overallConfidence: number;
  teeth: ToothSegment[];
  landmarks: OcclusalLandmark[];
  occlusalPlane: { a: number; b: number; c: number; d: number }; // plane equation
  midlineDeviation: number; // mm, positive = right
  arch: {
    upperWidth: number;
    lowerWidth: number;
    overjet: number;
    overbite: number;
  };
  processingTimeMs: number;
  reviewNotes?: string;
  reviewedBy?: string;
  createdAt: string;
}

// ─── Treatment Planning (Phase 6) ────────────────────────────────────────────

export type MovementType = 'translation' | 'rotation' | 'torque' | 'tipping' | 'extrusion' | 'intrusion';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revision_requested';

export interface ToothMovement {
  fdi: number;
  type: MovementType;
  mesialDistal: number; // mm
  buccalLingual: number; // mm
  extrusionIntrusion: number; // mm
  rotation: number; // degrees
  torque: number; // degrees
  tipping: number; // degrees
}

export interface PlanStage {
  stageNumber: number;
  movements: ToothMovement[];
  attachments: { fdi: number; type: string }[];
  iprEvents: { fdi: number; amountMm: number; surface: 'mesial' | 'distal' }[];
  maxMovementMm: number;
  isActive: boolean;
  isComplete: boolean;
  clinicianNote?: string;
  trackingScore?: number; // 0-100, from scan comparison
}

export interface TreatmentPlanData {
  id: string;
  caseId: string;
  patientName: string;
  orthodontistId: string;
  orthodontistName: string;
  complexityScore: number; // 1-10
  estimatedDurationWeeks: number;
  totalStages: number;
  stages: PlanStage[];
  totalIPRMm: number;
  totalAttachments: number;
  refinementProbability: number; // 0-100%
  doctorApproval: ApprovalStatus;
  internalApproval: ApprovalStatus;
  labApproval: ApprovalStatus;
  doctorNote?: string;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  version: number;
}

// ─── Manufacturing Operations (Phase 8) ──────────────────────────────────────

export type ProductionStatus =
  | 'queued'
  | 'printing'
  | 'washing'
  | 'curing'
  | 'qc_inspection'
  | 'packaging'
  | 'shipping'
  | 'completed'
  | 'failed';

export type PrinterModel = 'Formlabs Form 3B+' | 'SprintRay Pro 95' | 'Carbon M2' | 'Stratasys J5 DentaJet' | 'DWS XPRO S';

export interface Printer {
  id: string;
  name: string;
  model: PrinterModel;
  status: 'idle' | 'printing' | 'offline' | 'error' | 'maintenance';
  utilizationPct: number;
  currentJobId?: string;
  currentJobProgress?: number;
  queuedJobs: number;
  totalPrintsToday: number;
  successRateToday: number;
  lastMaintenanceDate: string;
  materialLevel: number; // % remaining
}

export interface ProductionJob {
  id: string;
  batchLabel: string;
  caseId: string;
  patientName: string;
  stageRange: string; // e.g. "1-5"
  alignerCount: number;
  status: ProductionStatus;
  printerId?: string;
  printerName?: string;
  priority: 'urgent' | 'high' | 'normal';
  startedAt?: string;
  estimatedCompleteAt?: string;
  completedAt?: string;
  slaRisk: boolean;
  resinType: string;
  resinVolumeMl: number;
  qcScore?: number;
  failureReason?: string;
  createdAt: string;
}

export interface MaterialInventory {
  id: string;
  resinType: string;
  colorCode: string;
  manufacturer: string;
  lotNumber: string;
  openedDate?: string;
  expiryDate: string;
  remainingMl: number;
  totalMl: number;
  usagePercentage: number;
  costPerMl: number;
  isLowStock: boolean;
}

// ─── Quality Control (Phase 9) ────────────────────────────────────────────────

export type QCStatus = 'pending' | 'pass' | 'fail' | 'conditional_pass' | 'rework_required';

export interface QCCheck {
  id: string;
  checkType:
    | 'print_quality'
    | 'model_integrity'
    | 'thickness_verification'
    | 'fit_verification'
    | 'surface_finish'
    | 'dimensional_accuracy'
    | 'material_compliance';
  label: string;
  status: QCStatus;
  measuredValue?: string;
  expectedRange?: string;
  tolerance?: string;
  notes?: string;
  inspectorId?: string;
  inspectedAt?: string;
}

export interface QCReport {
  id: string;
  jobId: string;
  batchLabel: string;
  patientName: string;
  caseId: string;
  overallStatus: QCStatus;
  checks: QCCheck[];
  inspectorId: string;
  inspectorName: string;
  inspectedAt: string;
  approvedForShipping: boolean;
  auditNotes?: string;
  photosAttached: number;
}

export interface AuditLogEntry {
  id: string;
  entityType: 'case' | 'scan' | 'plan' | 'production_job' | 'qc_report' | 'patient' | 'user';
  entityId: string;
  action: string;
  actorId: string;
  actorName: string;
  actorRole: OrthoRole;
  timestamp: string;
  ipAddress?: string;
  details?: Record<string, string>;
}

// ─── AI Copilot (Phase 7) ─────────────────────────────────────────────────────

export type BiteClassification = 'Class I' | 'Class II Div 1' | 'Class II Div 2' | 'Class III';

export interface CaseAnalysis {
  caseId: string;
  crowdingUpperMm: number;
  crowdingLowerMm: number;
  spacingUpperMm: number;
  spacingLowerMm: number;
  biteClassification: BiteClassification;
  overjet: number;
  overbite: number;
  midlineDeviation: number;
  complexityScore: number; // 1-10
  complexityLabel: 'Simple' | 'Moderate' | 'Complex' | 'Very Complex';
  confidenceScore: number; // 0-100
  analysisDate: string;
}

export interface AIPrediction {
  estimatedDurationWeeks: number;
  estimatedAlignerCount: number;
  refinementProbability: number; // 0-100
  complianceRisk: 'low' | 'moderate' | 'high';
  attachmentPrediction: number; // count
  iprPrediction: number; // total mm
  confidenceScore: number;
}

export interface AIRecommendation {
  id: string;
  category: 'attachment' | 'ipr' | 'movement_warning' | 'manufacturing' | 'clinical' | 'compliance';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  description: string;
  affectedTeeth?: number[];
  actionRequired: boolean;
  disclaimer: string;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  attachments?: { type: string; label: string }[];
}

// ─── Analytics & BI (Phase 11) ────────────────────────────────────────────────

export interface ClinicalMetrics {
  totalCases: number;
  activeCases: number;
  completedCases: number;
  averageTreatmentWeeks: number;
  refinementRate: number; // %
  averageAlignerCount: number;
  patientSatisfactionScore: number; // 0-5
  onTimeCompletionRate: number; // %
}

export interface ManufacturingMetrics {
  totalJobsThisMonth: number;
  successRate: number; // %
  failureRate: number; // %
  averageTurnaroundHours: number;
  printerUtilization: number; // %
  resinConsumedMl: number;
  wasteReductionPct: number;
  batchesShipped: number;
}

export interface BusinessMetrics {
  revenueThisMonth: number;
  revenueLastMonth: number;
  revenueGrowthPct: number;
  caseVolumeThisMonth: number;
  averageCaseValue: number;
  topDoctorsByRevenue: { name: string; revenue: number; cases: number }[];
  clinicPerformance: { clinicName: string; cases: number; revenue: number; efficiency: number }[];
}

// ─── Command Center (Phase 1) ─────────────────────────────────────────────────

export interface CommandCenterStats {
  activeCases: number;
  awaitingApproval: number;
  awaitingSegmentation: number;
  awaitingCAD: number;
  inManufacturing: number;
  slaAtRisk: number;
  refinementsNeeded: number;
  completedToday: number;
}

export interface SLARisk {
  caseId: string;
  patientName: string;
  currentStage: string;
  dueDate: string;
  hoursOverdue: number;
  severity: 'warning' | 'critical';
  assignedTo: string;
}

// ─── Mock data helpers ────────────────────────────────────────────────────────

export const FDI_UPPER: number[] = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const FDI_LOWER: number[] = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
export const FDI_ALL: number[] = [...FDI_UPPER, ...FDI_LOWER];

export function toothClassName(fdi: number): ToothClass {
  const n = fdi % 10;
  if (n === 1 || n === 2) return n === 1 ? 'central_incisor' : 'lateral_incisor';
  if (n === 3) return 'canine';
  if (n === 4) return 'first_premolar';
  if (n === 5) return 'second_premolar';
  if (n === 6) return 'first_molar';
  if (n === 7) return 'second_molar';
  return 'third_molar';
}

export function toothDisplayName(fdi: number): string {
  const classMap: Record<ToothClass, string> = {
    central_incisor: 'Central Incisor',
    lateral_incisor: 'Lateral Incisor',
    canine: 'Canine',
    first_premolar: '1st Premolar',
    second_premolar: '2nd Premolar',
    first_molar: '1st Molar',
    second_molar: '2nd Molar',
    third_molar: '3rd Molar (Wisdom)',
  };
  return `${fdi} — ${classMap[toothClassName(fdi)]}`;
}

export function qcStatusTone(status: QCStatus): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'pass') return 'success';
  if (status === 'fail') return 'danger';
  if (status === 'conditional_pass' || status === 'rework_required') return 'warning';
  return 'neutral';
}

export function productionStatusLabel(status: ProductionStatus): string {
  const map: Record<ProductionStatus, string> = {
    queued: 'Queued',
    printing: 'Printing',
    washing: 'Washing',
    curing: 'Curing',
    qc_inspection: 'QC Inspection',
    packaging: 'Packaging',
    shipping: 'Shipping',
    completed: 'Completed',
    failed: 'Failed',
  };
  return map[status];
}

export function productionStatusStep(status: ProductionStatus): number {
  const steps: ProductionStatus[] = ['queued', 'printing', 'washing', 'curing', 'qc_inspection', 'packaging', 'shipping', 'completed'];
  return steps.indexOf(status);
}

export const PRODUCTION_PIPELINE_STEPS: ProductionStatus[] = [
  'queued', 'printing', 'washing', 'curing', 'qc_inspection', 'packaging', 'shipping', 'completed',
];
