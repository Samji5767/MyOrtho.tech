// TODO: Connect to Supabase treatment_plans and aligner_stages tables once backend is configured

export async function getTreatmentPlans(): Promise<never[]> {
  // TODO: Fetch all treatment plans for the authenticated organization
  return [];
}

export async function getTreatmentPlanByCase(_caseId: string): Promise<null> {
  // TODO: Query Supabase treatment_plans joined with aligner_stages for caseId
  return null;
}

export async function generateTreatmentPlan(_caseId: string): Promise<null> {
  // TODO: POST to FastAPI /treatment-plans/generate with validated scan data
  return null;
}

export async function approveTreatmentPlan(_planId: string): Promise<null> {
  // TODO: Update treatment_plans.doctor_approval = true with doctor signature
  return null;
}
