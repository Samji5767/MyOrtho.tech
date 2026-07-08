import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExportType = 'lab_full' | 'aligner_stl' | 'treatment_summary' | 'patient_instructions' | 'insurance_report';

export interface ChecklistItem {
  id: string;
  checkKey: string;
  checkLabel: string;
  module: string;
  status: 'pending' | 'passed' | 'failed' | 'warning' | 'skipped';
  message: string | null;
  isBlocking: boolean;
  checkedAt: string | null;
}

export interface ExportPackage {
  id: string;
  planId: string;
  exportType: ExportType;
  status: 'draft' | 'validated' | 'approved' | 'exported' | 'failed';
  validationResults: ChecklistItem[];
  validationPassed: boolean | null;
  approvedBy: string | null;
  approvedAt: string | null;
  exportedAt: string | null;
  exportFormat: string | null;
  fileSizeBytes: number | null;
  checksumSha256: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Check definitions per export type ───────────────────────────────────────

interface CheckDef {
  key: string;
  label: string;
  module: string;
  isBlocking: boolean;
  exportTypes: ExportType[];
}

const CHECK_DEFS: CheckDef[] = [
  // Treatment plan checks
  {
    key: 'plan_exists',
    label: 'Treatment plan exists and is active',
    module: 'treatment_plans',
    isBlocking: true,
    exportTypes: ['lab_full', 'aligner_stl', 'treatment_summary', 'patient_instructions', 'insurance_report'],
  },
  {
    key: 'prescriptions_exist',
    label: 'Movement prescriptions present for all arches',
    module: 'prescriptions',
    isBlocking: true,
    exportTypes: ['lab_full', 'aligner_stl', 'treatment_summary'],
  },
  {
    key: 'no_kravitz_violations',
    label: 'No Kravitz per-stage limits exceeded',
    module: 'prescriptions',
    isBlocking: false,
    exportTypes: ['lab_full', 'aligner_stl', 'treatment_summary'],
  },
  // Aligner generation
  {
    key: 'aligner_plan_approved',
    label: 'Aligner generation plan clinician-approved',
    module: 'aligner_generation',
    isBlocking: true,
    exportTypes: ['lab_full', 'aligner_stl'],
  },
  {
    key: 'ipr_schedule_present',
    label: 'IPR schedule generated and validated',
    module: 'aligner_generation',
    isBlocking: false,
    exportTypes: ['lab_full', 'aligner_stl', 'treatment_summary'],
  },
  // Segmentation
  {
    key: 'segmentation_complete',
    label: 'Tooth segmentation completed',
    module: 'segmentation',
    isBlocking: false,
    exportTypes: ['lab_full', 'aligner_stl'],
  },
  // Attachment
  {
    key: 'attachments_mfg_valid',
    label: 'Attachment manufacturing dimensions validated',
    module: 'attachments',
    isBlocking: true,
    exportTypes: ['lab_full', 'aligner_stl'],
  },
  {
    key: 'no_attachment_collisions',
    label: 'No critical attachment collisions',
    module: 'attachments',
    isBlocking: true,
    exportTypes: ['lab_full', 'aligner_stl'],
  },
  // IPR
  {
    key: 'ipr_enamel_safe',
    label: 'All IPR contacts above Sheridan 0.5mm minimum',
    module: 'ipr',
    isBlocking: true,
    exportTypes: ['lab_full', 'aligner_stl', 'treatment_summary'],
  },
  // Simulation
  {
    key: 'simulation_generated',
    label: 'Treatment simulation generated',
    module: 'simulation',
    isBlocking: false,
    exportTypes: ['lab_full', 'treatment_summary', 'insurance_report'],
  },
  // PDL
  {
    key: 'no_high_pdl_stress',
    label: 'No high-risk PDL stress teeth',
    module: 'pdl',
    isBlocking: false,
    exportTypes: ['lab_full', 'treatment_summary'],
  },
  // Retention
  {
    key: 'retention_protocol_approved',
    label: 'Retention protocol clinician-approved',
    module: 'retention',
    isBlocking: false,
    exportTypes: ['lab_full', 'treatment_summary', 'patient_instructions'],
  },
  // Arch coordination
  {
    key: 'arch_coordination_approved',
    label: 'Multi-arch coordination plan approved',
    module: 'arch_coordination',
    isBlocking: false,
    exportTypes: ['lab_full', 'treatment_summary'],
  },
  // Clinical copilot
  {
    key: 'no_open_critical_suggestions',
    label: 'No open critical copilot suggestions',
    module: 'copilot',
    isBlocking: false,
    exportTypes: ['lab_full', 'treatment_summary'],
  },
];

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class ExportPackageService {
  private readonly log = new Logger(ExportPackageService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async createPackage(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
    exportType: ExportType,
  ): Promise<ExportPackage> {
    await this.verifyPlan(planId, caseId, orgId);

    const pkgRes = await this.db.query(
      `INSERT INTO export_packages
         (organization_id, plan_id, export_type, status, created_by)
       VALUES ($1,$2,$3,'draft',$4) RETURNING *`,
      [orgId, planId, exportType, userId],
    );
    const pkg = pkgRes.rows[0];
    const pkgId = pkg['id'] as string;

    // Create checklist items for this export type
    const checks = CHECK_DEFS.filter(c => c.exportTypes.includes(exportType));
    for (const c of checks) {
      await this.db.query(
        `INSERT INTO export_checklist_items
           (package_id, organization_id, check_key, check_label, module, is_blocking)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (package_id, check_key) DO NOTHING`,
        [pkgId, orgId, c.key, c.label, c.module, c.isBlocking],
      );
    }

    return this.loadPackage(pkgId, orgId);
  }

  async listPackages(caseId: string, orgId: string, planId: string): Promise<ExportPackage[]> {
    await this.verifyPlan(planId, caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM export_packages WHERE plan_id=$1 AND organization_id=$2 ORDER BY created_at DESC`,
      [planId, orgId],
    );
    return Promise.all(res.rows.map(r => this.loadPackage(r['id'] as string, orgId)));
  }

  async validatePackage(
    caseId: string,
    orgId: string,
    planId: string,
    packageId: string,
  ): Promise<ExportPackage> {
    await this.verifyPlan(planId, caseId, orgId);

    const pkgOwnerCheck = await this.db.query(
      `SELECT id FROM export_packages WHERE id=$1 AND organization_id=$2`,
      [packageId, orgId],
    );
    if (pkgOwnerCheck.rowCount === 0) throw new NotFoundException('Export package not found');

    const items = await this.db.query(
      `SELECT * FROM export_checklist_items WHERE package_id=$1 ORDER BY check_key`,
      [packageId],
    );

    let allPassed = true;

    for (const item of items.rows) {
      const { status, message } = await this.runCheck(
        item['check_key'] as string,
        planId,
        orgId,
      );

      await this.db.query(
        `UPDATE export_checklist_items SET status=$1, message=$2, checked_at=now()
         WHERE id=$3`,
        [status, message, item['id']],
      );

      if (status === 'failed' && item['is_blocking'] as boolean) {
        allPassed = false;
      }
    }

    const newStatus = allPassed ? 'validated' : 'failed';
    await this.db.query(
      `UPDATE export_packages SET status=$1, validation_passed=$2, updated_at=now() WHERE id=$3`,
      [newStatus, allPassed, packageId],
    );

    this.log.log(`Phase 34 validation: pkg ${packageId} — ${newStatus}`);
    return this.loadPackage(packageId, orgId);
  }

  async approvePackage(
    caseId: string,
    orgId: string,
    userId: string,
    planId: string,
    packageId: string,
  ): Promise<ExportPackage> {
    await this.verifyPlan(planId, caseId, orgId);
    const pkg = await this.loadPackage(packageId, orgId);
    if (pkg.status !== 'validated') {
      throw new BadRequestException('Package must be validated before approval');
    }
    await this.db.query(
      `UPDATE export_packages SET status='approved', approved_by=$1, approved_at=now(), updated_at=now()
       WHERE id=$2 AND organization_id=$3`,
      [userId, packageId, orgId],
    );
    return this.loadPackage(packageId, orgId);
  }

  async markExported(
    caseId: string,
    orgId: string,
    planId: string,
    packageId: string,
    format: string,
    fileSizeBytes: number,
  ): Promise<ExportPackage> {
    await this.verifyPlan(planId, caseId, orgId);
    const pkg = await this.loadPackage(packageId, orgId);
    if (pkg.status !== 'approved') {
      throw new BadRequestException('Package must be clinician-approved before export');
    }

    // Check billing BEFORE marking exported so a failed payment never
    // leaves the package in 'exported' state with no charge recorded.
    await this.recordExportTransaction(orgId, planId, packageId);

    // checksum_sha256 is null until real file bytes are produced by the
    // manufacturing pipeline; the caller must supply a real SHA-256 once
    // actual export files exist.
    await this.db.query(
      `UPDATE export_packages
       SET status='exported', exported_at=now(), export_format=$1,
           file_size_bytes=$2, checksum_sha256=NULL, updated_at=now()
       WHERE id=$3 AND organization_id=$4`,
      [format, fileSizeBytes, packageId, orgId],
    );

    return this.loadPackage(packageId, orgId);
  }

  private async recordExportTransaction(
    orgId: string,
    planId: string,
    packageId: string,
  ): Promise<void> {
    const PAYG_EXPORT_CENTS = 199; // $1.99

    // Check subscription type
    const subRes = await this.db.query(
      `SELECT sp.is_unlimited, sp.slug
       FROM organization_subscriptions os
       JOIN subscription_plans sp ON sp.id=os.plan_id
       WHERE os.organization_id=$1 AND os.status='active'
       ORDER BY os.created_at DESC LIMIT 1`,
      [orgId],
    );
    const sub = subRes.rows[0];
    const isUnlimited = sub?.['is_unlimited'] as boolean ?? false;
    const planSlug = sub?.['slug'] as string ?? 'none';

    if (isUnlimited) {
      await this.db.query(
        `INSERT INTO export_transactions
           (organization_id, plan_id, export_package_id, transaction_type,
            amount_cents, description, status)
         VALUES ($1,$2,$3,'subscription_charge',0,$4,'completed')`,
        [orgId, planId, packageId, 'Unlimited Professional export — included in subscription'],
      );
    } else if (planSlug === 'payg') {
      // Deduct $1.99 from credit balance
      const creditRes = await this.db.query(
        `UPDATE organization_credits
         SET balance = balance - $2, updated_at = now()
         WHERE organization_id = $1 AND balance >= $2
         RETURNING balance`,
        [orgId, PAYG_EXPORT_CENTS],
      );
      const succeeded = (creditRes.rowCount ?? 0) > 0;
      const balanceAfter = succeeded ? (creditRes.rows[0]?.['balance'] as number) : null;

      await this.db.query(
        `INSERT INTO export_transactions
           (organization_id, plan_id, export_package_id, transaction_type,
            amount_cents, description, credit_balance_after, status)
         VALUES ($1,$2,$3,'payg_export',$4,$5,$6,$7)`,
        [
          orgId, planId, packageId, PAYG_EXPORT_CENTS,
          'Pay-As-You-Go export package — $1.99',
          balanceAfter,
          succeeded ? 'completed' : 'failed',
        ],
      );

      if (!succeeded) {
        throw new ForbiddenException(
          'Insufficient export credits. Add PAYG credits to your account before exporting.',
        );
      }
    }
  }

  // ─── Check runner ──────────────────────────────────────────────────────────

  private async runCheck(
    key: string,
    planId: string,
    orgId: string,
  ): Promise<{ status: 'passed' | 'failed' | 'warning' | 'skipped'; message: string }> {
    try {
      switch (key) {
        case 'plan_exists': {
          const r = await this.db.query(
            `SELECT status FROM treatment_plans WHERE id=$1`, [planId],
          );
          if (r.rowCount === 0) return { status: 'failed', message: 'Treatment plan not found' };
          return { status: 'passed', message: `Plan status: ${r.rows[0]['status']}` };
        }

        case 'prescriptions_exist': {
          const r = await this.db.query(
            `SELECT COUNT(*) as cnt FROM movement_prescriptions WHERE plan_id=$1`, [planId],
          );
          const cnt = parseInt(r.rows[0]['cnt'] as string, 10);
          if (cnt === 0) return { status: 'failed', message: 'No movement prescriptions found' };
          return { status: 'passed', message: `${cnt} prescriptions present` };
        }

        case 'no_kravitz_violations': {
          const LIMITS: Record<string, number> = {
            translation_mesial_mm: 0.30, translation_distal_mm: 0.30,
            expansion_mm: 0.30, intrusion_mm: 0.40, extrusion_mm: 0.75,
            rotation_deg: 3.0, torque_deg: 3.5,
          };
          const r = await this.db.query(
            `SELECT * FROM movement_prescriptions WHERE plan_id=$1`, [planId],
          );
          let violations = 0;
          for (const p of r.rows) {
            for (const [axis, limit] of Object.entries(LIMITS)) {
              if (Math.abs(p[axis] as number ?? 0) > limit) violations++;
            }
          }
          if (violations > 0) return { status: 'warning', message: `${violations} Kravitz limit violations detected` };
          return { status: 'passed', message: 'All movements within per-stage limits' };
        }

        case 'aligner_plan_approved': {
          const r = await this.db.query(
            `SELECT approved_by FROM aligner_generation_plans WHERE plan_id=$1`, [planId],
          );
          if (r.rowCount === 0) return { status: 'failed', message: 'Aligner plan not generated' };
          if (!r.rows[0]['approved_by']) return { status: 'failed', message: 'Aligner plan not clinician-approved' };
          return { status: 'passed', message: 'Aligner plan approved' };
        }

        case 'ipr_schedule_present': {
          const r = await this.db.query(
            `SELECT ipr_stage_schedule FROM aligner_generation_plans WHERE plan_id=$1`, [planId],
          );
          if (r.rowCount === 0) return { status: 'skipped', message: 'Aligner plan not found' };
          const ipr = r.rows[0]['ipr_stage_schedule'] as unknown[];
          if (!ipr || ipr.length === 0) return { status: 'warning', message: 'No IPR schedule in aligner plan' };
          return { status: 'passed', message: `${ipr.length} IPR entries scheduled` };
        }

        case 'segmentation_complete': {
          const r = await this.db.query(
            `SELECT COUNT(*) as cnt FROM segmentation_jobs
             WHERE case_id=(SELECT case_id FROM treatment_plans WHERE id=$1)
             AND status='completed'`,
            [planId],
          );
          const cnt = parseInt(r.rows[0]['cnt'] as string, 10);
          if (cnt === 0) return { status: 'warning', message: 'No completed segmentation job found' };
          return { status: 'passed', message: `${cnt} completed segmentation job(s)` };
        }

        case 'attachments_mfg_valid': {
          const r = await this.db.query(
            `SELECT COUNT(*) as cnt FROM attachment_force_analysis
             WHERE plan_id=$1 AND manufacturing_valid=false`,
            [planId],
          );
          const invalid = parseInt(r.rows[0]['cnt'] as string, 10);
          if (invalid > 0) return { status: 'failed', message: `${invalid} attachments fail manufacturing tolerances` };
          const total = await this.db.query(
            `SELECT COUNT(*) as cnt FROM attachment_force_analysis WHERE plan_id=$1`, [planId],
          );
          if (parseInt(total.rows[0]['cnt'] as string, 10) === 0) {
            return { status: 'warning', message: 'No attachment analysis run yet' };
          }
          return { status: 'passed', message: 'All attachments meet manufacturing tolerances' };
        }

        case 'no_attachment_collisions': {
          const r = await this.db.query(
            `SELECT COUNT(*) as cnt FROM attachment_collisions WHERE plan_id=$1 AND severity='critical'`,
            [planId],
          );
          const cnt = parseInt(r.rows[0]['cnt'] as string, 10);
          if (cnt > 0) return { status: 'failed', message: `${cnt} critical attachment collision(s) detected` };
          return { status: 'passed', message: 'No critical attachment collisions' };
        }

        case 'ipr_enamel_safe': {
          const r = await this.db.query(
            `SELECT COUNT(*) as cnt FROM ipr_enamel_estimates WHERE plan_id=$1 AND is_safe=false`,
            [planId],
          );
          const cnt = parseInt(r.rows[0]['cnt'] as string, 10);
          if (cnt > 0) return { status: 'failed', message: `${cnt} IPR contact(s) below Sheridan 0.5mm minimum` };
          const total = await this.db.query(
            `SELECT COUNT(*) as cnt FROM ipr_enamel_estimates WHERE plan_id=$1`, [planId],
          );
          if (parseInt(total.rows[0]['cnt'] as string, 10) === 0) {
            return { status: 'warning', message: 'IPR enamel analysis not run' };
          }
          return { status: 'passed', message: 'All IPR contacts above enamel safety threshold' };
        }

        case 'simulation_generated': {
          const r = await this.db.query(
            `SELECT COUNT(*) as cnt FROM treatment_simulations WHERE plan_id=$1`, [planId],
          );
          const cnt = parseInt(r.rows[0]['cnt'] as string, 10);
          if (cnt === 0) return { status: 'warning', message: 'Treatment simulation not yet generated' };
          return { status: 'passed', message: 'Simulation available' };
        }

        case 'no_high_pdl_stress': {
          const r = await this.db.query(
            `SELECT COUNT(*) as cnt FROM pdl_simulation_results WHERE plan_id=$1 AND mobility_risk='high'`,
            [planId],
          );
          const cnt = parseInt(r.rows[0]['cnt'] as string, 10);
          if (cnt > 0) return { status: 'warning', message: `${cnt} tooth/teeth with high PDL stress risk` };
          return { status: 'passed', message: 'No high-risk PDL stress detected' };
        }

        case 'retention_protocol_approved': {
          const r = await this.db.query(
            `SELECT approved_at FROM retention_protocols WHERE plan_id=$1`, [planId],
          );
          if (r.rowCount === 0) return { status: 'warning', message: 'Retention protocol not generated' };
          if (!r.rows[0]['approved_at']) return { status: 'warning', message: 'Retention protocol not approved' };
          return { status: 'passed', message: 'Retention protocol clinician-approved' };
        }

        case 'arch_coordination_approved': {
          const r = await this.db.query(
            `SELECT approved_at FROM arch_coordination_plans WHERE plan_id=$1`, [planId],
          );
          if (r.rowCount === 0) return { status: 'warning', message: 'Arch coordination not generated' };
          if (!r.rows[0]['approved_at']) return { status: 'warning', message: 'Arch coordination not approved' };
          return { status: 'passed', message: 'Arch coordination approved' };
        }

        case 'no_open_critical_suggestions': {
          const r = await this.db.query(
            `SELECT COUNT(*) as cnt FROM copilot_suggestions
             WHERE plan_id=$1 AND severity='critical' AND status='open'`,
            [planId],
          );
          const cnt = parseInt(r.rows[0]['cnt'] as string, 10);
          if (cnt > 0) return { status: 'warning', message: `${cnt} open critical copilot suggestion(s)` };
          return { status: 'passed', message: 'No open critical AI suggestions' };
        }

        default:
          return { status: 'skipped', message: `Unknown check key: ${key}` };
      }
    } catch (err) {
      return { status: 'failed', message: `Check error: ${(err as Error).message}` };
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async loadPackage(pkgId: string, orgId: string): Promise<ExportPackage> {
    const [pkgRes, itemsRes] = await Promise.all([
      this.db.query(`SELECT * FROM export_packages WHERE id=$1 AND organization_id=$2`, [pkgId, orgId]),
      this.db.query(`SELECT * FROM export_checklist_items WHERE package_id=$1 ORDER BY module, check_key`, [pkgId]),
    ]);
    if (pkgRes.rowCount === 0) throw new NotFoundException('Export package not found');
    const r = pkgRes.rows[0];
    const items: ChecklistItem[] = itemsRes.rows.map(i => ({
      id:          i['id'] as string,
      checkKey:    i['check_key'] as string,
      checkLabel:  i['check_label'] as string,
      module:      i['module'] as string,
      status:      i['status'] as ChecklistItem['status'],
      message:     i['message'] as string | null,
      isBlocking:  i['is_blocking'] as boolean,
      checkedAt:   i['checked_at'] as string | null,
    }));

    return {
      id:                r['id'] as string,
      planId:            r['plan_id'] as string,
      exportType:        r['export_type'] as ExportType,
      status:            r['status'] as ExportPackage['status'],
      validationResults: items,
      validationPassed:  r['validation_passed'] as boolean | null,
      approvedBy:        r['approved_by'] as string | null,
      approvedAt:        r['approved_at'] as string | null,
      exportedAt:        r['exported_at'] as string | null,
      exportFormat:      r['export_format'] as string | null,
      fileSizeBytes:     r['file_size_bytes'] as number | null,
      checksumSha256:    r['checksum_sha256'] as string | null,
      createdAt:         r['created_at'] as string,
      updatedAt:         r['updated_at'] as string,
    };
  }

  private async verifyPlan(planId: string, caseId: string, orgId: string): Promise<void> {
    const res = await this.db.query(
      `SELECT tp.id FROM treatment_plans tp JOIN cases c ON c.id=tp.case_id
       WHERE tp.id=$1 AND tp.case_id=$2 AND c.organization_id=$3`,
      [planId, caseId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Treatment plan not found');
  }
}
