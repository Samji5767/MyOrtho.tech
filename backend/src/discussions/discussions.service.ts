import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export class CreateDiscussionDto {
  @IsString()
  @MaxLength(10000)
  content: string;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  mentionedUserIds?: string[];

  @IsUUID('4')
  @IsOptional()
  parentId?: string;
}

export class ResolveDiscussionDto {
  @IsBoolean()
  resolved: boolean;
}

export interface DiscussionComment {
  id: string;
  caseId: string;
  content: string;
  mentionedUserIds: string[];
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  parentId: string | null;
  authorId: string;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class DiscussionsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async listByCaseId(caseId: string, orgId: string): Promise<DiscussionComment[]> {
    await this.assertCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `SELECT d.id, d.case_id, d.content, d.mentioned_user_ids, d.resolved,
              d.resolved_at, d.resolved_by, d.parent_id, d.author_id,
              d.created_at, d.updated_at,
              u.name AS author_name, u.email AS author_email
       FROM case_discussions d
       LEFT JOIN auth_users u ON u.id = d.author_id
       WHERE d.case_id = $1 AND d.organization_id = $2
       ORDER BY d.created_at ASC`,
      [caseId, orgId],
    );
    return rows.map(this.mapRow);
  }

  async create(
    caseId: string,
    orgId: string,
    authorId: string,
    dto: CreateDiscussionDto,
  ): Promise<DiscussionComment> {
    await this.assertCaseOwnership(caseId, orgId);
    const { rows } = await this.pool.query(
      `INSERT INTO case_discussions
         (organization_id, case_id, author_id, content, mentioned_user_ids, parent_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        orgId,
        caseId,
        authorId,
        dto.content,
        dto.mentionedUserIds ?? [],
        dto.parentId ?? null,
      ],
    );
    const row = rows[0];
    const userRow = await this.pool.query(
      `SELECT name, email FROM auth_users WHERE id = $1`,
      [authorId],
    );
    return this.mapRow({ ...row, author_name: userRow.rows[0]?.['name'] ?? null, author_email: userRow.rows[0]?.['email'] ?? null });
  }

  async resolve(
    id: string,
    orgId: string,
    actorId: string,
    dto: ResolveDiscussionDto,
  ): Promise<DiscussionComment> {
    const existing = await this.findOne(id, orgId);

    const { rows } = await this.pool.query(
      `UPDATE case_discussions
       SET resolved = $1,
           resolved_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           resolved_by = CASE WHEN $1 THEN $2 ELSE NULL END,
           updated_at = NOW()
       WHERE id = $3 AND organization_id = $4
       RETURNING *`,
      [dto.resolved, actorId, id, orgId],
    );
    if (!rows[0]) throw new NotFoundException(`Discussion ${id} not found`);
    const userRow = await this.pool.query(
      `SELECT name, email FROM auth_users WHERE id = $1`,
      [existing.authorId],
    );
    return this.mapRow({ ...rows[0], author_name: userRow.rows[0]?.['name'] ?? null, author_email: userRow.rows[0]?.['email'] ?? null });
  }

  async delete(id: string, orgId: string, actorId: string): Promise<void> {
    const existing = await this.findOne(id, orgId);
    if (existing.authorId !== actorId) {
      throw new ForbiddenException('Only the author can delete a discussion comment');
    }
    await this.pool.query(
      `DELETE FROM case_discussions WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
  }

  private async findOne(id: string, orgId: string): Promise<DiscussionComment> {
    const { rows } = await this.pool.query(
      `SELECT d.*, u.name AS author_name, u.email AS author_email
       FROM case_discussions d
       LEFT JOIN auth_users u ON u.id = d.author_id
       WHERE d.id = $1 AND d.organization_id = $2`,
      [id, orgId],
    );
    if (!rows[0]) throw new NotFoundException(`Discussion ${id} not found`);
    return this.mapRow(rows[0]);
  }

  private async assertCaseOwnership(caseId: string, orgId: string): Promise<void> {
    const { rows } = await this.pool.query(
      `SELECT id FROM cases WHERE id = $1 AND organization_id = $2`,
      [caseId, orgId],
    );
    if (!rows[0]) throw new NotFoundException(`Case ${caseId} not found`);
  }

  private mapRow(row: Record<string, unknown>): DiscussionComment {
    return {
      id: row['id'] as string,
      caseId: row['case_id'] as string,
      content: row['content'] as string,
      mentionedUserIds: (row['mentioned_user_ids'] as string[]) ?? [],
      resolved: row['resolved'] as boolean,
      resolvedAt: (row['resolved_at'] as string | null) ?? null,
      resolvedBy: (row['resolved_by'] as string | null) ?? null,
      parentId: (row['parent_id'] as string | null) ?? null,
      authorId: row['author_id'] as string,
      authorName: (row['author_name'] as string | null) ?? null,
      authorEmail: (row['author_email'] as string | null) ?? null,
      createdAt: row['created_at'] as string,
      updatedAt: row['updated_at'] as string,
    };
  }
}
