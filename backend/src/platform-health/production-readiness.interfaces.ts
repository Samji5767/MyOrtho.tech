export type ReadinessLevel = 'production' | 'staging' | 'beta' | 'alpha' | 'not_started';

export interface ModuleReadinessScore {
  module: string;
  score: number; // 0–100
  level: ReadinessLevel;
  implemented: string[];
  partial: string[];
  missing: string[];
  notes: string;
}

export interface PlatformReadinessReport {
  overallScore: number;
  generatedAt: string;
  modules: ModuleReadinessScore[];
  criticalIssues: string[];
  recommendations: string[];
}
