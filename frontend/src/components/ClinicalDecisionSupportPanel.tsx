"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button, Card } from "@/components/DesignSystem";
import { ClinicalWarningBanner } from "@/components/ui/ClinicalWarningBanner";
import { getLatestAnalysis, type CaseAnalysis } from "@/lib/api/analysis";
import { getAiScores, type AiScores } from "@/lib/api/ai-scores";
import { listCephAnalyses, type CephAnalysis } from "@/lib/api/ceph";
import { listOcclusionAnalyses, type OcclusionAnalysis } from "@/lib/api/occlusion";

// ─── Types ────────────────────────────────────────────────────────────────────
type AlertLevel = "info" | "warning" | "caution" | "critical";

interface CdsModule {
  id: string;
  title: string;
  alertLevel: AlertLevel;
  findings: string[];
  rationale: string;
  evidence: string;
  limitations: string;
  manualReviewRequired: boolean;
  requiresData?: boolean;
  dataNeeded?: string;
}

// ─── Alert level styles ───────────────────────────────────────────────────────
const ALERT_STYLES: Record<AlertLevel, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
  info: {
    bg: "bg-blue-50/60 dark:bg-blue-900/10",
    border: "border-blue-200/60 dark:border-blue-700/30",
    text: "text-blue-700 dark:text-blue-400",
    icon: <Info size={13} />,
    label: "Within Normal",
  },
  warning: {
    bg: "bg-amber-50/60 dark:bg-amber-900/10",
    border: "border-amber-200/60 dark:border-amber-700/30",
    text: "text-amber-700 dark:text-amber-400",
    icon: <AlertTriangle size={13} />,
    label: "Attention",
  },
  caution: {
    bg: "bg-orange-50/60 dark:bg-orange-900/10",
    border: "border-orange-200/60 dark:border-orange-700/30",
    text: "text-orange-700 dark:text-orange-400",
    icon: <AlertTriangle size={13} />,
    label: "Caution",
  },
  critical: {
    bg: "bg-rose-50/60 dark:bg-rose-900/10",
    border: "border-rose-200/60 dark:border-rose-700/30",
    text: "text-rose-700 dark:text-rose-400",
    icon: <AlertCircle size={13} />,
    label: "Critical",
  },
};

// ─── Individual CDS module card ───────────────────────────────────────────────
function CdsModuleCard({ module: m }: { module: CdsModule }) {
  const [expanded, setExpanded] = useState(false);
  const style = ALERT_STYLES[m.alertLevel];

  if (m.requiresData) {
    return (
      <div className={`rounded-xl border ${style.border} ${style.bg} px-4 py-3`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className={`mt-0.5 shrink-0 ${style.text}`}>{style.icon}</span>
            <div>
              <p className={`text-xs font-semibold ${style.text}`}>{m.title}</p>
              <p className={`mt-0.5 text-[11px] ${style.text} opacity-80`}>{m.dataNeeded}</p>
            </div>
          </div>
          <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.text} ${style.bg} border ${style.border}`}>
            Data required
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${style.border} ${style.bg} overflow-hidden`}>
      <button
        className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <span className={`mt-0.5 shrink-0 ${style.text}`}>{style.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className={`text-xs font-semibold ${style.text}`}>{m.title}</p>
              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${style.text} opacity-70`}>
                {style.label}
              </span>
            </div>
            {m.findings.length > 0 && (
              <p className={`mt-0.5 text-[11px] ${style.text} opacity-80 truncate`}>
                {m.findings[0]}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {m.manualReviewRequired && (
            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
              Manual review
            </span>
          )}
          {expanded ? <ChevronUp size={13} className={style.text} /> : <ChevronDown size={13} className={style.text} />}
        </div>
      </button>

      {expanded && (
        <div className={`border-t ${style.border} px-4 pb-4 pt-3`}>
          {/* Findings */}
          {m.findings.length > 0 && (
            <div className="mb-3">
              <p className={`mb-1.5 text-[10px] font-bold uppercase tracking-wide ${style.text} opacity-70`}>Findings</p>
              <ul className={`space-y-1 text-[11px] ${style.text}`}>
                {m.findings.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">·</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rationale */}
          <div className="mb-3">
            <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${style.text} opacity-70`}>Clinical Rationale</p>
            <p className={`text-[11px] ${style.text} leading-relaxed`}>{m.rationale}</p>
          </div>

          {/* Evidence */}
          <div className="mb-3">
            <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${style.text} opacity-70`}>Evidence Base</p>
            <p className={`text-[11px] ${style.text} opacity-80`}>{m.evidence}</p>
          </div>

          {/* Limitations */}
          <div className="mb-3">
            <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${style.text} opacity-70`}>Limitations</p>
            <p className={`text-[11px] ${style.text} opacity-80`}>{m.limitations}</p>
          </div>

          {/* Manual review banner */}
          {m.manualReviewRequired && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50/80 px-3 py-2 dark:bg-rose-900/10">
              <ShieldAlert size={12} className="mt-0.5 shrink-0 text-rose-600" />
              <p className="text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                Manual clinical review required before proceeding. AI-assisted recommendation only.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Build CDS modules from clinical data ─────────────────────────────────────
function buildModules(
  analysis: CaseAnalysis | null,
  scores: AiScores | null,
  ceph: CephAnalysis | null,
  occlusion: OcclusionAnalysis | null,
): CdsModule[] {
  const modules: CdsModule[] = [];

  // 1. Crowding Severity
  const upperCrowding = analysis?.upperCrowdingMm ?? null;
  const lowerCrowding = analysis?.lowerCrowdingMm ?? null;
  if (upperCrowding === null && lowerCrowding === null) {
    modules.push({
      id: "crowding",
      title: "Crowding Severity Assessment",
      alertLevel: "info",
      findings: [],
      rationale: "",
      evidence: "Little 1975, Proffit 2018",
      limitations: "",
      manualReviewRequired: false,
      requiresData: true,
      dataNeeded: "Arch crowding measurements not available. Enter upper and lower crowding values in Clinical Analysis.",
    });
  } else {
    const worst = Math.min(upperCrowding ?? 0, lowerCrowding ?? 0);
    const level: AlertLevel = worst > 0 ? "info" : worst >= -4 ? "warning" : worst >= -8 ? "caution" : "critical";
    const findings: string[] = [];
    if (upperCrowding !== null) findings.push(`Upper arch: ${upperCrowding >= 0 ? "+" : ""}${upperCrowding.toFixed(1)} mm (${upperCrowding > 0 ? "spacing" : upperCrowding >= -4 ? "mild crowding" : upperCrowding >= -8 ? "moderate crowding" : "severe crowding"})`);
    if (lowerCrowding !== null) findings.push(`Lower arch: ${lowerCrowding >= 0 ? "+" : ""}${lowerCrowding.toFixed(1)} mm (${lowerCrowding > 0 ? "spacing" : lowerCrowding >= -4 ? "mild crowding" : lowerCrowding >= -8 ? "moderate crowding" : "severe crowding"})`);
    modules.push({
      id: "crowding",
      title: "Crowding Severity Assessment",
      alertLevel: level,
      findings,
      rationale: worst < -8
        ? "Severe crowding (>8 mm) typically requires extraction of premolars or significant arch expansion, with supplementary IPR. Non-extraction approaches are biomechanically challenged and have higher relapse risk."
        : worst < -4
          ? "Moderate crowding (4–8 mm) is borderline extraction territory. Non-extraction with arch expansion and IPR is possible but requires careful anchorage planning and stable retention."
          : worst < 0
            ? "Mild crowding (0–4 mm) can usually be managed without extraction. IPR of 0.25–0.5 mm per contact and mild proclination within biological limits are effective strategies."
            : "Arch spacing present. Space closure or maintenance should be considered based on patient growth status and aesthetic goals.",
      evidence: "Little 1975 irregularity index; Proffit 2018 Contemporary Orthodontics",
      limitations: "Crowding measurement accuracy depends on model quality and measurement method. Digital models have ±0.2 mm measurement error. Clinical validation required.",
      manualReviewRequired: worst < -8,
    });
  }

  // 2. Space Analysis
  modules.push({
    id: "space",
    title: "Space Analysis",
    alertLevel: analysis ? "info" : "info",
    findings: analysis ? [
      `Bolton Overall Ratio: ${analysis.boltonOverall !== null ? analysis.boltonOverall.toFixed(1) + "% (norm: 89.4–93.2%)" : "Not computed"}`,
      `Bolton Anterior Ratio: ${analysis.boltonAnterior !== null ? analysis.boltonAnterior.toFixed(1) + "% (norm: 74.9–79.5%)" : "Not computed"}`,
    ] : [],
    rationale: "Space analysis integrates arch length discrepancy, Bolton tooth-size ratio, and planned IPR to determine the net space balance. A positive balance indicates adequate space for alignment; negative indicates a space deficit requiring extraction, expansion, or IPR.",
    evidence: "Bolton 1958, Moyers 1988, Little 1975",
    limitations: "Arch length measurement from digital models carries ±0.5 mm error per arch. Bolton analysis assumes standard tooth morphology — atypical shapes require adjusted norms. IPR safety limited by enamel thickness (typically 0.5 mm maximum per contact).",
    manualReviewRequired: false,
    requiresData: !analysis,
    dataNeeded: "Clinical analysis with tooth measurements required to compute space analysis.",
  });

  // 3. Anchorage Demand
  const anchorage = scores?.anchorageLevel ?? null;
  modules.push({
    id: "anchorage",
    title: "Anchorage Demand Assessment",
    alertLevel: anchorage === "high" ? "caution" : anchorage === "medium" ? "warning" : "info",
    findings: anchorage ? [
      `Anchorage level: ${anchorage.toUpperCase()}`,
      anchorage === "high" ? "Translation >4 mm or torque >20° detected — maximum anchorage strategy required." :
      anchorage === "medium" ? "Moderate movement demands — reinforced anchorage recommended." :
      "Low movement demands — conventional anchorage adequate.",
    ] : [],
    rationale: "Anchorage demand is determined by the magnitude of planned tooth movements. High anchorage (translation >4 mm, torque >20°) requires reinforced anchorage via TADs, headgear, or fixed Class II correctors to prevent anchorage loss and unwanted proclination of incisors.",
    evidence: "Papadopoulos 2008 systematic review; Nanda 1997 biomechanics",
    limitations: "Anchorage demand is estimated from planned movements in the digital treatment plan. Actual anchorage loss is patient-specific and affected by biological response, compliance, and force magnitude. Clinical monitoring is essential.",
    manualReviewRequired: anchorage === "high",
    requiresData: !scores,
    dataNeeded: "Anchorage demand requires a treatment plan with tooth movement data.",
  });

  // 4. Biomechanical Complexity
  const collisions = scores?.collisionCount ?? null;
  const criticalIssues = scores?.criticalIssueCount ?? null;
  const complexityLevel: AlertLevel =
    collisions !== null && collisions > 3 ? "critical" :
    collisions !== null && collisions > 0 ? "caution" :
    criticalIssues !== null && criticalIssues > 0 ? "caution" : "info";
  modules.push({
    id: "biomechanics",
    title: "Biomechanical Complexity",
    alertLevel: complexityLevel,
    findings: [
      collisions !== null ? `${collisions} inter-tooth collision${collisions !== 1 ? "s" : ""} detected` : "Collision data not available",
      criticalIssues !== null ? `${criticalIssues} critical issue${criticalIssues !== 1 ? "s" : ""} in treatment plan` : "Quality analysis not available",
      scores?.warningCount !== undefined ? `${scores.warningCount} warning${scores.warningCount !== 1 ? "s" : ""} in treatment plan` : "",
    ].filter(Boolean),
    rationale: "Biomechanical complexity measures the difficulty of achieving planned movements without unintended side effects. Collisions indicate simultaneous movement conflicts between adjacent teeth. High complexity cases require staged movement sequences and increased clinical monitoring intervals.",
    evidence: "Kravitz 2009 aligner predictability; Haouili 2020 systematic review",
    limitations: "Collision detection is based on simplified geometric models and may not reflect actual clinical contact under aligner forces. Finite element analysis would provide more accurate force distribution predictions but is not currently implemented.",
    manualReviewRequired: collisions !== null && collisions > 0,
    requiresData: !scores,
    dataNeeded: "Biomechanical complexity requires a treatment plan with movement and collision data.",
  });

  // 5. Root Movement Risk
  modules.push({
    id: "root_risk",
    title: "Root Movement Risk",
    alertLevel: scores?.clinicalRiskScore !== undefined && scores.clinicalRiskScore > 60 ? "caution" : "info",
    findings: [
      "Root movement risk requires CBCT assessment for accurate evaluation.",
      scores?.clinicalRiskScore !== undefined ? `Clinical risk score: ${scores.clinicalRiskScore.toFixed(0)}/100` : "Clinical risk score not computed.",
    ],
    rationale: "Significant torque changes (>10°) and large bodily movements (>3 mm) increase risk of root resorption. Risk is amplified in patients with dilacerations, history of trauma, or hyperdivergent facial pattern. CBCT enables assessment of root proximity to cortical plates.",
    evidence: "Artun 1992 root resorption; Brezniak 2002 systematic review; Weltman 2010",
    limitations: "Root resorption cannot be reliably predicted from digital models alone. CBCT provides cortical plate proximity data but does not directly measure biological susceptibility. Genetic factors and prior orthodontic treatment history also contribute. CBCT is not computed — root proximity data unavailable.",
    manualReviewRequired: true,
  });

  // 6. Bone Limitation Warning
  const cbctAvailable = false; // CBCT pipeline not yet fully deployed
  modules.push({
    id: "bone_limit",
    title: "Bone Limitation Warning",
    alertLevel: cbctAvailable ? "info" : "warning",
    findings: [
      "CBCT scan not available for this case.",
      "Bone volume and cortical plate proximity cannot be assessed.",
      "Alveolar bone limitation is particularly relevant for: distalization, expansion, extrusion, and torque correction.",
    ],
    rationale: "Bone limits constrain the biologically achievable tooth movement envelope. Movements that exceed the alveolar housing cause dehiscence and fenestration, increasing root resorption and periodontal risk. Assessment requires CBCT with bone segmentation.",
    evidence: "Evangelista 2010 CBCT and root resorption; Gracco 2009 bone thickness",
    limitations: "Bone limitation assessment requires CBCT scan. Without CBCT, this module cannot provide quantitative bone volume or cortical plate distance data. Clinical estimation from dental photographs and model analysis is insufficient for borderline cases. This module shows 'Requires CBCT Scan' until volumetric data is available.",
    manualReviewRequired: true,
  });

  // 7. Collision Risk
  modules.push({
    id: "collision",
    title: "Inter-tooth Collision Risk",
    alertLevel: collisions !== null ? (collisions > 3 ? "critical" : collisions > 0 ? "caution" : "info") : "info",
    findings: collisions !== null ? [
      `${collisions} collision${collisions !== 1 ? "s" : ""} detected in current treatment plan`,
      collisions > 0 ? "Affected stages require movement sequencing adjustment." : "No geometric collisions detected in current staging.",
    ] : ["Collision data not available. Treatment plan with movement data required."],
    rationale: "Inter-tooth collisions occur when two teeth are programmed to occupy the same space simultaneously. Collisions indicate invalid movement sequences that will cause aligner fit failure and potentially injury. Resolution requires movement staging adjustment, IPR, or modification of movement magnitude.",
    evidence: "Kravitz 2009; Align Technology technical specifications",
    limitations: "Collision detection is based on bounding box approximation of tooth geometry. Contact between crown surfaces (occlusal interference) and root apex proximity are not captured. Clinician should validate staging with actual 3D mesh rendering.",
    manualReviewRequired: collisions !== null && collisions > 0,
    requiresData: !scores,
    dataNeeded: "Inter-tooth collision detection requires a treatment plan with staged movements.",
  });

  // 8. Refinement Likelihood
  const refinementProb = scores?.refinementProbability ?? null;
  const refinementLevel: AlertLevel =
    refinementProb === null ? "info" :
    refinementProb > 0.7 ? "caution" :
    refinementProb > 0.4 ? "warning" : "info";
  modules.push({
    id: "refinement",
    title: "Refinement Likelihood",
    alertLevel: refinementLevel,
    findings: refinementProb !== null ? [
      `AI-estimated refinement probability: ${(refinementProb * 100).toFixed(0)}%`,
      scores?.refinementCycleCount !== undefined ? `Prior refinement cycles on this case: ${scores.refinementCycleCount}` : "",
      refinementProb > 0.5 ? "High likelihood of requiring at least one refinement. Factor into treatment timeline and cost estimates." : "Moderate-to-low refinement likelihood. Standard monitoring protocol applies.",
    ].filter(Boolean) : ["Refinement probability not computed — treatment plan required."],
    rationale: "Refinement probability is estimated using a logistic sigmoid function of case complexity, prior refinement cycle count, and movement predictability indices (based on Kravitz 2009 aligner predictability data). It is an estimate of the likelihood that active treatment will not achieve the planned occlusion without at least one refinement.",
    evidence: "Kravitz 2009 (predictability data); Haouili 2020 systematic review of aligner outcome",
    limitations: "This is a statistical estimate based on aggregate data and does not account for individual biological response, compliance, attachment placement accuracy, or inter-appointment variations in wear time. Refinement need is determined clinically at treatment completion.",
    manualReviewRequired: refinementProb !== null && refinementProb > 0.6,
    requiresData: !scores,
    dataNeeded: "Refinement likelihood requires AI scores from a treatment plan.",
  });

  // 9. Compliance Risk
  modules.push({
    id: "compliance",
    title: "Compliance Risk Assessment",
    alertLevel: "warning",
    findings: [
      "Compliance risk cannot be computed from digital models alone.",
      "Requires direct patient interview and behavioral assessment.",
    ],
    rationale: "Clear aligner treatment requires 20–22 hours/day of aligner wear for predictable tooth movement. Non-compliance (wearing <18 hours/day) results in tooth movement lag, increased refinement need, and potential loss of planned movement entirely. Compliance risk is a clinical assessment, not a computable metric.",
    evidence: "Schott 2017; Lombardo 2018; Inman 2020 aligner compliance review",
    limitations: "Compliance cannot be measured without Bluetooth-enabled aligner tracking devices or patient-reported outcome measures. This module provides a reminder that compliance assessment must be performed by the clinical team through patient interview and motivation assessment at each appointment. AI-computed compliance risk is not available — Requires Manual Review.",
    manualReviewRequired: true,
  });

  // 10. Manufacturing Feasibility
  modules.push({
    id: "manufacturing",
    title: "Manufacturing Feasibility",
    alertLevel: scores?.criticalIssueCount !== undefined && scores.criticalIssueCount > 0 ? "caution" : "info",
    findings: [
      scores?.qualityGrade ? `Quality grade: ${scores.qualityGrade} (${scores.qualityScore?.toFixed(0) ?? "—"}/100)` : "Manufacturing quality score not available.",
      scores?.unsafeIprCount !== undefined && scores.unsafeIprCount > 0 ? `${scores.unsafeIprCount} unsafe IPR contact${scores.unsafeIprCount !== 1 ? "s" : ""} exceed enamel reduction safety limits.` : "No unsafe IPR contacts detected.",
    ].filter(Boolean),
    rationale: "Manufacturing feasibility evaluates whether the treatment plan can be executed with available 3D printing and aligner fabrication equipment. Key constraints include minimum wall thickness (>0.7 mm), printable geometry (no unsupported overhangs), and stage-to-stage movement magnitude within aligner elastic recovery range.",
    evidence: "Align Technology manufacturing specs; SprintRay printer technical documentation",
    limitations: "This assessment is based on the treatment plan data and quality score. Full manufacturing feasibility requires STL file review by the manufacturing team. Proprietary aligner material properties are not factored into this analysis.",
    manualReviewRequired: scores?.criticalIssueCount !== undefined && scores.criticalIssueCount > 0,
  });

  return modules;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ClinicalDecisionSupportPanel({ caseId }: { caseId: string }) {
  const [loading, setLoading]     = useState(true);
  const [analysis, setAnalysis]   = useState<CaseAnalysis | null>(null);
  const [scores, setScores]       = useState<AiScores | null>(null);
  const [ceph, setCeph]           = useState<CephAnalysis | null>(null);
  const [occlusion, setOcclusion] = useState<OcclusionAnalysis | null>(null);
  const [error, setError]         = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [aR, sR, cR, oR] = await Promise.allSettled([
      getLatestAnalysis(caseId),
      getAiScores(caseId),
      listCephAnalyses(caseId).then(arr => arr.length > 0 ? arr[0] : null),
      listOcclusionAnalyses(caseId).then(arr => arr.length > 0 ? arr[0] : null),
    ]);
    if (aR.status === "fulfilled") setAnalysis(aR.value);
    if (sR.status === "fulfilled") setScores(sR.value);
    if (cR.status === "fulfilled") setCeph(cR.value);
    if (oR.status === "fulfilled") setOcclusion(oR.value);
    // Non-critical: show partial data even if some sources fail
    const errs = [aR, sR, cR, oR].filter(r => r.status === "rejected" && r.reason instanceof Error && !(r.reason.message.includes("404"))).map(r => (r as PromiseRejectedResult).reason instanceof Error ? (r as PromiseRejectedResult).reason.message : "Unknown error");
    if (errs.length === 4) setError("All data sources unavailable. " + errs[0]);
    setLoading(false);
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-14 rounded-xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
        <AlertCircle size={15} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Clinical decision support unavailable</p>
          <p className="mt-0.5 text-xs opacity-80">{error}</p>
          <button onClick={load} className="mt-2 text-xs underline">Retry</button>
        </div>
      </div>
    );
  }

  const modules = buildModules(analysis, scores, ceph, occlusion);
  const criticalCount = modules.filter(m => m.alertLevel === "critical").length;
  const cautionCount = modules.filter(m => m.alertLevel === "caution" && !m.requiresData).length;
  const reviewRequired = modules.filter(m => m.manualReviewRequired).length;

  return (
    <div className="space-y-4">
      <ClinicalWarningBanner message="AI-assisted clinical decision support. All recommendations require review and sign-off by a licensed orthodontist before clinical use." />

      {/* Summary bar */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-bold text-foreground tabular-nums">{modules.length}</p>
            <p className="text-[10px] text-secondary uppercase tracking-wide">Modules</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">{criticalCount}</p>
            <p className="text-[10px] text-secondary uppercase tracking-wide">Critical</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-orange-500">{cautionCount}</p>
            <p className="text-[10px] text-secondary uppercase tracking-wide">Caution</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">{reviewRequired}</p>
            <p className="text-[10px] text-secondary uppercase tracking-wide">Need Review</p>
          </div>
          <div className="flex-1 min-w-[120px]">
            <p className="text-[10px] text-secondary">
              Click any module to expand findings, rationale, evidence, and review requirements.
            </p>
          </div>
        </div>
      </Card>

      {/* Module list */}
      <div className="space-y-2">
        {modules.map(m => (
          <CdsModuleCard key={m.id} module={m} />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-secondary max-w-sm">
          Clinical decision support generated from available case data. Modules showing
          "Data required" will populate as clinical measurements are entered.
        </p>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
