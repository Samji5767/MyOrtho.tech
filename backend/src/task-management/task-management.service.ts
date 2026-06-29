import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface ClinicalTask {
  id: string; caseId: string | null; patientId: string | null; title: string;
  description: string | null; assignedTo: string | null; createdBy: string;
  dueDate: string | null; priority: string; status: string;
  completedAt: string | null; createdAt: string;
}

@Injectable()
export class TaskManagementService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listTasks(orgId: string, opts: { assignedTo?: string; caseId?: string; status?: string }): Promise<ClinicalTask[]> {
    let where = 'WHERE organization_id=$1';
    const params: unknown[] = [orgId];
    if (opts.assignedTo) { params.push(opts.assignedTo); where += ` AND assigned_to=$${params.length}`; }
    if (opts.caseId)     { params.push(opts.caseId);     where += ` AND case_id=$${params.length}`; }
    if (opts.status)     { params.push(opts.status);     where += ` AND status=$${params.length}`; }

    const { rows } = await this.db.query(
      `SELECT * FROM clinical_tasks ${where} ORDER BY priority='urgent' DESC, due_date ASC NULLS LAST, created_at DESC LIMIT 100`,
      params,
    );
    return rows.map(this.map);
  }

  async createTask(orgId: string, createdBy: string, dto: {
    title: string; description?: string; assignedTo?: string; caseId?: string;
    patientId?: string; dueDate?: string; priority?: string;
  }): Promise<ClinicalTask> {
    const { rows } = await this.db.query(
      `INSERT INTO clinical_tasks
         (organization_id, case_id, patient_id, title, description, assigned_to, created_by, due_date, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [orgId, dto.caseId ?? null, dto.patientId ?? null, dto.title, dto.description ?? null,
       dto.assignedTo ?? null, createdBy, dto.dueDate ?? null, dto.priority ?? 'normal'],
    );
    return this.map(rows[0]);
  }

  async updateTaskStatus(taskId: string, orgId: string, status: string): Promise<ClinicalTask> {
    const extra = status === 'completed' ? ', completed_at=now()' : '';
    const { rows } = await this.db.query(
      `UPDATE clinical_tasks SET status=$2${extra}, updated_at=now() WHERE id=$1 AND organization_id=$3 RETURNING *`,
      [taskId, status, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Task not found');
    return this.map(rows[0]);
  }

  async getMyTasks(orgId: string, userId: string): Promise<ClinicalTask[]> {
    return this.listTasks(orgId, { assignedTo: userId, status: 'open' });
  }

  private map(r: Record<string, unknown>): ClinicalTask {
    return {
      id: r['id'] as string, caseId: r['case_id'] as string | null, patientId: r['patient_id'] as string | null,
      title: r['title'] as string, description: r['description'] as string | null,
      assignedTo: r['assigned_to'] as string | null, createdBy: r['created_by'] as string,
      dueDate: r['due_date'] ? String(r['due_date']) : null, priority: r['priority'] as string,
      status: r['status'] as string, completedAt: r['completed_at'] ? String(r['completed_at']) : null,
      createdAt: String(r['created_at']),
    };
  }
}
