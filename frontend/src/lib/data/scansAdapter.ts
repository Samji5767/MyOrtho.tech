// TODO: Connect to Supabase storage and FastAPI segmentation pipeline once backend is configured

export async function getScans(): Promise<never[]> {
  // TODO: Fetch from Supabase scans table filtered by organization
  return [];
}

export async function uploadScan(_file: File): Promise<null> {
  // TODO: Upload to Supabase storage bucket, trigger FastAPI segmentation pipeline
  return null;
}

export async function getScanStatus(_scanId: string): Promise<null> {
  // TODO: Poll FastAPI /segmentation/{scanId}/status for processing state
  return null;
}
