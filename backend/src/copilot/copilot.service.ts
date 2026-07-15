import { Injectable, Inject, Optional, NotFoundException, Logger } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { LlmService } from './rag/llm.service';
import { AgentRouterService } from './rag/agent-router.service';
import { ContextBuilderService } from './rag/context-builder.service';
import { AiAuditService } from '../mlops/ai-audit.service';

export interface StreamEvent {
  type: 'meta' | 'delta' | 'done' | 'error';
  agentType?: string;
  suggestionCount?: number;
  content?: string;
  error?: string;
  messageId?: string;
  sources?: Array<{ title: string; source: string }>;
  confidence?: ConfidenceLevel;
  explainability?: ExplainabilityData;
  /** True when the rule-engine fallback was used instead of the LLM (no API key or LLM error). */
  fallbackUsed?: boolean;
}

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
  confidenceLevel: ConfidenceLevel;
  explainability: ExplainabilityData | null;
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

export type ConfidenceLevel = 'very_high' | 'high' | 'medium' | 'low' | 'unknown';

export interface ExplainabilityData {
  why: string;
  evidence: string[];
  limitations: string[];
  reviewSteps: string[];
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

// ─── Confidence & explainability ─────────────────────────────────────────────

const CLINICAL_DISCLAIMER = 'AI clinical suggestion — clinician review and judgement required before any clinical decision.';

function computeConfidence(
  intent: string,
  module: string | null,
  suggestions: RawSuggestion[],
  caseContext: Record<string, unknown>,
): ConfidenceLevel {
  const hasStages = caseContext['totalStages'] != null;
  const hasOverjet = caseContext['overjetFinal'] != null;
  const prescriptionCount = caseContext['prescriptionCount'];
  const hasPrescriptions = typeof prescriptionCount === 'number' && prescriptionCount > 0;

  if (hasStages && hasOverjet && suggestions.length > 0) return 'very_high';
  if (hasStages || hasOverjet || hasPrescriptions) return 'high';
  if (caseContext['caseId'] != null && module !== null) return 'medium';
  if (intent === 'question' && module !== null) return 'low';
  return 'unknown';
}

function buildExplainability(
  content: string,
  intent: string,
  module: string | null,
  suggestions: RawSuggestion[],
): ExplainabilityData {
  void intent; // intent is available for future branch differentiation
  const lower = content.toLowerCase();

  if (module === 'ipr' || /ipr|enamel|interproximal|sheridan/.test(lower)) {
    const unsafeContacts = suggestions
      .filter(s => s.suggestionType === 'ipr_warning')
      .map(s => s.body);
    return {
      why: 'IPR safety is assessed against Sheridan (1985) minimum enamel residual thresholds',
      evidence: [
        'Sheridan minimum residual enamel: 0.5mm',
        'Ballard maximum per-contact IPR: 0.5mm anterior / 0.8mm posterior',
        ...unsafeContacts,
      ],
      limitations: [
        'Residual enamel estimates are computed from total IPR prescribed; actual enamel may differ',
        'Radiographic assessment required for IPR > 0.3mm per contact',
      ],
      reviewSteps: [
        'Review flagged contacts in the IPR panel',
        'Obtain periapical radiographs for contacts > 0.3mm IPR',
        'Confirm total cumulative IPR does not exceed safe limits',
        CLINICAL_DISCLAIMER,
      ],
    };
  }

  if (module === 'prescriptions' || /kravitz|limit|translation|rotation|torque/.test(lower)) {
    const violations = suggestions
      .filter(s => s.suggestionType === 'kravitz_violation')
      .map(s => s.body);
    return {
      why: 'Prescription limits are assessed against Kravitz et al. (AJO-DO 2008) per-stage movement thresholds',
      evidence: [
        'Kravitz 2008: translation ≤ 0.30mm/stage, rotation ≤ 3.0°/stage, torque ≤ 3.5°/stage, intrusion ≤ 0.40mm/stage',
        ...violations,
      ],
      limitations: [
        'Per-stage limits are based on population averages; individual variation exists',
        'Biological response depends on patient age, bone density, and PDL health',
      ],
      reviewSteps: [
        'Review all Kravitz limit violations in the Prescriptions panel',
        'Increase stage count or reduce prescription magnitude for flagged teeth',
        'Confirm attachments are prescribed for high-movement teeth',
        CLINICAL_DISCLAIMER,
      ],
    };
  }

  if (module === 'simulation' || /simulation|overjet|overbite|arch|occlusion/.test(lower)) {
    const simItems = suggestions
      .filter(s => s.module === 'simulation')
      .map(s => s.body);
    return {
      why: 'Simulation scores are derived from finite-element arch coordination and occlusion models',
      evidence: [
        'Arch coordination score threshold: ≥ 0.6 acceptable',
        'Occlusion score threshold: ≥ 0.5 acceptable',
        ...simItems,
      ],
      limitations: [
        'Simulation accuracy depends on segmentation quality and initial scan resolution',
        'Predicted occlusion is an estimate; final result depends on patient compliance and biology',
      ],
      reviewSteps: [
        'Review arch coordination and occlusion scores in the Treatment Simulation tab',
        'Confirm overjet and overbite fall within ABO target ranges (overjet 2–4mm, overbite 1.5–3mm)',
        'Re-run simulation after prescription adjustments',
        CLINICAL_DISCLAIMER,
      ],
    };
  }

  if (module === 'attachments' || /attachment|collision|retention|manufacturing|mfg/.test(lower)) {
    const collisions = suggestions
      .filter(s => s.suggestionType === 'collision')
      .map(s => s.body);
    return {
      why: 'Attachment placement is validated against geometric collision detection and manufacturing tolerances',
      evidence: [
        'Minimum attachment-to-gingival margin clearance: 1.0mm',
        'Minimum attachment-to-attachment clearance: 0.5mm',
        ...collisions,
      ],
      limitations: [
        'Collision detection is based on digital models; printed aligner tolerances may introduce additional clearance variation',
        'Attachment bonding accuracy depends on clinician technique',
      ],
      reviewSteps: [
        'Review flagged collisions in the Attachments panel',
        'Reposition or remove conflicting attachments',
        'Confirm attachment types match tooth movement requirements',
        CLINICAL_DISCLAIMER,
      ],
    };
  }

  if (module === 'pdl' || /pdl|periodontal|stress|mobility|bone|remodel/.test(lower)) {
    const pdlItems = suggestions
      .filter(s => s.suggestionType === 'pdl_stress')
      .map(s => s.body);
    return {
      why: 'PDL stress is assessed against Yoshida (2001) optimal bone remodelling thresholds',
      evidence: [
        'Yoshida 2001 optimal PDL stress range: 0.47–11.8 kPa',
        'Stress > 15 kPa risks PDL hyalinisation and movement arrest',
        ...pdlItems,
      ],
      limitations: [
        'PDL stress estimates are based on finite-element models using population-average bone properties',
        'Patient-specific bone density (from CBCT) is required for precise stress prediction',
      ],
      reviewSteps: [
        'Review elevated-stress teeth in the Biomechanics tab',
        'Reduce per-stage movements by 20–30% for high-risk teeth',
        'Consider passive stages every 4–6 aligners for affected teeth',
        CLINICAL_DISCLAIMER,
      ],
    };
  }

  if (module === 'aligner' || /aligner|staging|strategy|schedule|stage count/.test(lower)) {
    const alignerItems = suggestions
      .filter(s => s.module === 'aligner')
      .map(s => s.body);
    return {
      why: 'Aligner staging is evaluated against treatment complexity and per-stage movement safety',
      evidence: [
        'Stage count derived from prescribed movements at standard per-stage limits',
        'Standard wear protocol: 2 weeks per aligner',
        ...alignerItems,
      ],
      limitations: [
        'Stage count is a minimum estimate; refinements may add additional stages',
        'Patient compliance directly affects treatment duration',
      ],
      reviewSteps: [
        'Confirm total stage count in the Aligner Plan tab',
        'Review per-stage movement distribution for uniformity',
        'Plan refinement assessment at the midpoint stage',
        CLINICAL_DISCLAIMER,
      ],
    };
  }

  // Generic fallback
  return {
    why: 'Based on clinical guidelines and available case data',
    evidence: [],
    limitations: ['Limited case-specific data available'],
    reviewSteps: [
      'Review all treatment parameters before proceeding',
      CLINICAL_DISCLAIMER,
    ],
  };
}

// ─── Response generator ───────────────────────────────────────────────────────

function buildResponse(
  content: string,
  intent: string,
  module: string | null,
  suggestions: RawSuggestion[],
  caseContext: Record<string, unknown>,
): string {
  const lower = content.toLowerCase();
  const lines: string[] = [];

  if (intent === 'acknowledgement') {
    const acks = [
      'Understood — let me know if you need a second look at anything.',
      'Got it. I\'m here if you want to review any part of the treatment plan.',
      'Noted. Happy to assist with prescriptions, staging, or clinical questions.',
    ];
    lines.push(acks[content.length % acks.length]);
    if (suggestions.length > 0) {
      lines.push(`\n\nI also have ${suggestions.length} open suggestion${suggestions.length > 1 ? 's' : ''} that may warrant review.`);
    }
    return lines.join('');
  }

  // ── Overjet / overbite ────────────────────────────────────────────────────
  if (/overjet|overbite/.test(lower)) {
    const oj = caseContext['overjetFinal'] as number | null;
    const ob = caseContext['overbiteFirst'] as number | null;
    if (oj != null) {
      const ojStatus = oj >= 1 && oj <= 4 ? '✓ within normal range' : oj < 1 ? '⚠ reduced — risk of anterior interference' : '⚠ increased — review incisor retraction mechanics';
      const obStatus = ob != null ? (ob >= 1 && ob <= 3 ? '✓ within normal range' : ob < 1 ? '⚠ reduced — possible open-bite tendency' : '⚠ deep bite — consider intrusion mechanics') : 'not yet simulated';
      lines.push(`**Predicted Occlusal Values (final stage)**\n\n- Overjet: **${oj.toFixed(1)} mm** — ${ojStatus} (normal 2–4 mm, ABO standard)\n- Overbite: **${ob != null ? ob.toFixed(1) + ' mm' : 'N/A'}** — ${obStatus} (normal 1.5–3 mm)\n\nIf either value falls outside target, review incisor torque and anteroposterior translation prescriptions before finalising the plan.`);
    } else {
      lines.push('Run the treatment simulation (Treatment Simulation tab → Generate) to obtain predicted overjet and overbite values for this plan.');
    }
  }

  // ── Smile arc ─────────────────────────────────────────────────────────────
  else if (/smile arc|smile curve|consonant/.test(lower)) {
    const sas = caseContext['smileArcScore'] as number | null;
    if (sas != null) {
      const grade = sas >= 0.85 ? 'consonant — aesthetically favourable' : sas >= 0.70 ? 'flat — consider minor incisor intrusion to improve arc' : 'reverse — maxillary incisor extrusion likely required';
      lines.push(`**Smile Arc Analysis**\n\nScore: **${(sas * 100).toFixed(0)}%** — ${grade}\n\nA consonant smile arc (maxillary incisal edges following the lower lip curvature) is considered the aesthetic ideal (Sarver & Ackerman, AJO-DO 2003). For flat or reverse arcs, consider differential incisor intrusion (12, 22) of 0.3–0.5 mm to restore convexity.`);
    } else {
      lines.push('Generate the treatment simulation to obtain the smile arc score for this plan.');
    }
  }

  // ── Kravitz limits ───────────────────────────────────────────────────────
  else if (/kravitz|limit|exceed|per.stage|safe.movement/.test(lower)) {
    const viol = suggestions.filter(s => s.suggestionType === 'kravitz_violation');
    if (viol.length > 0) {
      lines.push(`**Kravitz Per-Stage Movement Violations**\n\n${viol[0].body}\n\nKravitz et al. (AJO-DO 2008) established that clear aligner systems reliably achieve:\n- Translation ≤ 0.30 mm/stage\n- Rotation ≤ 3.0°/stage\n- Torque ≤ 3.5°/stage\n- Intrusion ≤ 0.40 mm/stage\n\nTo resolve: either increase total stage count (to distribute movement across more steps) or reduce the prescription magnitude for the listed teeth.`);
    } else {
      lines.push('✓ All prescriptions are within Kravitz per-stage movement limits. No violations detected.');
    }
  }

  // ── IPR ──────────────────────────────────────────────────────────────────
  else if (/ipr|interproximal|enamel reduction|stripping|sheridan/.test(lower)) {
    const warn = suggestions.filter(s => s.suggestionType === 'ipr_warning');
    if (warn.length > 0) {
      lines.push(`**IPR Safety Warning**\n\n${warn[0].body}\n\n**Clinical guidance:**\n- Sheridan (1985) established a minimum residual enamel threshold of **0.5 mm**\n- Maximum safe IPR per contact: 0.5 mm anterior, 0.8 mm posterior (Ballard 1944)\n- Radiographic assessment is recommended before IPR > 0.3 mm/contact\n- IPR should be staged: no more than 0.2 mm at a single appointment\n\nReduce IPR at flagged contacts or obtain radiographic enamel assessment before proceeding.`);
    } else {
      lines.push('✓ All IPR contacts are within safe enamel limits (≥ 0.5 mm residual). No Sheridan violations detected.\n\nFor reference: the total IPR available per contact ranges from 0.5 mm (lower incisors) to 0.8 mm (premolars).');
    }
  }

  // ── Attachments ──────────────────────────────────────────────────────────
  else if (/attachment|dimple|button/.test(lower)) {
    const col = suggestions.filter(s => s.suggestionType === 'collision');
    const mfg = `\n\n**Manufacturing note:** Attachments must be ≥ 1.0 mm from the gingival margin and ≥ 0.5 mm from adjacent attachments to ensure print fidelity and clinical placement accuracy.`;
    if (col.length > 0) {
      lines.push(`**Attachment Collision Warning**\n\n${col[0].body}${mfg}`);
    } else {
      lines.push(`**Attachments — No Collisions Detected**\n\nAll attachment placements pass geometric validation. Common indications by type:\n- **Rectangular horizontal**: vertical intrusion/extrusion control, anterior torque\n- **Rectangular vertical**: rotation and translation of premolars and canines\n- **Beveled**: torque root control on upper incisors\n- **Optimised retention**: posterior teeth requiring rotation without angulation change${mfg}`);
    }
  }

  // ── PDL / biomechanics ───────────────────────────────────────────────────
  else if (/pdl|periodontal ligament|stress|mobility|bone remodel/.test(lower)) {
    const pdl = suggestions.filter(s => s.suggestionType === 'pdl_stress');
    if (pdl.length > 0) {
      lines.push(`**PDL Stress — Elevated Risk Detected**\n\n${pdl[0].body}\n\n**Clinical context:** Optimal stress in the PDL for bone remodelling is 0.47–11.8 kPa (Weinstein 1967). Stress above 15 kPa risks hyalinisation of the PDL, which pauses tooth movement for 2–4 weeks. For affected teeth:\n- Reduce per-stage translation by 20–30%\n- Consider passive stages every 4–6 aligners to allow remodelling\n- Eliminate simultaneous multi-directional forces on the same tooth`);
    } else {
      lines.push('✓ PDL stress is within the optimal remodelling range for all teeth in this plan.\n\n**Reference range:** 0.47–11.8 kPa optimal; > 15 kPa risks hyalinisation (Yoshida 2001). Run the PDL Simulation in the Biomechanics tab for per-stage stress maps.');
    }
  }

  // ── Staging / aligner count ──────────────────────────────────────────────
  else if (/stage|how many aligner|aligner count|treatment length|weeks|months/.test(lower)) {
    const stages = caseContext['totalStages'] as number | null;
    if (stages != null) {
      const weeks = stages * 2;
      const months = (weeks / 4.33).toFixed(1);
      lines.push(`**Treatment Timeline**\n\n- Active stages: **${stages}**\n- Estimated duration: **${weeks} weeks (≈ ${months} months)** at standard 2-week wear\n- At 1-week refinements: **${stages} weeks (≈ ${(stages / 4.33).toFixed(1)} months)**\n\nTo reduce stage count: increase per-stage movement (within Kravitz limits), accept wider movement tolerances, or reduce total tooth movement. To increase predictability: keep rotations ≤ 2°/stage and intrusions ≤ 0.3 mm/stage.`);
    } else {
      lines.push('Generate the aligner plan to see the projected stage count and treatment timeline.');
    }
  }

  // ── Torque ───────────────────────────────────────────────────────────────
  else if (/torque|root|axial inclination|labial.lingual/.test(lower)) {
    lines.push(`**Root Torque — Clinical Guidance**\n\nClear aligners have limited torque expression vs. fixed appliances. Key points:\n- Upper central incisors: labial root torque is the most difficult movement for aligners (predictability ≈ 42%, Haouili 2020)\n- Clinically prescribe 10–20% overcorrection for torque\n- Attachments (beveled rectangular) significantly improve torque predictability\n- Posterior root torque > 5°/stage risks cortical plate contact — use CBCT-guided staging when available\n\nFor root safety: review the Root Safety panel and ensure CBCT fusion is active if bone proximity is a concern.`);
  }

  // ── Expansion ────────────────────────────────────────────────────────────
  else if (/expansion|arch width|transverse|constriction|crossbite/.test(lower)) {
    const archCoord = caseContext['archCoordination'] as number | null;
    lines.push(`**Arch Expansion — Clinical Guidance**${archCoord != null ? `\n\nArch coordination score: **${(archCoord * 100).toFixed(0)}%**` : ''}\n\n- Clear aligner expansion is most effective in the premolar region (1–3 mm predictable)\n- Molar expansion > 2 mm has low predictability; consider RPE adjunct for growing patients\n- Upper and lower arch expansion must be coordinated (max 1 mm discrepancy per quadrant)\n- Buccal crown tipping without compensating body movement leads to scissor-bite tendency\n\nReview upper vs lower expansion totals in the Arch Coordination panel to confirm transverse balance.`);
  }

  // ── Rotation ─────────────────────────────────────────────────────────────
  else if (/rotation|derotation|rotate/.test(lower)) {
    lines.push(`**Rotation — Predictability Guidance**\n\nRotation is among the least predictable movements for clear aligners:\n- Canine/premolar rotations > 15° typically require attachments\n- Mesiobuccal cusp rotations of upper molars are rarely predictable without auxiliaries\n- Overcorrect rotations by 10–20% in the prescription\n- For >20° rotations, plan staged overcorrection with reassessment at midpoint\n\nReview the Attachment Intelligence panel to confirm rotation-optimised attachments are present on high-rotation teeth.`);
  }

  // ── Refinement ───────────────────────────────────────────────────────────
  else if (/refinement|rescan|mid.course|correction/.test(lower)) {
    lines.push(`**Refinement Planning**\n\nRefinements are typically indicated when:\n- Residual discrepancy > 1.5 mm in any movement axis at mid-treatment review\n- Off-track alerts triggered on ≥ 2 consecutive aligners\n- New clinical findings (periodontal, eruption) change the treatment target\n\n**Process:**\n1. Take new intraoral scans at the planned refinement stage\n2. Review tracking in the Segmentation panel\n3. Generate a refinement plan with updated prescriptions\n4. New aligner series with unique stage numbering\n\nStatistically, 30–40% of clear aligner cases require at least one refinement (Kravitz 2009).`);
  }

  // ── Anchorage ────────────────────────────────────────────────────────────
  else if (/anchor|anchorage|tads|mini.screw|molar.position/.test(lower)) {
    lines.push(`**Anchorage Analysis**\n\nClear aligners provide moderate anterior anchorage through:\n- Posterior composite attachments (rectangular horizontal)\n- Posterior tooth engagement across multiple units\n- Bite pads to disocclude posteriors and facilitate anterior intrusion\n\n**When to consider TADs:**\n- Maxillary incisor retraction > 4 mm requiring maximum anchorage\n- Molar intrusion > 1.5 mm\n- True skeletal anchorage requirements\n\nReview the prescription totals in the Anchorage Planning section. Total molar mesialisation should be < 0.5 mm if maximum anchorage is planned.`);
  }

  // ── Class II / Class III ──────────────────────────────────────────────────
  else if (/class ii|class 2|class iii|class 3|skeletal|sagittal|mandibular/.test(lower)) {
    lines.push(`**Skeletal Classification — Treatment Guidance**\n\n**Class II:**\n- Dental compensation: upper retraction + lower advancement (combined ≤ 6 mm)\n- Mandibular advancement requires Class II elastics (typically stage 5–final)\n- Consider mandibular symphysis bone density on CBCT before lower expansion\n\n**Class III:**\n- Camouflage: upper advancement + lower retraction (combined ≤ 4 mm)\n- Lower incisor retraction has highest root resorption risk — monitor with periapical radiographs\n- Orthognathic surgery referral if skeletal discrepancy > 5 mm ANB\n\nReview the Growth Prediction panel for skeletal age and mandibular growth remaining if patient is still growing.`);
  }

  // ── Root resorption ──────────────────────────────────────────────────────
  else if (/root resorption|apical|resorb/.test(lower)) {
    lines.push(`**Root Resorption Risk**\n\nClear aligners carry lower root resorption risk than fixed appliances, but elevated risk exists for:\n- Maxillary lateral incisors with pipette-shaped roots\n- Total incisor intrusion > 2 mm\n- Previous root resorption history\n- Treatment > 24 months without reassessment\n\n**Monitoring protocol:**\n- Periapical radiographs at 9 months if ≥ 2 risk factors present\n- CBCT if > 25% root length lost on any tooth\n- Reduce intrusion prescriptions to ≤ 0.25 mm/stage for high-risk teeth`);
  }

  // ── Manufacturing / print readiness ──────────────────────────────────────
  else if (/print|manufactur|resin|print time|3d print|export/.test(lower)) {
    lines.push(`**Manufacturing Readiness**\n\nFor aligner manufacturing, ensure:\n1. ✓ Aligner generation complete (stage STLs ready)\n2. ✓ Attachment template exported for bonding tray\n3. ✓ QA report reviewed and approved by clinician\n\n**Print parameters (DLP/MSLA standard):**\n- Layer height: 50–100 µm\n- Aligner resin: 0.5–0.75 mm nominal thickness\n- Support-free for flat arches; light supports on deep overbite stages\n- Estimated print time: 45–90 min per batch of upper + lower\n- Shrinkage compensation: +0.3–0.5% on most resins\n\nUse the Manufacturing Export panel to download the case package when all validations pass.`);
  }

  // ── Patient communication ─────────────────────────────────────────────────
  else if (/explain to patient|patient question|patient understand|how to tell|wear time/.test(lower)) {
    const stages = caseContext['totalStages'] as number | null;
    const months = stages ? `approximately ${(stages * 2 / 4.33).toFixed(0)} months` : 'several months';
    lines.push(`**Patient Communication — Draft Script**\n\n*"Your treatment plan consists of a series of custom-fit clear aligners that gradually move your teeth. You'll wear each set for about two weeks before progressing to the next. Treatment is expected to take ${months} in total, assuming good compliance.*\n\n*It's important to wear the aligners for at least 22 hours each day — removing them only to eat and brush. Some people experience mild soreness for the first day or two with each new aligner — this is normal and means the teeth are moving.*\n\n*We'll check in at scheduled appointments to confirm progress. If an aligner feels uncomfortable or doesn't fit after the second day, please contact us rather than advancing to the next stage."*\n\nFor complex cases, remind patients that refinements (additional aligners) are sometimes needed and are not considered treatment failure.`);
  }

  // ── Generic fallback ─────────────────────────────────────────────────────
  else {
    const prescriptionCount = caseContext['prescriptionCount'] as number | null;
    const stages = caseContext['totalStages'] as number | null;
    const patientName = caseContext['patientName'] as string | null;

    if (patientName || prescriptionCount != null || stages != null) {
      lines.push(`**Case Context**${patientName ? ` — ${patientName}` : ''}\n`);
      if (prescriptionCount != null) lines.push(`- Movement prescriptions: ${prescriptionCount} teeth`);
      if (stages != null) lines.push(`- Active stages: ${stages} (≈ ${(stages * 2 / 4.33).toFixed(1)} months at 2-week wear)`);
      if (suggestions.length > 0) {
        lines.push(`- Open suggestions: ${suggestions.length} item${suggestions.length > 1 ? 's' : ''} flagged for review`);
      }
      lines.push('\nFor clinical topics, try asking about: overjet/overbite, attachments, IPR, Kravitz limits, staging, torque, expansion, refinement, or patient communication.');
    } else {
      lines.push(
        module
          ? `I\'m reviewing the **${module}** module for this case. Ask about specific parameters — overjet, attachments, IPR, staging, torque, or clinical risks — and I\'ll provide evidence-based guidance.`
          : 'Ask me about any aspect of this treatment plan: overjet/overbite predictions, IPR safety, Kravitz limit compliance, attachment placement, PDL stress, staging strategy, refinement, anchorage, or patient communication.',
      );
    }
  }

  if (lines.length > 0) {
    lines.push('\n\n*⚠ AI clinical suggestion — clinician review and judgement required before any clinical decision.*');
  }

  return lines.join('\n');
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class CopilotService {
  private readonly log = new Logger(CopilotService.name);

  constructor(
    @Inject(PG_POOL) private readonly db: Pool,
    @Optional() private readonly llm: LlmService,
    @Optional() private readonly agentRouter: AgentRouterService,
    @Optional() private readonly contextBuilder: ContextBuilderService,
    @Optional() private readonly aiAudit: AiAuditService,
  ) {}

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
    userId?: string,
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

    const confidence = computeConfidence(intent, module, rawSuggestions, contextSnapshot);
    const explainability = buildExplainability(dto.content, intent, module, rawSuggestions);

    const latencyMs = Date.now() - startMs;

    // Save assistant message
    const msgRes = await this.db.query(
      `INSERT INTO copilot_messages
         (conversation_id, organization_id, role, content, intent, referenced_module,
          suggestions, latency_ms, confidence_level, explainability_data)
       VALUES ($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        conversationId, orgId, responseContent, intent, module,
        JSON.stringify(persistedSuggestions),
        latencyMs,
        confidence,
        JSON.stringify(explainability),
      ],
    );

    // Update conversation message count
    await this.db.query(
      `UPDATE copilot_conversations SET message_count=message_count+2, updated_at=now() WHERE id=$1`,
      [conversationId],
    );

    // Audit trail: fire-and-forget to avoid blocking the response
    if (this.aiAudit) {
      this.aiAudit.beginAudit({
        organizationId: orgId,
        invokedBy: userId ?? orgId,
        modelName: 'copilot-assistant',
        modelVersion: '1.0',
        inferenceType: 'copilot.chat',
        correlationId: conversationId,
        caseId: conv['case_id'] as string | undefined,
        disclaimerShown: true,
        inputMetadata: { intent, module, suggestionCount: persistedSuggestions.length },
      }).then(audit =>
        this.aiAudit!.finalizeAudit(audit.id, {
          outcome: 'accepted',
          latencyMs,
          confidenceScore: confidence === 'high' ? 0.9 : confidence === 'medium' ? 0.65 : 0.4,
          fallbackUsed: true,
          outputMetadata: { messageId: msgRes.rows[0]['id'] },
        }),
      ).catch(err => this.log.warn(`AI audit error (sendMessage): ${(err as Error).message}`));
    }

    this.log.log(`Copilot message: conv ${conversationId} — ${latencyMs}ms, ${persistedSuggestions.length} suggestions`);

    return this.rowToMessage(msgRes.rows[0], persistedSuggestions, confidence, explainability);
  }

  // ─── Streaming RAG endpoint ──────────────────────────────────────────────
  // Yields SSE-style events. Falls back to the rule engine if LLM is not configured.

  async *streamMessage(
    conversationId: string,
    orgId: string,
    dto: SendMessageDto,
    userId?: string,
  ): AsyncGenerator<StreamEvent> {
    const startMs = Date.now();

    // Load conversation and verify org ownership
    const convRes = await this.db.query(
      `SELECT * FROM copilot_conversations WHERE id=$1 AND organization_id=$2`,
      [conversationId, orgId],
    );
    if (convRes.rowCount === 0) {
      yield { type: 'error', error: 'Conversation not found' };
      return;
    }
    const conv = convRes.rows[0];
    const planId = conv['plan_id'] as string | null;

    // Save user message
    const intent = classifyIntent(dto.content);
    const module = detectModule(dto.content);

    await this.db.query(
      `INSERT INTO copilot_messages
         (conversation_id, organization_id, role, content, intent, referenced_module)
       VALUES ($1,$2,'user',$3,$4,$5)`,
      [conversationId, orgId, dto.content, intent, module],
    );

    // Run proactive suggestion scanners (same as sendMessage)
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

    // Route to specialist agent
    const agentConfig = this.agentRouter
      ? this.agentRouter.route(dto.content, module)
      : { agentType: 'planning' as const, systemPrompt: '' };

    yield {
      type: 'meta',
      agentType: agentConfig.agentType,
      suggestionCount: rawSuggestions.length,
    };

    let fullResponse = '';
    let fallbackUsed = false;

    if (this.llm?.isConfigured() && this.contextBuilder) {
      // ── RAG + LLM path ──────────────────────────────────────────────────
      const ctx = await this.contextBuilder.build(
        conversationId,
        orgId,
        dto.content,
        agentConfig.agentType,
      );

      // Emit knowledge sources
      if (ctx.sources.length > 0) {
        yield {
          type: 'meta',
          sources: ctx.sources.map(s => ({ title: s.title, source: s.source })),
        };
      }

      const systemPrompt = agentConfig.systemPrompt +
        (ctx.systemContext ? `\n\n${ctx.systemContext}` : '');

      try {
        for await (const chunk of this.llm.stream(ctx.history, systemPrompt)) {
          fullResponse += chunk;
          yield { type: 'delta', content: chunk };
        }
      } catch (err) {
        this.log.error('LLM stream error', (err as Error).message);
        // Fall back to rule engine on LLM failure
        fallbackUsed = true;
        fullResponse = buildResponse(
          dto.content, intent, module, rawSuggestions,
          conv['context_snapshot'] as Record<string, unknown>,
        );
        yield { type: 'delta', content: fullResponse };
      }
    } else {
      // ── Rule engine fallback ─────────────────────────────────────────────
      fallbackUsed = true;
      fullResponse = buildResponse(
        dto.content, intent, module, rawSuggestions,
        conv['context_snapshot'] as Record<string, unknown>,
      );
      yield { type: 'delta', content: fullResponse };
    }

    // Persist suggestions
    const persistedSuggestions: CopilotSuggestion[] = [];
    for (const s of rawSuggestions) {
      const existing = await this.db.query(
        `SELECT id FROM copilot_suggestions WHERE plan_id=$1 AND suggestion_type=$2 AND status='open'`,
        [planId, s.suggestionType],
      );
      if (existing.rowCount && existing.rowCount > 0) {
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

    // Save completed assistant message
    const latencyMs = Date.now() - startMs;
    const streamConfidence = computeConfidence(intent, module, rawSuggestions, conv['context_snapshot'] as Record<string, unknown>);
    const streamExplainability = buildExplainability(dto.content, intent, module, rawSuggestions);
    const msgRes = await this.db.query(
      `INSERT INTO copilot_messages
         (conversation_id, organization_id, role, content, intent, referenced_module,
          suggestions, latency_ms, confidence_level, explainability_data)
       VALUES ($1,$2,'assistant',$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        conversationId, orgId, fullResponse, intent, module,
        JSON.stringify(persistedSuggestions), latencyMs,
        streamConfidence,
        JSON.stringify(streamExplainability),
      ],
    );
    await this.db.query(
      `UPDATE copilot_conversations SET message_count=message_count+2, updated_at=now() WHERE id=$1`,
      [conversationId],
    );

    this.log.log(`Copilot stream: conv ${conversationId} — ${latencyMs}ms, agent=${agentConfig.agentType}, fallback=${fallbackUsed}`);

    // Audit trail: fire-and-forget
    if (this.aiAudit) {
      this.aiAudit.beginAudit({
        organizationId: orgId,
        invokedBy: userId ?? orgId,
        modelName: fallbackUsed ? 'copilot-rule-engine' : 'copilot-llm',
        modelVersion: '1.0',
        inferenceType: 'copilot.stream',
        correlationId: conversationId,
        caseId: (conv as Record<string, unknown>)['case_id'] as string | undefined,
        disclaimerShown: true,
        inputMetadata: { agentType: agentConfig.agentType, suggestionCount: persistedSuggestions.length },
      }).then(audit =>
        this.aiAudit!.finalizeAudit(audit.id, {
          outcome: 'accepted',
          latencyMs,
          confidenceScore: streamConfidence === 'high' ? 0.9 : streamConfidence === 'medium' ? 0.65 : 0.4,
          fallbackUsed,
          outputMetadata: { messageId: msgRes.rows[0]['id'] },
        }),
      ).catch(err => this.log.warn(`AI audit error (streamMessage): ${(err as Error).message}`));
    }

    yield { type: 'done', messageId: msgRes.rows[0]['id'] as string, fallbackUsed };
    yield {
      type: 'meta',
      confidence: streamConfidence,
      explainability: streamExplainability,
      fallbackUsed,
    };
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

  private rowToMessage(
    r: Record<string, unknown>,
    suggestions: CopilotSuggestion[],
    confidenceLevel?: ConfidenceLevel | null,
    explainabilityData?: ExplainabilityData | null,
  ): CopilotMessage {
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
      confidenceLevel:  (confidenceLevel ?? r['confidence_level'] as ConfidenceLevel) ?? 'unknown',
      explainability:   explainabilityData ?? (r['explainability_data'] as ExplainabilityData | null),
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
