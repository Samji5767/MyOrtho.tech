import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface AuditBeginDto {
  organizationId: string;
  invokedBy: string;
  modelName: string;
  modelVersion: string;
  inferenceType: string;
  correlationId?: string;
  modelId?: string;
  caseId?: string;
  patientId?: string;
  inputHash?: string;
  inputMetadata?: Record<string, unknown>;
  checkpointChecksum?: string;
  disclaimerShown?: boolean;
}

export interface AuditFinalizeDto {
  outcome?: string;
  outputSummary?: string;
  outputMetadata?: Record<string, unknown>;
  latencyMs?: number;
  tokensUsed?: number;
  confidenceScore?: number;
  fallbackUsed?: boolean;
  manualReviewRequired?: boolean;
}

export interface AuditRecord {
  id: string;
  organizationId: string;
  correlationId: string | null;
  modelId: string | null;
  modelName: string;
  modelVersion: string;
  inferenceType: string | null;
  invokedBy: string;
  caseId: string | null;
  patientId: string | null;
  inputHash: string | null;
  outputSummary: string | null;
  latencyMs: number | null;
  tokensUsed: number | null;
  confidenceScore: number | null;
  outcome: string | null;
  disclaimerShown: boolean;
  fallbackUsed: boolean;
  manualReviewRequired: boolean;
  auditStatus: string;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
}

@Injectable()
export class AiAuditService {
  private readonly log = new Logger(AiAuditService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async beginAudit(dto: AuditBeginDto): Promise<AuditRecord> {
    const { rows } = await this.db.query(
      `INSERT INTO ai_inference_audit
         (organization_id, correlation_id, model_id, model_name, model_version,
          inference_type, invoked_by, case_id, patient_id, input_hash,
          input_metadata, checkpoint_checksum, disclaimer_shown, audit_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'in_progress')
       RETURNING *`,
      [
        dto.organizationId,
        dto.correlationId ?? null,
        dto.modelId ?? null,
        dto.modelName,
        dto.modelVersion,
        dto.inferenceType,
        dto.invokedBy,
        dto.caseId ?? null,
        dto.patientId ?? null,
        dto.inputHash ?? null,
        dto.inputMetadata ? JSON.stringify(dto.inputMetadata) : null,
        dto.checkpointChecksum ?? null,
        dto.disclaimerShown ?? true,
      ],
    );
    return this.map(rows[0]);
  }

  async finalizeAudit(auditId: string, dto: AuditFinalizeDto): Promise<AuditRecord> {
    const { rows } = await this.db.query(
      `UPDATE ai_inference_audit
       SET audit_status          = 'completed',
           completed_at          = NOW(),
           outcome               = COALESCE($2, outcome),
           output_summary        = COALESCE($3, output_summary),
           output_metadata       = COALESCE($4, output_metadata),
           latency_ms            = COALESCE($5, latency_ms),
           tokens_used           = COALESCE($6, tokens_used),
           confidence_score      = COALESCE($7, confidence_score),
           fallback_used         = COALESCE($8, fallback_used),
           manual_review_required = COALESCE($9, manual_review_required)
       WHERE id = $1
       RETURNING *`,
      [
        auditId,
        dto.outcome ?? null,
        dto.outputSummary ?? null,
        dto.outputMetadata ? JSON.stringify(dto.outputMetadata) : null,
        dto.latencyMs ?? null,
        dto.tokensUsed ?? null,
        dto.confidenceScore ?? null,
        dto.fallbackUsed ?? null,
        dto.manualReviewRequired ?? null,
      ],
    );
    if (!rows[0]) {
      this.log.warn(`finalizeAudit: audit record ${auditId} not found`);
    }
    return this.map(rows[0]);
  }

  async failAudit(auditId: string, errorCode: string, errorMessage?: string): Promise<void> {
    await this.db.query(
      `UPDATE ai_inference_audit
       SET audit_status  = 'failed',
           completed_at  = NOW(),
           error_code    = $2,
           output_summary = COALESCE($3, output_summary)
       WHERE id = $1`,
      [auditId, errorCode, errorMessage ?? null],
    );
  }

  private map(r: Record<string, unknown>): AuditRecord {
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      correlationId: (r['correlation_id'] as string | null) ?? null,
      modelId: (r['model_id'] as string | null) ?? null,
      modelName: r['model_name'] as string,
      modelVersion: r['model_version'] as string,
      inferenceType: (r['inference_type'] as string | null) ?? null,
      invokedBy: r['invoked_by'] as string,
      caseId: (r['case_id'] as string | null) ?? null,
      patientId: (r['patient_id'] as string | null) ?? null,
      inputHash: (r['input_hash'] as string | null) ?? null,
      outputSummary: (r['output_summary'] as string | null) ?? null,
      latencyMs: r['latency_ms'] != null ? Number(r['latency_ms']) : null,
      tokensUsed: r['tokens_used'] != null ? Number(r['tokens_used']) : null,
      confidenceScore: r['confidence_score'] != null ? Number(r['confidence_score']) : null,
      outcome: (r['outcome'] as string | null) ?? null,
      disclaimerShown: Boolean(r['disclaimer_shown']),
      fallbackUsed: Boolean(r['fallback_used']),
      manualReviewRequired: Boolean(r['manual_review_required']),
      auditStatus: (r['audit_status'] as string) ?? 'completed',
      errorCode: (r['error_code'] as string | null) ?? null,
      createdAt: String(r['created_at']),
      completedAt: r['completed_at'] ? String(r['completed_at']) : null,
    };
  }
}
