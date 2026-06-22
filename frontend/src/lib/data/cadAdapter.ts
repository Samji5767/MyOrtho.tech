export interface CADDesign {
  id: string;
  caseId: string;
  scanId: string;
  status: 'draft' | 'in_review' | 'approved' | 'revision_requested';
  stageCount: number | null;
  attachmentCount: number | null;
  iprCount: number | null;
  designedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
}

export async function getCADDesign(caseId: string): Promise<CADDesign | null> {
  try {
    // Supabase / NestJS integration point
    return null;
  } catch {
    return null;
  }
}

export async function approveCADDesign(designId: string, approverId: string): Promise<boolean> {
  try {
    return false;
  } catch {
    return false;
  }
}

export async function requestCADRevision(designId: string, reason: string): Promise<boolean> {
  try {
    return false;
  } catch {
    return false;
  }
}
