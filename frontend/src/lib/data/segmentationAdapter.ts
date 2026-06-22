export interface SegmentationResult {
  scanId: string;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  toothCount: number | null;
  missingTeeth: number[];
  qualityScore: number | null;
  reviewedBy: string | null;
  approvedAt: string | null;
}

export async function getSegmentationResult(scanId: string): Promise<SegmentationResult | null> {
  try {
    // Supabase / FastAPI integration point
    return null;
  } catch {
    return null;
  }
}

export async function approveSegmentation(scanId: string, reviewerId: string): Promise<boolean> {
  try {
    return false;
  } catch {
    return false;
  }
}

export async function requestSegmentationReview(scanId: string): Promise<boolean> {
  try {
    return false;
  } catch {
    return false;
  }
}
