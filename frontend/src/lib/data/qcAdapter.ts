export interface QCJob {
  id: string;
  manufacturingJobId: string;
  status: 'pending' | 'in_progress' | 'passed' | 'failed';
  checklist: QCCheckItem[];
  inspectedBy: string | null;
  signedOffAt: string | null;
  rejectionReason: string | null;
}

export interface QCCheckItem {
  label: string;
  passed: boolean | null;
}

export async function getQCJobs(): Promise<QCJob[]> {
  try {
    // Supabase / NestJS integration point
    return [];
  } catch {
    return [];
  }
}

export async function getQCJob(jobId: string): Promise<QCJob | null> {
  try {
    return null;
  } catch {
    return null;
  }
}

export async function signOffQC(jobId: string, inspectorId: string): Promise<boolean> {
  try {
    return false;
  } catch {
    return false;
  }
}

export async function rejectQCJob(jobId: string, reason: string): Promise<boolean> {
  try {
    return false;
  } catch {
    return false;
  }
}
