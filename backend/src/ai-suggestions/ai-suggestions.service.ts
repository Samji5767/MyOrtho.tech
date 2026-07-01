import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AiTreatmentSuggestion {
  id: string;
  organizationId: string;
  digitalSetupId: string;
  suggestionType: string;
  toothFdi: string | null;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
  supportingData: unknown;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
  applied: boolean;
  createdAt: Date;
}

// ─── Tooth position structure ─────────────────────────────────────────────────

interface ToothState {
  fdi: number;
  mesialMm: number;
  distalMm: number;
  buccalMm: number;
  lingualMm: number;
  intrusionMm: number;
  extrusionMm: number;
  mesialRotDeg: number;
  distalRotDeg: number;
  mesialTipDeg?: number;
  distalTipDeg?: number;
  torqueDeg: number;
  rootTranslationMm?: number;
  locked?: boolean;
  aiSuggested?: boolean;
}

// ─── Pending suggestion ───────────────────────────────────────────────────────

interface PendingSuggestion {
  type: string;
  toothFdi: string | null;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  confidence: number;
  supportingData: unknown;
}

// ─── Upper arch FDI adjacency pairs for IPR ───────────────────────────────────
const UPPER_ADJACENT: [number, number][] = [
  [12, 11], [11, 21], [21, 22],
  [13, 12], [22, 23],
  [14, 13], [23, 24],
];
const LOWER_ADJACENT: [number, number][] = [
  [42, 41], [41, 31], [31, 32],
  [43, 42], [32, 33],
  [44, 43], [33, 34],
];

// ─── Helper: total translation magnitude ─────────────────────────────────────

function translationMagnitude(t: ToothState): number {
  return Math.max(
    Math.abs(t.mesialMm),
    Math.abs(t.distalMm),
    Math.abs(t.buccalMm),
    Math.abs(t.lingualMm),
  );
}

function totalRotation(t: ToothState): number {
  return Math.abs(t.mesialRotDeg) + Math.abs(t.distalRotDeg);
}

// ─── Row mapper ───────────────────────────────────────────────────────────────

function mapRow(r: Record<string, unknown>): AiTreatmentSuggestion {
  return {
    id: r['id'] as string,
    organizationId: r['organization_id'] as string,
    digitalSetupId: r['digital_setup_id'] as string,
    suggestionType: r['suggestion_type'] as string,
    toothFdi: r['tooth_fdi'] as string | null,
    message: r['message'] as string,
    severity: r['severity'] as 'info' | 'warning' | 'critical',
    confidence: r['confidence'] !== null ? parseFloat(String(r['confidence'])) : 0,
    supportingData: r['supporting_data'],
    acknowledgedBy: r['acknowledged_by'] as string | null,
    acknowledgedAt: r['acknowledged_at'] as Date | null,
    applied: r['applied'] as boolean,
    createdAt: r['created_at'] as Date,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AiSuggestionsService {
  private readonly logger = new Logger(AiSuggestionsService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async generateSuggestions(
    orgId: string,
    setupId: string,
  ): Promise<AiTreatmentSuggestion[]> {
    // Verify ownership and fetch setup
    const { rows: setupRows } = await this.pool.query<Record<string, unknown>>(
      `SELECT id, tooth_positions, initial_positions FROM digital_setups
       WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!setupRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    const toothPositions: ToothState[] =
      (setupRows[0]['tooth_positions'] as ToothState[]) ?? [];
    const initialPositions: ToothState[] =
      (setupRows[0]['initial_positions'] as ToothState[]) ?? [];

    const initialMap = new Map<number, ToothState>(
      initialPositions.map((t) => [t.fdi, t]),
    );

    // Load existing attachments from treatment stages to check planned attachments
    const { rows: stageRows } = await this.pool.query<{ attachments: unknown }>(
      `SELECT attachments FROM treatment_stages
       WHERE digital_setup_id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    const teethWithAttachments = new Set<number>();
    for (const sr of stageRows) {
      const atts = (sr.attachments as Array<{ fdi: number; action: string }>) ?? [];
      for (const a of atts) {
        if (a.action === 'place') teethWithAttachments.add(a.fdi);
      }
    }

    const pending: PendingSuggestion[] = [];

    for (const tooth of toothPositions) {
      const init = initialMap.get(tooth.fdi);
      if (!init) continue;

      // ── Compute total movements from initial to final ─────────────────────
      const totalMesial   = Math.abs(tooth.mesialMm   - init.mesialMm);
      const totalDistal   = Math.abs(tooth.distalMm   - init.distalMm);
      const totalBuccal   = Math.abs(tooth.buccalMm   - init.buccalMm);
      const totalLingual  = Math.abs(tooth.lingualMm  - init.lingualMm);
      const totalIntrusion = Math.abs(tooth.intrusionMm - init.intrusionMm);
      const totalExtrusion = Math.abs(tooth.extrusionMm - init.extrusionMm);
      const totalRot      = Math.abs((tooth.mesialRotDeg - init.mesialRotDeg)) +
                             Math.abs((tooth.distalRotDeg - init.distalRotDeg));
      const totalTorque   = Math.abs(tooth.torqueDeg  - init.torqueDeg);

      const maxTrans = Math.max(totalMesial, totalDistal, totalBuccal, totalLingual);

      // 1. Translation > 3mm → reduce movement suggestion
      if (totalMesial > 3) {
        const direction = 'mesial';
        pending.push({
          type: 'reduce_translation',
          toothFdi: String(tooth.fdi),
          message: `Consider reducing ${direction} movement on tooth ${tooth.fdi} to minimize PDL strain`,
          severity: totalMesial > 6 ? 'critical' : 'warning',
          confidence: 0.88,
          supportingData: { fdi: tooth.fdi, direction, totalMm: parseFloat(totalMesial.toFixed(3)), threshold: 3 },
        });
      }
      if (totalDistal > 3) {
        const direction = 'distal';
        pending.push({
          type: 'reduce_translation',
          toothFdi: String(tooth.fdi),
          message: `Consider reducing ${direction} movement on tooth ${tooth.fdi} to minimize PDL strain`,
          severity: totalDistal > 6 ? 'critical' : 'warning',
          confidence: 0.88,
          supportingData: { fdi: tooth.fdi, direction, totalMm: parseFloat(totalDistal.toFixed(3)), threshold: 3 },
        });
      }
      if (totalBuccal > 3) {
        pending.push({
          type: 'reduce_translation',
          toothFdi: String(tooth.fdi),
          message: `Consider reducing buccal movement on tooth ${tooth.fdi} to minimize PDL strain`,
          severity: totalBuccal > 6 ? 'critical' : 'warning',
          confidence: 0.85,
          supportingData: { fdi: tooth.fdi, direction: 'buccal', totalMm: parseFloat(totalBuccal.toFixed(3)), threshold: 3 },
        });
      }
      if (totalLingual > 3) {
        pending.push({
          type: 'reduce_translation',
          toothFdi: String(tooth.fdi),
          message: `Consider reducing lingual movement on tooth ${tooth.fdi} to minimize PDL strain`,
          severity: totalLingual > 6 ? 'critical' : 'warning',
          confidence: 0.85,
          supportingData: { fdi: tooth.fdi, direction: 'lingual', totalMm: parseFloat(totalLingual.toFixed(3)), threshold: 3 },
        });
      }

      // 2. Rotation > 15° → suggest attachment
      if (totalRot > 15 && !teethWithAttachments.has(tooth.fdi)) {
        pending.push({
          type: 'add_attachment_rotation',
          toothFdi: String(tooth.fdi),
          message: `Add horizontal rectangular attachment on tooth ${tooth.fdi} — ${totalRot.toFixed(1)}° rotation requires mechanical retention`,
          severity: totalRot > 30 ? 'critical' : 'warning',
          confidence: 0.91,
          supportingData: { fdi: tooth.fdi, totalRotationDeg: parseFloat(totalRot.toFixed(2)), threshold: 15 },
        });
      }

      // 3. Torque > 12° → rectangular attachment for torque control
      if (totalTorque > 12) {
        pending.push({
          type: 'add_attachment_torque',
          toothFdi: String(tooth.fdi),
          message: `Add rectangular attachment on ${tooth.fdi} for improved torque control — ${totalTorque.toFixed(1)}° torque detected`,
          severity: totalTorque > 20 ? 'critical' : 'warning',
          confidence: 0.89,
          supportingData: { fdi: tooth.fdi, totalTorqueDeg: parseFloat(totalTorque.toFixed(2)), threshold: 12 },
        });
      }

      // 7. Intrusion > 2mm without attachment → suggest vertical rectangular attachment
      if (totalIntrusion > 2 && !teethWithAttachments.has(tooth.fdi)) {
        pending.push({
          type: 'add_attachment_intrusion',
          toothFdi: String(tooth.fdi),
          message: `Add vertical rectangular attachment on tooth ${tooth.fdi} — ${totalIntrusion.toFixed(1)}mm intrusion requires vertical force vector`,
          severity: 'warning',
          confidence: 0.87,
          supportingData: { fdi: tooth.fdi, intrusionMm: parseFloat(totalIntrusion.toFixed(3)), threshold: 2 },
        });
      }
    }

    // 4. Adjacent teeth overlapping buccal-lingual positions → suggest IPR
    const finalMap = new Map<number, ToothState>(toothPositions.map((t) => [t.fdi, t]));
    for (const [fdiA, fdiB] of [...UPPER_ADJACENT, ...LOWER_ADJACENT]) {
      const tA = finalMap.get(fdiA);
      const tB = finalMap.get(fdiB);
      if (!tA || !tB) continue;
      // Simple overlap proxy: if both teeth are moved buccally toward each other
      const overlapProxy = Math.min(tA.buccalMm, tB.buccalMm);
      if (overlapProxy > 1.5) {
        pending.push({
          type: 'ipr_suggestion',
          toothFdi: `${fdiA}-${fdiB}`,
          message: `Consider IPR of 0.2-0.3mm between teeth ${fdiA} and ${fdiB} — buccal displacement overlap detected`,
          severity: 'info',
          confidence: 0.78,
          supportingData: { fdiA, fdiB, buccalA: parseFloat(tA.buccalMm.toFixed(3)), buccalB: parseFloat(tB.buccalMm.toFixed(3)), overlapProxy: parseFloat(overlapProxy.toFixed(3)) },
        });
      }
    }

    // 5. Upper arch midline deviation > 2mm
    const upper11 = finalMap.get(11);
    const upper21 = finalMap.get(21);
    if (upper11 && upper21) {
      const midlineDeviation = Math.abs(upper11.mesialMm - upper21.mesialMm);
      if (midlineDeviation > 2) {
        pending.push({
          type: 'midline_correction',
          toothFdi: null,
          message: `Consider upper midline correction — current deviation exceeds 2mm (estimated ${midlineDeviation.toFixed(1)}mm)`,
          severity: midlineDeviation > 4 ? 'critical' : 'warning',
          confidence: 0.82,
          supportingData: { midlineDeviationMm: parseFloat(midlineDeviation.toFixed(3)), fdi11mesial: upper11.mesialMm, fdi21mesial: upper21.mesialMm },
        });
      }
    }

    // 6. Lower anterior crowding > 3mm without IPR plan
    const lowerAnterior = [41, 42, 43, 31, 32, 33];
    const totalLowerCrowding = lowerAnterior.reduce((sum, fdi) => {
      const t = finalMap.get(fdi);
      const i = initialMap.get(fdi);
      if (!t || !i) return sum;
      // Crowding expressed as mesial movement (teeth pushed together)
      return sum + Math.max(0, (t.mesialMm - i.mesialMm));
    }, 0);

    // Check if any IPR is planned for lower anterior
    const lowerIprPlanned = stageRows.some((sr) => {
      const pts = (sr as unknown as { ipr_points?: Array<{ mesialTooth: number; distalTooth: number }> }).ipr_points ?? [];
      return pts.some((p) => lowerAnterior.includes(p.mesialTooth) || lowerAnterior.includes(p.distalTooth));
    });

    if (totalLowerCrowding > 3 && !lowerIprPlanned) {
      pending.push({
        type: 'lower_ipr_suggestion',
        toothFdi: null,
        message: `Anterior IPR of 0.5mm per contact may reduce aligner count — lower anterior crowding estimated at ${totalLowerCrowding.toFixed(1)}mm`,
        severity: 'info',
        confidence: 0.80,
        supportingData: { totalCrowdingMm: parseFloat(totalLowerCrowding.toFixed(3)), threshold: 3, iprSuggested: '0.5mm per contact' },
      });
    }

    // Deduplicate by type + toothFdi before inserting
    const seen = new Set<string>();
    const unique: PendingSuggestion[] = [];
    for (const s of pending) {
      const key = `${s.type}:${s.toothFdi ?? 'null'}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }

    // Delete previous unacknowledged suggestions for this setup
    await this.pool.query(
      `DELETE FROM ai_treatment_suggestions
       WHERE digital_setup_id = $1 AND organization_id = $2
         AND acknowledged_by IS NULL AND applied = false`,
      [setupId, orgId],
    );

    // Insert new suggestions
    const inserted: AiTreatmentSuggestion[] = [];
    for (const s of unique) {
      const { rows } = await this.pool.query<Record<string, unknown>>(
        `INSERT INTO ai_treatment_suggestions
           (organization_id, digital_setup_id, suggestion_type, tooth_fdi,
            message, severity, confidence, supporting_data)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          orgId,
          setupId,
          s.type,
          s.toothFdi,
          s.message,
          s.severity,
          s.confidence.toFixed(3),
          JSON.stringify(s.supportingData),
        ],
      );
      inserted.push(mapRow(rows[0]!));
    }

    this.logger.log(
      `Generated ${inserted.length} AI suggestions for setup ${setupId}`,
    );
    return inserted;
  }

  async listSuggestions(
    orgId: string,
    setupId: string,
    onlyActive?: boolean,
  ): Promise<AiTreatmentSuggestion[]> {
    const { rows: ownerRows } = await this.pool.query<{ id: string }>(
      `SELECT id FROM digital_setups WHERE id = $1 AND organization_id = $2`,
      [setupId, orgId],
    );
    if (!ownerRows[0]) throw new NotFoundException(`Digital setup ${setupId} not found`);

    let query = `SELECT * FROM ai_treatment_suggestions
                 WHERE digital_setup_id = $1 AND organization_id = $2`;
    if (onlyActive) {
      query += ` AND acknowledged_by IS NULL AND applied = false`;
    }
    query += ` ORDER BY severity DESC, created_at DESC`;

    const { rows } = await this.pool.query<Record<string, unknown>>(query, [
      setupId,
      orgId,
    ]);
    return rows.map(mapRow);
  }

  async acknowledgeSuggestion(
    orgId: string,
    suggestionId: string,
    userId: string,
  ): Promise<AiTreatmentSuggestion> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `UPDATE ai_treatment_suggestions
       SET acknowledged_by = $1, acknowledged_at = now()
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [userId, suggestionId, orgId],
    );
    if (!rows[0]) {
      throw new NotFoundException(`AI suggestion ${suggestionId} not found`);
    }
    return mapRow(rows[0]);
  }

  async applySuggestion(
    orgId: string,
    suggestionId: string,
    userId: string,
  ): Promise<AiTreatmentSuggestion> {
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `UPDATE ai_treatment_suggestions
       SET applied = true, acknowledged_by = $1, acknowledged_at = COALESCE(acknowledged_at, now())
       WHERE id = $2 AND organization_id = $3
       RETURNING *`,
      [userId, suggestionId, orgId],
    );
    if (!rows[0]) {
      throw new NotFoundException(`AI suggestion ${suggestionId} not found`);
    }
    return mapRow(rows[0]);
  }
}
