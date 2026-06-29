import { Injectable, Inject, Optional } from '@nestjs/common';
import type { Pool } from 'pg';
import type { Redis } from 'ioredis';
import { PG_POOL } from '../database/database.module';
import { REDIS_CLIENT } from '../redis/redis.module';

export interface ModuleHealthStatus {
  module: string; tableCount: number; recordCount: number; status: 'ok' | 'empty' | 'error';
}

export interface PlatformHealthReport {
  timestamp: string;
  databaseConnected: boolean;
  redisConnected: boolean;
  modules: ModuleHealthStatus[];
  totalTables: number;
  totalRecords: number;
  phasesCovered: number;
  maturityScore: number;
}

const TRACKED_TABLES: Array<{ module: string; table: string }> = [
  { module: 'Cases', table: 'cases' },
  { module: 'Patients', table: 'patients' },
  { module: 'Treatment Plans', table: 'treatment_stages' },
  { module: 'Scans', table: 'scans' },
  { module: 'Consent Forms', table: 'consent_forms' },
  { module: 'Appointments', table: 'appointments' },
  { module: 'Lab Orders', table: 'lab_orders' },
  { module: 'Referrals', table: 'referrals' },
  { module: 'Insurance', table: 'insurance_plans' },
  { module: 'Prescriptions', table: 'prescriptions' },
  { module: 'Inventory', table: 'inventory_items' },
  { module: 'Remote Monitoring', table: 'compliance_check_ins' },
  { module: 'Outcomes', table: 'treatment_outcomes' },
  { module: 'Training/CPD', table: 'cpd_activities' },
  { module: 'FHIR Export', table: 'fhir_exports' },
  { module: 'Business Intelligence', table: 'bi_snapshots' },
  { module: 'Supply Chain', table: 'purchase_orders' },
  { module: 'CRM/Notes', table: 'patient_notes' },
  { module: 'Workflow Builder', table: 'workflow_templates' },
  { module: 'Feature Flags', table: 'feature_flags' },
  { module: 'Quality Metrics', table: 'quality_metrics' },
  { module: 'Compliance', table: 'compliance_requirements' },
  { module: 'Surveys', table: 'surveys' },
  { module: 'Clinical Alerts', table: 'clinical_alerts' },
  { module: 'Clinical Tasks', table: 'clinical_tasks' },
  { module: 'Documents', table: 'documents' },
  { module: 'Patient Education', table: 'education_content' },
  { module: 'Radiology', table: 'radiology_images' },
  { module: 'Occlusion Analysis', table: 'occlusion_analyses' },
  { module: 'Growth Prediction', table: 'growth_predictions' },
  { module: 'Org Locations', table: 'org_locations' },
  { module: 'Emergency Protocols', table: 'emergency_protocols' },
  { module: 'Attachment Library', table: 'attachment_templates' },
  { module: 'Movement Constraints', table: 'movement_constraints' },
  { module: 'Print Farm', table: 'print_jobs' },
  { module: 'Manufacturing Batches', table: 'manufacturing_batches' },
  { module: 'Device Tracking', table: 'device_batches' },
  { module: 'Material Testing', table: 'material_tests' },
  { module: 'Intake Forms', table: 'intake_form_templates' },
  { module: 'Revenue Cycle', table: 'revenue_transactions' },
];

@Injectable()
export class PlatformHealthService {
  constructor(
    @Inject(PG_POOL) private readonly db: Pool,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  async getHealthReport(): Promise<PlatformHealthReport> {
    let databaseConnected = false;
    let redisConnected = false;
    const modules: ModuleHealthStatus[] = [];

    try {
      await this.db.query('SELECT 1');
      databaseConnected = true;
    } catch {}

    if (this.redis) {
      try {
        await this.redis.ping();
        redisConnected = true;
      } catch {}
    }

    let totalRecords = 0;
    for (const entry of TRACKED_TABLES) {
      try {
        const { rows } = await this.db.query(
          `SELECT COUNT(*)::int AS cnt FROM ${entry.table}`,
        );
        const cnt = (rows[0]?.['cnt'] as number) ?? 0;
        totalRecords += cnt;
        modules.push({ module: entry.module, tableCount: 1, recordCount: cnt, status: 'ok' });
      } catch {
        modules.push({ module: entry.module, tableCount: 0, recordCount: 0, status: 'error' });
      }
    }

    const okCount = modules.filter(m => m.status === 'ok').length;
    const maturityScore = Math.round((okCount / TRACKED_TABLES.length) * 100);

    return {
      timestamp: new Date().toISOString(),
      databaseConnected,
      redisConnected,
      modules,
      totalTables: TRACKED_TABLES.length,
      totalRecords,
      phasesCovered: 100,
      maturityScore,
    };
  }
}
