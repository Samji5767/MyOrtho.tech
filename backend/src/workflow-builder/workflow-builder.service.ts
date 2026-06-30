import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

const VALID_TRIGGERS = ['case_created','case_status_changed','appointment_scheduled','scan_uploaded','plan_approved','consent_signed','check_in_received'];

export interface WorkflowTemplate {
  id: string; name: string; description: string | null; triggerEvent: string;
  steps: WorkflowStep[]; isActive: boolean; createdAt: string;
}

interface WorkflowStep {
  type: 'send_notification' | 'update_status' | 'create_appointment' | 'create_task';
  config: Record<string, unknown>;
}

export interface WorkflowExecution {
  id: string; templateId: string; status: string; currentStep: number;
  triggerData: Record<string, unknown>; result: Record<string, unknown> | null;
  startedAt: string; completedAt: string | null;
}

@Injectable()
export class WorkflowBuilderService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async listTemplates(orgId: string): Promise<WorkflowTemplate[]> {
    const { rows } = await this.db.query(
      'SELECT * FROM workflow_templates WHERE organization_id=$1 ORDER BY name', [orgId],
    );
    return rows.map(this.mapTemplate);
  }

  async createTemplate(orgId: string, createdBy: string, dto: {
    name: string; description?: string; triggerEvent: string; steps: WorkflowStep[];
  }): Promise<WorkflowTemplate> {
    if (!VALID_TRIGGERS.includes(dto.triggerEvent)) {
      throw new BadRequestException(`Invalid trigger. Valid triggers: ${VALID_TRIGGERS.join(', ')}`);
    }
    const { rows } = await this.db.query(
      `INSERT INTO workflow_templates (organization_id, name, description, trigger_event, steps, created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, dto.name, dto.description ?? null, dto.triggerEvent, JSON.stringify(dto.steps), createdBy],
    );
    return this.mapTemplate(rows[0]);
  }

  async toggleTemplate(templateId: string, orgId: string, isActive: boolean): Promise<WorkflowTemplate> {
    const { rows } = await this.db.query(
      'UPDATE workflow_templates SET is_active=$2, updated_at=now() WHERE id=$1 AND organization_id=$3 RETURNING *',
      [templateId, isActive, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Workflow template not found');
    return this.mapTemplate(rows[0]);
  }

  async executeWorkflow(templateId: string, orgId: string, triggerData: Record<string, unknown>): Promise<WorkflowExecution> {
    const { rows: t } = await this.db.query(
      'SELECT * FROM workflow_templates WHERE id=$1 AND organization_id=$2 AND is_active=TRUE', [templateId, orgId],
    );
    if (!t[0]) throw new NotFoundException('Active workflow template not found');

    const steps = t[0]['steps'] as WorkflowStep[];
    const result: Record<string, unknown> = { stepsScheduled: steps.length, actions: steps.map(s => s.type) };

    const { rows } = await this.db.query(
      `INSERT INTO workflow_executions (organization_id, template_id, trigger_data, status, current_step, result, completed_at)
       VALUES ($1,$2,$3,'completed',$4,$5,now()) RETURNING *`,
      [orgId, templateId, JSON.stringify(triggerData), steps.length, JSON.stringify(result)],
    );
    return this.mapExecution(rows[0]);
  }

  async listExecutions(orgId: string, templateId?: string): Promise<WorkflowExecution[]> {
    const { rows } = await this.db.query(
      `SELECT * FROM workflow_executions WHERE organization_id=$1 ${templateId ? 'AND template_id=$2' : ''} ORDER BY started_at DESC LIMIT 50`,
      templateId ? [orgId, templateId] : [orgId],
    );
    return rows.map(this.mapExecution);
  }

  private mapTemplate(r: Record<string, unknown>): WorkflowTemplate {
    return {
      id: r['id'] as string, name: r['name'] as string, description: r['description'] as string | null,
      triggerEvent: r['trigger_event'] as string, steps: (r['steps'] as WorkflowStep[]) ?? [],
      isActive: r['is_active'] as boolean, createdAt: String(r['created_at']),
    };
  }

  private mapExecution(r: Record<string, unknown>): WorkflowExecution {
    return {
      id: r['id'] as string, templateId: r['template_id'] as string,
      status: r['status'] as string, currentStep: r['current_step'] as number,
      triggerData: r['trigger_data'] as Record<string, unknown>,
      result: r['result'] as Record<string, unknown> | null,
      startedAt: String(r['started_at']),
      completedAt: r['completed_at'] ? String(r['completed_at']) : null,
    };
  }
}
