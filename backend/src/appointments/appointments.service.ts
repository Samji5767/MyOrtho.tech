import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface Appointment {
  id: string;
  caseId: string;
  appointmentTypeId: string | null;
  appointmentTypeName: string | null;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
  notes: string | null;
  reminderSent: boolean;
  createdAt: string;
}

export interface TreatmentMilestone {
  id: string;
  caseId: string;
  planId: string | null;
  title: string;
  milestoneType: string;
  targetDate: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface AppointmentType {
  id: string;
  name: string;
  durationMinutes: number;
  colorHex: string;
}

// Default appointment types seeded per org
const DEFAULT_APPT_TYPES = [
  { name: 'Initial Consultation', duration_minutes: 60, color_hex: '#3b82f6' },
  { name: 'Records Appointment', duration_minutes: 45, color_hex: '#8b5cf6' },
  { name: 'Aligner Delivery', duration_minutes: 30, color_hex: '#10b981' },
  { name: 'Stage Check', duration_minutes: 20, color_hex: '#06b6d4' },
  { name: 'Refinement Scan', duration_minutes: 30, color_hex: '#f59e0b' },
  { name: 'Retention Delivery', duration_minutes: 30, color_hex: '#22c55e' },
  { name: 'Debond / Deband', duration_minutes: 60, color_hex: '#ec4899' },
  { name: 'Emergency Visit', duration_minutes: 20, color_hex: '#ef4444' },
];

@Injectable()
export class AppointmentsService {
  private readonly log = new Logger(AppointmentsService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async ensureDefaultTypes(orgId: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT COUNT(*) as cnt FROM appointment_types WHERE organization_id=$1`, [orgId],
    );
    if (parseInt(rows[0]?.cnt ?? '0', 10) > 0) return;
    for (const t of DEFAULT_APPT_TYPES) {
      await this.db.query(
        `INSERT INTO appointment_types (organization_id, name, duration_minutes, color_hex)
         VALUES ($1,$2,$3,$4)`,
        [orgId, t.name, t.duration_minutes, t.color_hex],
      );
    }
  }

  async listTypes(orgId: string): Promise<AppointmentType[]> {
    await this.ensureDefaultTypes(orgId);
    const { rows } = await this.db.query(
      `SELECT id, name, duration_minutes, color_hex FROM appointment_types
       WHERE organization_id=$1 ORDER BY name`, [orgId],
    );
    return rows.map(r => ({
      id: r['id'] as string,
      name: r['name'] as string,
      durationMinutes: r['duration_minutes'] as number,
      colorHex: r['color_hex'] as string,
    }));
  }

  async listAppointments(caseId: string, orgId: string): Promise<Appointment[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      `SELECT a.*, at.name as appointment_type_name
       FROM appointments a
       LEFT JOIN appointment_types at ON at.id = a.appointment_type_id
       WHERE a.case_id=$1 AND a.organization_id=$2
       ORDER BY a.scheduled_at ASC`,
      [caseId, orgId],
    );
    return rows.map(this.mapAppt);
  }

  async listUpcoming(orgId: string, days = 7): Promise<Appointment[]> {
    const { rows } = await this.db.query(
      `SELECT a.*, at.name as appointment_type_name
       FROM appointments a
       LEFT JOIN appointment_types at ON at.id = a.appointment_type_id
       WHERE a.organization_id=$1
         AND a.scheduled_at BETWEEN now() AND now() + ($2 || ' days')::interval
         AND a.status IN ('scheduled','confirmed')
       ORDER BY a.scheduled_at ASC`,
      [orgId, days],
    );
    return rows.map(this.mapAppt);
  }

  async createAppointment(caseId: string, orgId: string, dto: {
    appointmentTypeId?: string;
    scheduledAt: string;
    durationMinutes?: number;
    notes?: string;
    clinicianId?: string;
  }): Promise<Appointment> {
    await this.verifyCase(caseId, orgId);
    const duration = dto.durationMinutes ?? 30;
    const { rows } = await this.db.query(
      `INSERT INTO appointments (organization_id, case_id, appointment_type_id, scheduled_at, duration_minutes, notes, clinician_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *, (SELECT name FROM appointment_types WHERE id=$3) as appointment_type_name`,
      [orgId, caseId, dto.appointmentTypeId ?? null, dto.scheduledAt, duration, dto.notes ?? null, dto.clinicianId ?? null],
    );
    return this.mapAppt(rows[0]);
  }

  async updateStatus(apptId: string, orgId: string, status: string): Promise<Appointment> {
    const valid = ['scheduled','confirmed','completed','cancelled','no_show'];
    if (!valid.includes(status)) throw new NotFoundException(`Invalid status: ${status}`);
    const { rows } = await this.db.query(
      `UPDATE appointments SET status=$2, updated_at=now()
       WHERE id=$1 AND organization_id=$3
       RETURNING *, (SELECT name FROM appointment_types WHERE id=appointment_type_id) as appointment_type_name`,
      [apptId, status, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Appointment not found');
    return this.mapAppt(rows[0]);
  }

  // ─── Milestones ───────────────────────────────────────────────────────────

  async listMilestones(caseId: string, orgId: string): Promise<TreatmentMilestone[]> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      `SELECT * FROM treatment_milestones WHERE case_id=$1 AND organization_id=$2 ORDER BY target_date ASC NULLS LAST`,
      [caseId, orgId],
    );
    return rows.map(this.mapMilestone);
  }

  async createMilestone(caseId: string, orgId: string, dto: {
    title: string;
    milestoneType: string;
    planId?: string;
    targetDate?: string;
    notes?: string;
  }): Promise<TreatmentMilestone> {
    await this.verifyCase(caseId, orgId);
    const { rows } = await this.db.query(
      `INSERT INTO treatment_milestones (organization_id, case_id, plan_id, title, milestone_type, target_date, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [orgId, caseId, dto.planId ?? null, dto.title, dto.milestoneType, dto.targetDate ?? null, dto.notes ?? null],
    );
    return this.mapMilestone(rows[0]);
  }

  async completeMilestone(milestoneId: string, orgId: string, notes?: string): Promise<TreatmentMilestone> {
    const { rows } = await this.db.query(
      `UPDATE treatment_milestones SET completed_at=now(), notes=COALESCE($3, notes)
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [milestoneId, orgId, notes ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Milestone not found');
    return this.mapMilestone(rows[0]);
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.db.query(
      `SELECT id FROM cases WHERE id=$1 AND organization_id=$2`, [caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Case not found');
  }

  private mapAppt(r: Record<string, unknown>): Appointment {
    return {
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      appointmentTypeId: r['appointment_type_id'] as string | null,
      appointmentTypeName: r['appointment_type_name'] as string | null,
      scheduledAt: String(r['scheduled_at']),
      durationMinutes: r['duration_minutes'] as number,
      status: r['status'] as string,
      notes: r['notes'] as string | null,
      reminderSent: r['reminder_sent'] as boolean,
      createdAt: String(r['created_at']),
    };
  }

  private mapMilestone(r: Record<string, unknown>): TreatmentMilestone {
    return {
      id: r['id'] as string,
      caseId: r['case_id'] as string,
      planId: r['plan_id'] as string | null,
      title: r['title'] as string,
      milestoneType: r['milestone_type'] as string,
      targetDate: r['target_date'] ? String(r['target_date']) : null,
      completedAt: r['completed_at'] ? String(r['completed_at']) : null,
      notes: r['notes'] as string | null,
      createdAt: String(r['created_at']),
    };
  }
}
