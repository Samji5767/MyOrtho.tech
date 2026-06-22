// TODO: Connect to Supabase analytics views and NestJS reporting API once backend is configured

export async function getAnalytics(): Promise<null> {
  // TODO: Fetch aggregated metrics from Supabase analytics views
  return null;
}

export async function getKPIs(): Promise<null> {
  // TODO: Query Supabase for active patients, completed cases, avg SLA
  return null;
}

export async function getRecentEvents(): Promise<never[]> {
  // TODO: Fetch from Supabase audit_logs and case_events tables
  return [];
}

export async function getCaseStageDistribution(): Promise<never[]> {
  // TODO: Aggregate cases by status from Supabase
  return [];
}
