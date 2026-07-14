import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface AiModelRegistry {
  id: string;
  organizationId: string | null;
  name: string;
  modelType: string;
  version: string;
  status: string;
  provider: string;
  artifactPath: string | null;
  metricsJson: Record<string, unknown>;
  deployedAt: string | null;
  deprecatedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiInferenceAudit {
  id: string;
  organizationId: string;
  modelId: string | null;
  modelName: string;
  modelVersion: string;
  invokedBy: string;
  caseId: string | null;
  patientId: string | null;
  inputHash: string | null;
  outputSummary: string | null;
  latencyMs: number | null;
  tokensUsed: number | null;
  outcome: string | null;
  disclaimerShown: boolean;
  createdAt: string;
}

const VALID_MODEL_TYPES = [
  'segmentation', 'movement_prediction', 'treatment_proposal', 'qa_scoring', 'other',
];
const VALID_STATUSES = ['staged', 'active', 'deprecated', 'rolled_back'];
const VALID_PROVIDERS = ['internal', 'openai', 'anthropic', 'custom'];
const VALID_OUTCOMES = ['accepted', 'modified', 'rejected', 'pending_review'];

@Injectable()
export class MlopsService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  // ─── Model Registry ───────────────────────────────────────────────────────────

  async listModels(orgId?: string, status?: string): Promise<AiModelRegistry[]> {
    const conditions: string[] = ['(organization_id IS NULL OR organization_id = $1)'];
    const params: unknown[] = [orgId ?? null];
    if (status) { params.push(status); conditions.push(`status = $${params.length}`); }
    const { rows } = await this.db.query(
      `SELECT * FROM ai_model_registry
       WHERE ${conditions.join(' AND ')}
       ORDER BY model_type, name, version DESC`,
      params,
    );
    return rows.map(this.mapModel);
  }

  async getModel(id: string): Promise<AiModelRegistry> {
    const { rows } = await this.db.query(
      `SELECT * FROM ai_model_registry WHERE id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Model not found');
    return this.mapModel(rows[0]);
  }

  async registerModel(
    createdBy: string,
    dto: {
      name: string;
      modelType: string;
      version: string;
      provider?: string;
      artifactPath?: string;
      metricsJson?: Record<string, unknown>;
      organizationId?: string;
    },
  ): Promise<AiModelRegistry> {
    if (!VALID_MODEL_TYPES.includes(dto.modelType)) {
      throw new BadRequestException(`Invalid model type. Valid: ${VALID_MODEL_TYPES.join(', ')}`);
    }
    if (dto.provider && !VALID_PROVIDERS.includes(dto.provider)) {
      throw new BadRequestException(`Invalid provider. Valid: ${VALID_PROVIDERS.join(', ')}`);
    }
    const { rows } = await this.db.query(
      `INSERT INTO ai_model_registry
         (organization_id, name, model_type, version, provider, artifact_path, metrics_json, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        dto.organizationId ?? null,
        dto.name,
        dto.modelType,
        dto.version,
        dto.provider ?? 'internal',
        dto.artifactPath ?? null,
        JSON.stringify(dto.metricsJson ?? {}),
        createdBy,
      ],
    );
    return this.mapModel(rows[0]);
  }

  async updateModelStatus(id: string, newStatus: string): Promise<AiModelRegistry> {
    if (!VALID_STATUSES.includes(newStatus)) {
      throw new BadRequestException(`Invalid status. Valid: ${VALID_STATUSES.join(', ')}`);
    }

    const extra =
      newStatus === 'active'
        ? ', deployed_at = COALESCE(deployed_at, NOW())'
        : newStatus === 'deprecated' || newStatus === 'rolled_back'
          ? ', deprecated_at = NOW()'
          : '';

    const { rows } = await this.db.query(
      `UPDATE ai_model_registry
       SET status = $2, updated_at = NOW()${extra}
       WHERE id = $1
       RETURNING *`,
      [id, newStatus],
    );
    if (!rows[0]) throw new NotFoundException('Model not found');
    return this.mapModel(rows[0]);
  }

  // ─── Inference Audit ──────────────────────────────────────────────────────────

  async recordInference(
    orgId: string,
    dto: {
      modelName: string;
      modelVersion: string;
      invokedBy: string;
      modelId?: string;
      caseId?: string;
      patientId?: string;
      inputHash?: string;
      outputSummary?: string;
      latencyMs?: number;
      tokensUsed?: number;
      outcome?: string;
      disclaimerShown?: boolean;
    },
  ): Promise<AiInferenceAudit> {
    if (dto.outcome && !VALID_OUTCOMES.includes(dto.outcome)) {
      throw new BadRequestException(`Invalid outcome. Valid: ${VALID_OUTCOMES.join(', ')}`);
    }
    const { rows } = await this.db.query(
      `INSERT INTO ai_inference_audit
         (organization_id, model_id, model_name, model_version, invoked_by,
          case_id, patient_id, input_hash, output_summary, latency_ms,
          tokens_used, outcome, disclaimer_shown)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        orgId,
        dto.modelId ?? null,
        dto.modelName,
        dto.modelVersion,
        dto.invokedBy,
        dto.caseId ?? null,
        dto.patientId ?? null,
        dto.inputHash ?? null,
        dto.outputSummary ?? null,
        dto.latencyMs ?? null,
        dto.tokensUsed ?? null,
        dto.outcome ?? null,
        dto.disclaimerShown ?? true,
      ],
    );
    return this.mapAudit(rows[0]);
  }

  async listInferenceAudit(
    orgId: string,
    opts: { caseId?: string; modelId?: string; limit?: number },
  ): Promise<AiInferenceAudit[]> {
    const conditions = ['organization_id = $1'];
    const params: unknown[] = [orgId];
    if (opts.caseId) { params.push(opts.caseId); conditions.push(`case_id = $${params.length}`); }
    if (opts.modelId) { params.push(opts.modelId); conditions.push(`model_id = $${params.length}`); }
    params.push(opts.limit ?? 100);
    const { rows } = await this.db.query(
      `SELECT * FROM ai_inference_audit
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map(this.mapAudit);
  }

  async getUtilizationStats(orgId: string): Promise<{
    totalInferences: number;
    byModel: Record<string, number>;
    byOutcome: Record<string, number>;
    disclaimerShownRate: number;
  }> {
    const { rows } = await this.db.query(
      `SELECT
         COUNT(*)::int AS total,
         model_name,
         outcome,
         AVG(CASE WHEN disclaimer_shown THEN 1 ELSE 0 END) AS disclaimer_rate
       FROM ai_inference_audit
       WHERE organization_id = $1
       GROUP BY model_name, outcome`,
      [orgId],
    );

    let total = 0;
    let disclaimerSum = 0;
    const byModel: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};

    for (const r of rows) {
      const count = r['total'] as number;
      total += count;
      const model = r['model_name'] as string;
      byModel[model] = (byModel[model] ?? 0) + count;
      const outcome = (r['outcome'] as string | null) ?? 'pending_review';
      byOutcome[outcome] = (byOutcome[outcome] ?? 0) + count;
      disclaimerSum += Number(r['disclaimer_rate']) * count;
    }

    return {
      totalInferences: total,
      byModel,
      byOutcome,
      disclaimerShownRate: total > 0 ? disclaimerSum / total : 1,
    };
  }

  private mapModel(r: Record<string, unknown>): AiModelRegistry {
    return {
      id: r['id'] as string,
      organizationId: (r['organization_id'] as string | null) ?? null,
      name: r['name'] as string,
      modelType: r['model_type'] as string,
      version: r['version'] as string,
      status: r['status'] as string,
      provider: r['provider'] as string,
      artifactPath: (r['artifact_path'] as string | null) ?? null,
      metricsJson: (r['metrics_json'] as Record<string, unknown>) ?? {},
      deployedAt: r['deployed_at'] ? String(r['deployed_at']) : null,
      deprecatedAt: r['deprecated_at'] ? String(r['deprecated_at']) : null,
      createdBy: r['created_by'] as string,
      createdAt: String(r['created_at']),
      updatedAt: String(r['updated_at']),
    };
  }

  private mapAudit(r: Record<string, unknown>): AiInferenceAudit {
    return {
      id: r['id'] as string,
      organizationId: r['organization_id'] as string,
      modelId: (r['model_id'] as string | null) ?? null,
      modelName: r['model_name'] as string,
      modelVersion: r['model_version'] as string,
      invokedBy: r['invoked_by'] as string,
      caseId: (r['case_id'] as string | null) ?? null,
      patientId: (r['patient_id'] as string | null) ?? null,
      inputHash: (r['input_hash'] as string | null) ?? null,
      outputSummary: (r['output_summary'] as string | null) ?? null,
      latencyMs: r['latency_ms'] != null ? Number(r['latency_ms']) : null,
      tokensUsed: r['tokens_used'] != null ? Number(r['tokens_used']) : null,
      outcome: (r['outcome'] as string | null) ?? null,
      disclaimerShown: Boolean(r['disclaimer_shown']),
      createdAt: String(r['created_at']),
    };
  }
}
