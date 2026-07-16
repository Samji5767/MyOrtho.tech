import { Injectable, Inject, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { IsString, IsOptional, IsIn } from 'class-validator';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

const CATEGORIES = ['bug','usability','clinical_workflow','manufacturing','missing_capability','performance','training_request','general'] as const;
const SEVERITIES = ['critical','high','medium','low'] as const;
const STATUSES = ['open','triaged','in_progress','resolved','wont_fix'] as const;

export class CreateFeedbackDto {
  @IsIn(CATEGORIES) category!: (typeof CATEGORIES)[number];
  @IsIn(SEVERITIES) @IsOptional() severity?: (typeof SEVERITIES)[number];
  @IsString() description!: string;
  @IsString() @IsOptional() pageRoute?: string;
  @IsString() @IsOptional() browserInfo?: string;
  @IsString() @IsOptional() correlationId?: string;
  @IsString() @IsOptional() screenshotRef?: string;
}

export class UpdateFeedbackDto {
  @IsIn(STATUSES) @IsOptional() status?: (typeof STATUSES)[number];
  @IsString() @IsOptional() resolutionNotes?: string;
  @IsString() @IsOptional() assignedTo?: string;
}

export interface FeedbackItem {
  id: string;
  organizationId: string;
  submittedBy: string;
  submitterEmail?: string;
  category: string;
  severity: string;
  description: string;
  pageRoute?: string;
  browserInfo?: string;
  correlationId?: string;
  screenshotRef?: string;
  status: string;
  assignedTo?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class PilotFeedbackService {
  private readonly logger = new Logger(PilotFeedbackService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(orgId: string, submittedBy: string, dto: CreateFeedbackDto): Promise<FeedbackItem> {
    const { rows } = await this.pool.query(
      `INSERT INTO pilot_feedback
         (organization_id, submitted_by, category, severity, description,
          page_route, browser_info, correlation_id, screenshot_ref)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at, updated_at`,
      [
        orgId, submittedBy,
        dto.category, dto.severity ?? 'medium', dto.description,
        dto.pageRoute ?? null, dto.browserInfo ?? null,
        dto.correlationId ?? null, dto.screenshotRef ?? null,
      ],
    );
    this.logger.log(`Pilot feedback ${rows[0].id as string} submitted by ${submittedBy} (${dto.category}/${dto.severity ?? 'medium'})`);
    return this.findOne(rows[0].id as string, orgId);
  }

  async list(orgId: string, status?: string, category?: string): Promise<FeedbackItem[]> {
    const params: unknown[] = [orgId];
    const filters: string[] = [];
    if (status) { params.push(status); filters.push(`pf.status = $${params.length}`); }
    if (category) { params.push(category); filters.push(`pf.category = $${params.length}`); }

    const where = filters.length ? `AND ${filters.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT pf.id, pf.organization_id, pf.submitted_by, au.email AS submitter_email,
              pf.category, pf.severity, pf.description, pf.page_route, pf.browser_info,
              pf.correlation_id, pf.screenshot_ref, pf.status, pf.assigned_to,
              pf.resolution_notes, pf.created_at, pf.updated_at
       FROM pilot_feedback pf
       LEFT JOIN auth_users au ON au.id = pf.submitted_by
       WHERE pf.organization_id = $1 ${where}
       ORDER BY pf.created_at DESC`,
      params,
    );
    return rows.map(this.mapRow);
  }

  async findOne(id: string, orgId: string): Promise<FeedbackItem> {
    const { rows } = await this.pool.query(
      `SELECT pf.id, pf.organization_id, pf.submitted_by, au.email AS submitter_email,
              pf.category, pf.severity, pf.description, pf.page_route, pf.browser_info,
              pf.correlation_id, pf.screenshot_ref, pf.status, pf.assigned_to,
              pf.resolution_notes, pf.created_at, pf.updated_at
       FROM pilot_feedback pf
       LEFT JOIN auth_users au ON au.id = pf.submitted_by
       WHERE pf.id = $1 AND pf.organization_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException('Feedback item not found');
    return this.mapRow(rows[0]);
  }

  async update(id: string, orgId: string, dto: UpdateFeedbackDto): Promise<FeedbackItem> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (dto.status !== undefined) { values.push(dto.status); fields.push(`status = $${values.length}`); }
    if (dto.resolutionNotes !== undefined) { values.push(dto.resolutionNotes); fields.push(`resolution_notes = $${values.length}`); }
    if (dto.assignedTo !== undefined) { values.push(dto.assignedTo); fields.push(`assigned_to = $${values.length}`); }

    if (fields.length === 0) return this.findOne(id, orgId);

    values.push(new Date().toISOString()); fields.push(`updated_at = $${values.length}`);
    values.push(id); values.push(orgId);

    await this.pool.query(
      `UPDATE pilot_feedback SET ${fields.join(', ')} WHERE id = $${values.length - 1} AND organization_id = $${values.length}`,
      values,
    );
    return this.findOne(id, orgId);
  }

  private mapRow(r: Record<string, unknown>): FeedbackItem {
    return {
      id: r.id as string,
      organizationId: r.organization_id as string,
      submittedBy: r.submitted_by as string,
      submitterEmail: r.submitter_email as string | undefined,
      category: r.category as string,
      severity: r.severity as string,
      description: r.description as string,
      pageRoute: r.page_route as string | undefined,
      browserInfo: r.browser_info as string | undefined,
      correlationId: r.correlation_id as string | undefined,
      screenshotRef: r.screenshot_ref as string | undefined,
      status: r.status as string,
      assignedTo: r.assigned_to as string | undefined,
      resolutionNotes: r.resolution_notes as string | undefined,
      createdAt: (r.created_at as Date).toISOString(),
      updatedAt: (r.updated_at as Date).toISOString(),
    };
  }
}
