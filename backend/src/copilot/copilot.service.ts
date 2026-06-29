import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CopilotMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  intent: string | null;
  referencedModule: string | null;
  suggestions: CopilotSuggestion[];
  latencyMs: number | null;
  createdAt: string;
}

export interface CopilotConversation {
  id: string;
  caseId: string;
  planId: string | null;
  title: string | null;
  messageCount: number;
  contextSnapshot: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CopilotSuggestion {
  id: string;
  suggestionType: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  module: string;
  data: Record<string, unknown>;
  status: 'open' | 'acknowledged' | 'dismissed' | 'applied';
  clinicianNote: string | null;
  createdAt: string;
}

export interface SendMessageDto {
  content: string;
}

// ─── Intent classifier ────────────────────────────────────────────────────────

const MODULE_KEYWORDS: Record<string, string[]> = {
  prescriptions:  ['prescription', 'movement', 'translation', 'rotation', 'torque', 'tip', 'intrusion', 'extrusion', 'expansion'],
  ipr:            ['ipr', 'enamel', 'interproximal', 'reduction', 'stripping', 'sheridan'],
  attachments:    ['attachment', 'force', 'retention', 'manufacturing', 'mfg'],
  simulation:     ['simulation', 'simulate', 'animate', 'animation', 'stage', 'frame', 'overjet', 'overbite', 'arch'],
  segmentation:   ['segmentation', 'segment', 'mask', 'tooth', 'gingival', 'margin'],
  aligner:        ['aligner', 'staging', 'strategy', 'schedule', 'elastic', 'ipr schedule'],
  pdl:            ['pdl', 'stress', 'mobility', 'bone', 'remodeling', 'periodontal'],
};

function classifyIntent(text: string): string {
  const lower = text.toLowerCase();
  if (/\?$/.test(lower.trim()) || /^(what|how|why|when|where|which|can|could|should|does|is|are)\b/.test(lower)) return 'question';
  if (/\b(fix|correct|repair|change|adjust|update|set|apply|move|reduce|increase)\b/.test(lower)) return 'command';
  if (/\b(looks? good|ok|okay|thank|great|perfect|yes|no|got it|understood)\b/.test(lower)) return 'acknowledgement';
  return 'feedback';
}

function detectModule(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [mod, keywords] of Object.entries(MODULE_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) return mod;
  }
  return null;
}

// ─── Proactive suggestion scanner ────────────────────────────────────────────

interface RawSuggestion {
  suggestionType: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  module: string;
  data: Record<string, unknown>;
}

// Kravitz limits (identical to tooth-movement service for consistency)
const LIMITS: Record<string, number> = {
  translation_mesial_mm: 0.30, translation_distal_mm: 0.30,
  translation_buccal_mm: 0.30, translation_lingual_mm: 0.30,
  rotation_deg: 3.0, torque_deg: 3.5, tip_mesial_deg: 4.0, tip_distal_deg: 4.0,
  intrusion_mm: 0.40, extrusion_mm: 0.75, expansion_mm: 0.30, mesialization_mm: 0.30,
};

const UPPER_FDI = new Set([11,12,13,14,15,16,17,18,21,22,23,24,25,26,27,28]);
const LOWER_FDI = new Set([31,32,33,34,35,36,37,38,41,42,43,44,45,46,47,48]);

async function scanPrescriptions(db: Pool, planId: string): Promise<RawSuggestion[]> {
  const suggestions: RawSuggestion[] = [];
  const res = await db.query(
    `SELECT * FROM movement_prescriptions WHERE plan_id=$1`,
    [planId],
  );
  if (res.rowCount === 0) return suggestions;

  const violations: Array<{ fdi: number; axis: string; value: number; limit: number }> = [];
  for (const p of res.rows) {
    for (const [axis, limit] of Object.entries(LIMITS)) {
      const val = p[axis] as number ?? 0;
      if (Math.abs(val) > limit) {
        violations.push({ fdi: p['tooth_number'] as number, axis, value: val, limit });
      }
    }
  }
  if (violations.length > 0) {
    suggestions.push({
      suggestionType: 'kravitz_violation',
      title: `${violations.length} Kravitz Limit Violation${violations.length > 1 ? 's' : ''} Detected`,
      body: violations.map(v =>
        `FDI ${v.fdi}: ${v.axis} = ${v.value.toFixed(3)}mm (limit ${v.limit}mm)`
      ).join('; '),
      severity: violations.length > 3 ? 'critical' : 'warning',
      module: 'prescriptions',
      data: { violations },
    });
  }

  // Bolton-like arch imbalance check (tooth count proxy)
  const upperCount = res.rows.filter(r => UPPER_FDI.has(r['tooth_number'] as number)).length;
  const lowerCount = res.rows.filter(r => LOWER_FDI.has(r['tooth_number'] as number)).length;
  if (Math.abs(upperCount - lowerCount) > 3) {
    suggestions.push({
      suggestionType: 'arch_imbalance',
      title: 'Arch Prescription Imbalance',
      body: `Upper arch has ${upperCount} prescriptions, lower has ${lowerCount}. Large discrepancy may indicate missing prescriptions or an untreated arch.`,
      severity: 'warning',
      module: 'prescriptions',
      data: { upperCount, lowerCount },
    });
  }

  return suggestions;
}

async function scanIpr(db: Pool, planId: string): Promise<RawSuggestion[]> {
  const suggestions: RawSuggestion[] = [];
  const res = await db.query(
    `SELECT * FROM ipr_enamel_estimates WHERE plan_id=$1 AND is_safe=false`,
    [planId],
  );
  if (res.rowCount && res.rowCount > 0) {
    suggestions.push({
      suggestionType: 'ipr_warning',
      title: `${res.rowCount} IPR Contact${res.rowCount > 1 ? 's' : ''} Below Enamel Safety Threshold`,
      body: res.rows.map(r =>
        `FDI ${r['fdi_a']}–${r['fdi_b']}: ${(r['remaining_enamel_mm'] as number).toFixed(2)}mm remaining (min 0.5mm Sheridan)`
      ).join('; '),
      severity: 'critical',
      module: 'ipr',
      data: { unsafeContacts: res.rows.map(r => ({ fdiA: r['fdi_a'], fdiB: r['fdi_b'], remaining: r['remaining_enamel_mm'] })) },
    });
  }
  return suggestions;
}

async function scanSimulation(db: Pool, planId: string): Promise<RawSuggestion[]> {
  const suggestions: RawSuggestion[] = [];
  const res = await db.query(
    `SELECT arch_coordination_score, occlusion_score, overjet_final_mm, overbite_final_mm
     FROM treatment_simulations WHERE plan_id=$1`,
    [planId],
  );
  if (res.rowCount === 0) return suggestions;
  const r = res.rows[0];

  const archScore = r['arch_coordination_score'] as number | null;
  if (archScore != null && archScore < 0.6) {
    suggestions.push({
      suggestionType: 'arch_imbalance',
      title: 'Low Arch Coordination Score',
      body: `Arch coordination score is ${(archScore * 100).toFixed(0)}% — significant upper/lower expansion discrepancy. Consider coordinated expansion staging.`,
      severity: 'warning',
      module: 'simulation',
      data: { archCoordinationScore: archScore },
    });
  }

  const occScore = r['occlusion_score'] as number | null;
  if (occScore != null && occScore < 0.5) {
    suggestions.push({
      suggestionType: 'occlusion_concern',
      title: 'Poor Predicted Occlusion Score',
      body: `Simulated occlusion score is ${(occScore * 100).toFixed(0)}%. Final overjet ${(r['overjet_final_mm'] as number)?.toFixed(1)}mm, overbite ${(r['overbite_final_mm'] as number)?.toFixed(1)}mm — review incisor prescriptions.`,
      severity: 'warning',
      module: 'simulation',
      data: { occlusionScore: occScore, overjet: r['overjet_final_mm'], overbite: r['overbite_final_mm'] },
    });
  }

  return suggestions;
}

async function scanAttachments(db: Pool, planId: string): Promise<RawSuggestion[]> {
  const suggestions: RawSuggestion[] = [];
  const res = await db.query(
    `SELECT COUNT(*) as cnt FROM attachment_collisions WHERE plan_id=$1 AND severity='critical'`,
    [planId],
  );
  const critCount = parseInt(res.rows[0]['cnt'] as string, 10);
  if (critCount > 0) {
    suggestions.push({
      suggestionType: 'collision',
      title: `${critCount} Critical Attachment Collision${critCount > 1 ? 's' : ''}`,
      body: `${critCount} critical attachment-to-attachment collision${critCount > 1 ? 's' : ''} detected. Review attachment spacing before manufacturing.`,
      severity: 'critical',
      module: 'attachments',
      data: { criticalCollisions: critCount },
    });
  }
  return suggestions;
}

async function scanPdl(db: Pool, planId: string): Promise<RawSuggestion[]> {
  const suggestions: RawSuggestion[] = [];
  const res = await db.query(
    `SELECT tooth_number, mobility_risk FROM pdl_simulation_results
     WHERE plan_id=$1 AND mobility_risk IN ('high','moderate')
     ORDER BY CASE mobility_risk WHEN 'high' THEN 0 ELSE 1 END`,
    [planId],
  );
  if (res.rowCount && res.rowCount > 0) {
    const high = res.rows.filter(r => r['mobility_risk'] === 'high').length;
    suggestions.push({
      suggestionType: 'pdl_stress',
      title: `${res.rowCount} Tooth${res.rowCount > 1 ? 's' : ''} with Elevated PDL Stress`,
      body: `${high} high-risk, ${res.rowCount - high} moderate-risk teeth based on Yoshida stress thresholds. Reduce per-stage movements for: ${res.rows.slice(0, 5).map(r => `FDI ${r['tooth_number']}`).join(', ')}.`,
      severity: high > 0 ? 'critical' : 'warning',
      module: 'pdl',
      data: { highRisk: high, moderateRisk: res.rowCount - high, teeth: res.rows.map(r => ({ fdi: r['tooth_number'], risk: r['mobility_risk'] })) },
    });
  }
  return suggestions;
}

// ─── Response generator ───────────────────────────────────────────────────────

function buildResponse(
  content: string,
  intent: string,
  module: string | null,
  suggestions: RawSuggestion[],
  caseContext: Record<string, unknown>,
): string {
  const lines: string[] = [];

  if (intent === 'acknowledgement') {
    lines.push('Understood. Let me know if you need anything else for this case.');
    if (suggestions.length > 0) {
      lines.push(`\nI also have ${suggestions.length} open suggestion${suggestions.length > 1 ? 's' : ''} for your review.`);
    }
    return lines.join('');
  }

  const lower = content.toLowerCase();

  // Context-aware answers based on keywords
  if (/overjet|overbite/.test(lower) && module === 'simulation') {
    const oj = caseContext['overjetFinal'] as number | null;
    const ob = caseContext['overbiteFirst'] as number | null;
    if (oj != null) {
      lines.push(`Based on the current simulation, predicted final overjet is ${oj.toFixed(1)}mm (target: 2–4mm) and overbite is ${ob != null ? ob.toFixed(1) + 'mm' : 'unavailable'} (target: 1.5–3mm).`);
    } else {
      lines.push('Run the treatment simulation first to get overjet and overbite predictions.');
    }
  } else if (/kravitz|limit|exceed/.test(lower)) {
    const viol = suggestions.filter(s => s.suggestionType === 'kravitz_violation');
    if (viol.length > 0) {
      lines.push(`Yes — ${viol[0].body} Review per-stage movement limits and reduce or split the prescription.`);
    } else {
      lines.push('No Kravitz violations detected in the current prescriptions.');
    }
  } else if (/ipr|enamel/.test(lower)) {
    const warn = suggestions.filter(s => s.suggestionType === 'ipr_warning');
    if (warn.length > 0) {
      lines.push(`There are IPR safety concerns: ${warn[0].body} Consider reducing IPR per session or obtaining radiographic confirmation.`);
    } else {
      lines.push('All IPR contacts are within Sheridan enamel safety limits (≥0.5mm remaining).');
    }
  } else if (/attach/.test(lower)) {
    const col = suggestions.filter(s => s.suggestionType === 'collision');
    if (col.length > 0) {
      lines.push(`Attachment collisions detected: ${col[0].body}`);
    } else {
      lines.push('No attachment collisions detected. Run the manufacturing validation in the Attachment Intelligence panel to confirm tolerances.');
    }
  } else if (/pdl|stress|mobility/.test(lower)) {
    const pdl = suggestions.filter(s => s.suggestionType === 'pdl_stress');
    if (pdl.length > 0) {
      lines.push(`PDL stress analysis flagged: ${pdl[0].body}`);
    } else {
      lines.push('PDL stress is within optimal range for all teeth in this plan. Run PDL simulation for detailed per-stage data.');
    }
  } else if (/stage|aligner|how many/.test(lower)) {
    const stages = caseContext['totalStages'] as number | null;
    if (stages != null) {
      lines.push(`The aligner plan has ${stages} active stages. Adjust movement prescriptions or staging strategy in the Aligner Generation panel to change the count.`);
    } else {
      lines.push('Generate the aligner plan first to see the stage count.');
    }
  } else {
    // Generic contextual response
    lines.push(
      module
        ? `Analyzing the ${module} module for this plan.`
        : 'I have context on all modules for this treatment plan.',
    );
    if (suggestions.length > 0) {
      lines.push(` I have flagged ${suggestions.length} item${suggestions.length > 1 ? 's' : ''} that may need attention — review the suggestions below.`);
    } else {
      lines.push(' No critical issues detected based on available data.');
    }
  }

  if (intent === 'question' && lines.length > 0) {
    lines.push('\n\n⚠ AI suggestion only. Clinician review required before clinical decision.');
  }

  return lines.join('');
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CopilotService {
  private readonly log = new Logger(CopilotService.name);

  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async startConversation(
    caseId: string,
    orgId: string,
    userId: string,
    planId?: string,
  ): Promise<CopilotConversation> {
    await this.verifyCase(caseId, orgId);

    // Build context snapshot from available data
    const contextSnapshot = await this.buildContextSnapshot(caseId, orgId, planId);

    const res = await this.db.query(
      `INSERT INTO copilot_conversations
         (organization_id, case_id, plan_id, created_by, title, context_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [orgId, caseId, planId ?? null, userId, 'Treatment Plan Review', JSON.stringify(contextSnapshot)],
    );
    return this.rowToConv(res.rows[0]);
  }

  async listConversations(caseId: string, orgId: string): Promise<CopilotConversation[]> {
    await this.verifyCase(caseId, orgId);
    const res = await this.db.query(
      `SELECT * FROM copilot_conversations WHERE case_id=$1 AND organization_id=$2 ORDER BY updated_at DESC`,
      [caseId, orgId],
    );
    return res.rows.map(r => this.rowToConv(r));
  }

  async sendMessage(
    conversationId: string,
    orgId: string,
    dto: SendMessageDto,
  ): Promise<CopilotMessage> {
    const startMs = Date.now();

    // Load conversation
    const convRes = await this.db.query(
      `SELECT * FROM copilot_conversations WHERE id=$1 AND organization_id=$2`,
      [conversationId, orgId],
    );
    if (convRes.rowCount === 0) throw new NotFoundException('Conversation not found');
    const conv = convRes.rows[0];

    // Save user message
    const intent = classifyIntent(dto.content);
    const module = detectModule(dto.content);

    await this.db.query(
      `INSERT INTO copilot_messages
         (conversation_id, organization_id, role, content, intent, referenced_module)
       VALUES ($1,$2,'user',$3,$4,$5)`,
      [conversationId, orgId, dto.content, intent, module],
    );

    // Scan for proactive suggestions
    const planId = conv['plan_id'] as string | null;
    const rawSuggestions: RawSuggestion[] = [];

    if (planId) {
      const [prescSugg, iprSugg, simSugg, attSugg, pdlSugg] = await Promise.all([
        scanPrescriptions(this.db, planId),
        scanIpr(this.db, planId),
        scanSimulation(this.db, planId),
        scanAttachments(this.db, planId),
        scanPdl(this.db, planId),
      ]);
      rawSuggestions.push(...prescSugg, ...iprSugg, ...simSugg, ...attSugg, ...pdlSugg);
    }

    // Persist new open suggestions (skip duplicates)
    const persistedSuggestions: CopilotSuggestion[] = [];
    for (const s of rawSuggestions) {
      const existing = await this.db.query(
        `SELECT id FROM copilot_suggestions
         WHERE plan_id=$1 AND suggestion_type=$2 AND status='open'`,
        [planId, s.suggestionType],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        // Update body to reflect latest scan
        await this.db.query(
          `UPDATE copilot_suggestions SET body=$1, data=$2 WHERE id=$3`,
          [s.body, JSON.stringify(s.data), existing.rows[0]['id']],
        );
        persistedSuggestions.push(await this.getSuggestionRow(existing.rows[0]['id'] as string));
      } else {
        const ins = await this.db.query(
          `INSERT INTO copilot_suggestions
             (organization_id, case_id, plan_id, conversation_id, suggestion_type,
              title, body, severity, module, data)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
          [
            orgId, conv['case_id'], planId, conversationId,
            s.suggestionType, s.title, s.body, s.severity, s.module,
            JSON.stringify(s.data),
          ],
        );
        persistedSuggestions.push(this.rowToSuggestion(ins.rows[0]));
      }
    }

    // Build contextual response
    const contextSnapshot = conv['context_snapshot'] as Record<string, unknown>;
    const responseContent = buildResponse(dto.content, intent, module, rawSuggestions, contextSnapshot);

    const latencyMs = Date.now() - startMs;

    // Save assistant message
    const msgRes = await this.db.query(
      `INSERT INTO copilot_messages
         (conversation_id, organization_id, role, content, intent, referenced_module,
          suggestions, latency_ms)
       VALUES ($1,$2,'assistant',$3,$4,$5,$6,$7) RETURNING *`,
      [
        conversationId, orgId, responseContent, intent, module,
        JSON.stringify(persistedSuggestions),
        latencyMs,
      ],
    );

    // Update conversation message count
    await this.db.query(
      `UPDATE copilot_conversations SET message_count=message_count+2, updated_at=now() WHERE id=$1`,
      [conversationId],
    );

    this.log.log(`Copilot message: conv ${conversationId} — ${latencyMs}ms, ${persistedSuggestions.length} suggestions`);

    return this.rowToMessage(msgRes.rows[0], persistedSuggestions);
  }

  async getMessages(conversationId: string, orgId: string): Promise<CopilotMessage[]> {
    const res = await this.db.query(
      `SELECT * FROM copilot_messages WHERE conversation_id=$1 AND organization_id=$2 ORDER BY created_at ASC`,
      [conversationId, orgId],
    );
    return res.rows.map(r => this.rowToMessage(r, (r['suggestions'] as CopilotSuggestion[]) ?? []));
  }

  async listSuggestions(caseId: string, orgId: string, planId?: string): Promise<CopilotSuggestion[]> {
    const res = await this.db.query(
      planId
        ? `SELECT * FROM copilot_suggestions WHERE case_id=$1 AND organization_id=$2 AND plan_id=$3 ORDER BY severity DESC, created_at DESC`
        : `SELECT * FROM copilot_suggestions WHERE case_id=$1 AND organization_id=$2 ORDER BY severity DESC, created_at DESC`,
      planId ? [caseId, orgId, planId] : [caseId, orgId],
    );
    return res.rows.map(r => this.rowToSuggestion(r));
  }

  async resolveSuggestion(
    suggestionId: string,
    orgId: string,
    userId: string,
    status: 'acknowledged' | 'dismissed' | 'applied',
    clinicianNote?: string,
  ): Promise<CopilotSuggestion> {
    const res = await this.db.query(
      `UPDATE copilot_suggestions
       SET status=$1, clinician_note=$2, resolved_by=$3, resolved_at=now()
       WHERE id=$4 AND organization_id=$5 RETURNING *`,
      [status, clinicianNote ?? null, userId, suggestionId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Suggestion not found');
    return this.rowToSuggestion(res.rows[0]);
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private async buildContextSnapshot(
    caseId: string,
    orgId: string,
    planId?: string,
  ): Promise<Record<string, unknown>> {
    const snap: Record<string, unknown> = { caseId, planId: planId ?? null };

    if (planId) {
      const simRes = await this.db.query(
        `SELECT total_frames, overjet_final_mm, overbite_final_mm, arch_coordination_score, occlusion_score
         FROM treatment_simulations WHERE plan_id=$1`,
        [planId],
      );
      if (simRes.rowCount && simRes.rowCount > 0) {
        const r = simRes.rows[0];
        snap['totalStages'] = r['total_frames'];
        snap['overjetFinal'] = r['overjet_final_mm'];
        snap['overbiteFirst'] = r['overbite_final_mm'];
        snap['archCoordination'] = r['arch_coordination_score'];
        snap['occlusion'] = r['occlusion_score'];
      }

      const prescCount = await this.db.query(
        `SELECT COUNT(*) as cnt FROM movement_prescriptions WHERE plan_id=$1`, [planId],
      );
      snap['prescriptionCount'] = parseInt(prescCount.rows[0]['cnt'] as string, 10);
    }

    const caseRes = await this.db.query(
      `SELECT p.first_name, p.last_name FROM cases c JOIN patients p ON p.id=c.patient_id
       WHERE c.id=$1 AND c.organization_id=$2`,
      [caseId, orgId],
    );
    if (caseRes.rowCount && caseRes.rowCount > 0) {
      const p = caseRes.rows[0];
      snap['patientName'] = `${p['first_name']} ${p['last_name']}`;
    }

    return snap;
  }

  private async getSuggestionRow(id: string): Promise<CopilotSuggestion> {
    const res = await this.db.query(`SELECT * FROM copilot_suggestions WHERE id=$1`, [id]);
    return this.rowToSuggestion(res.rows[0]);
  }

  private rowToConv(r: Record<string, unknown>): CopilotConversation {
    return {
      id:              r['id'] as string,
      caseId:          r['case_id'] as string,
      planId:          r['plan_id'] as string | null,
      title:           r['title'] as string | null,
      messageCount:    r['message_count'] as number,
      contextSnapshot: r['context_snapshot'] as Record<string, unknown>,
      createdAt:       r['created_at'] as string,
      updatedAt:       r['updated_at'] as string,
    };
  }

  private rowToMessage(r: Record<string, unknown>, suggestions: CopilotSuggestion[]): CopilotMessage {
    return {
      id:               r['id'] as string,
      conversationId:   r['conversation_id'] as string,
      role:             r['role'] as 'user' | 'assistant',
      content:          r['content'] as string,
      intent:           r['intent'] as string | null,
      referencedModule: r['referenced_module'] as string | null,
      suggestions,
      latencyMs:        r['latency_ms'] as number | null,
      createdAt:        r['created_at'] as string,
    };
  }

  private rowToSuggestion(r: Record<string, unknown>): CopilotSuggestion {
    return {
      id:             r['id'] as string,
      suggestionType: r['suggestion_type'] as string,
      title:          r['title'] as string,
      body:           r['body'] as string,
      severity:       r['severity'] as 'info' | 'warning' | 'critical',
      module:         r['module'] as string,
      data:           r['data'] as Record<string, unknown>,
      status:         r['status'] as CopilotSuggestion['status'],
      clinicianNote:  r['clinician_note'] as string | null,
      createdAt:      r['created_at'] as string,
    };
  }

  private async verifyCase(caseId: string, orgId: string): Promise<void> {
    const res = await this.db.query(
      `SELECT id FROM cases WHERE id=$1 AND organization_id=$2`,
      [caseId, orgId],
    );
    if (res.rowCount === 0) throw new NotFoundException('Case not found');
  }
}
