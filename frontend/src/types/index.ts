// TypeScript Type Declarations for MyOrtho.tech

export type UserRole = 'enterprise_admin' | 'clinic_admin' | 'dentist' | 'lab_technician' | 'operator' | 'patient';

export type CaseStatus =
  | 'draft'
  | 'scan_review'
  | 'segmentation'
  | 'planning'
  | 'clinical_review'
  | 'approved'
  | 'active_treatment'
  | 'monitoring'
  | 'retention'
  | 'completed'
  | 'archived'
  | 'cancelled';

export type JobStatus = 
  | 'queued' 
  | 'nesting' 
  | 'printing' 
  | 'cleaning' 
  | 'curing' 
  | 'qc_pending' 
  | 'completed' 
  | 'failed';

export type PrinterStatus = 'idle' | 'printing' | 'offline' | 'error' | 'maintenance';

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organizationId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  clinicalNotes?: string;
  createdAt: string;
}

export interface Case {
  id: string;
  patientId: string;
  patientName: string; // denormalized for UI
  dentistId?: string;
  dentistName?: string;
  status: CaseStatus;
  currentStageId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Scan {
  id: string;
  caseId: string;
  jawType: 'maxillary' | 'mandibular' | 'both';
  filePath: string;
  fileFormat: 'stl' | 'obj' | 'ply' | 'dicom' | 'cbct';
  fileSizeBytes: number;
  validationMetrics: {
    thinWallRisk?: boolean;
    unsupportedGeometry?: boolean;
    holeCount?: number;
    triangleCount?: number;
    orientationCorrected?: boolean;
  };
  createdAt: string;
}

export interface AlignerStage {
  id: string;
  planId: string;
  stageNumber: number;
  maxillaryMeshPath?: string;
  mandibularMeshPath?: string;
  movements: Record<string, {
    translation: [number, number, number]; // [x, y, z]
    rotation: [number, number, number];    // [pitch, roll, yaw]
    ipr?: number;                          // Interproximal Reduction in mm
    attachments?: string[];                // list of attachments on this tooth
  }>;
}

export interface TreatmentPlan {
  id: string;
  caseId: string;
  createdBy: string;
  doctorApproval: boolean;
  doctorSignature?: string;
  approvedAt?: string;
  estimatedStages: number;
  aiRecommendationNotes?: string;
  stages: AlignerStage[];
  createdAt: string;
}

export interface Printer {
  id: string;
  name: string;
  brand: string;
  model: string;
  status: PrinterStatus;
  materialType?: string;
  materialVolumeMl: number;
  ipAddress?: string;
  currentJobId?: string;
  createdAt: string;
}

export interface PrintJob {
  id: string;
  printerId?: string;
  printerName?: string;
  stageId?: string;
  stageNumber?: number;
  patientName: string;
  status: JobStatus;
  qualityScore?: number;
  qcNotes?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}
