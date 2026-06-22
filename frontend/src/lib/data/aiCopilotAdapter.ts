// TODO: Connect to FastAPI AI engine once backend is configured

export async function getAIPredictions(_caseId: string): Promise<null> {
  // TODO: GET /ai/predictions/{caseId} from FastAPI — requires validated scan
  return null;
}

export async function getAIInsights(_caseId: string): Promise<never[]> {
  // TODO: GET /ai/insights/{caseId} — clinical decision-support findings only
  return [];
}

export async function runSegmentation(_scanId: string): Promise<null> {
  // TODO: POST /segmentation/run with scanId, returns job ID for polling
  return null;
}

export async function getSegmentationStatus(_jobId: string): Promise<null> {
  // TODO: GET /segmentation/status/{jobId} — returns progress and result
  return null;
}
