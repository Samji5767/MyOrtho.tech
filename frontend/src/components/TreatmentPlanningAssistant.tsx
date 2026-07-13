"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock,
  Info,
  LayoutList,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button, Card } from "@/components/DesignSystem";
import { ClinicalWarningBanner } from "@/components/ui/ClinicalWarningBanner";
import { getLatestAnalysis, type CaseAnalysis } from "@/lib/api/analysis";
import { getAiScores, type AiScores } from "@/lib/api/ai-scores";
import { listCephAnalyses, type CephAnalysis } from "@/lib/api/ceph";

// ─── AI Disclaimer (always visible on every module) ──────────────────────────
const AI_DISCLAIMER =
  "AI-assisted guidance only. Final treatment decisions remain the responsibility of the licensed orthodontist.";

// ─── Decision level badge ──────────────────────────────────────────────────────
type DecisionLevel = "recommended" | "consider" | "caution" | "contraindicated" | "requires_data";

function DecisionBadge({ level }: { level: DecisionLevel }) {
  const map: Record<DecisionLevel, { label: string; cls: string }> = {
    recommended:    { label: "Recommended",     cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
    consider:       { label: "Consider",         cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
    caution:        { label: "Caution",          cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
    contraindicated:{ label: "Contraindicated",  cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
    requires_data:  { label: "Requires data",    cls: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  };
  const { label, cls } = map[level];
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls}`}>
      {level === "recommended" && "✓ "}{label}
    </span>
  );
}

// ─── Module card ───────────────────────────────────────────────────────────────
interface PlanningModuleProps {
  title: string;
  icon: React.ReactNode;
  items: Array<{
    option: string;
    level: DecisionLevel;
    rationale: string;
    evidence?: string;
    limitation?: string;
  }>;
  notes?: string;
}

function PlanningModule({ title, icon, items, notes }: PlanningModuleProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden">
      <button
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-slate-400">{icon}</span>
          <span className="text-sm font-semibold text-foreground">{title}</span>
        </div>
        {expanded ? <ChevronUp size={14} className="text-secondary" /> : <ChevronDown size={14} className="text-secondary" />}
      </button>

      {expanded && (
        <div className="border-t border-border px-5 pb-4">
          <div className="mt-3 space-y-3">
            {items.map((item, i) => (
              <div key={i} className="rounded-lg border border-border bg-slate-50/60 p-3 dark:bg-slate-800/40">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs font-medium text-foreground">{item.option}</span>
                  <DecisionBadge level={item.level} />
                </div>
                <p className="mt-1.5 text-[11px] text-secondary leading-relaxed">{item.rationale}</p>
                {item.evidence && (
                  <p className="mt-1 text-[10px] text-secondary/70">Evidence: {item.evidence}</p>
                )}
                {item.limitation && (
                  <div className="mt-1.5 flex items-start gap-1.5">
                    <AlertTriangle size={10} className="mt-0.5 shrink-0 text-amber-500" />
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">{item.limitation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
          {notes && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-blue-50/60 px-3 py-2 dark:bg-blue-900/10">
              <Info size={11} className="mt-0.5 shrink-0 text-blue-500" />
              <p className="text-[11px] text-blue-700 dark:text-blue-400">{notes}</p>
            </div>
          )}
          <p className="mt-2 text-[10px] text-secondary/70 italic">{AI_DISCLAIMER}</p>
        </div>
      )}
    </Card>
  );
}

// ─── Risk summary row ─────────────────────────────────────────────────────────
function RiskRow({ label, value, color }: { label: string; value: string; color: "green" | "yellow" | "orange" | "red" }) {
  const dot: Record<string, string> = {
    green: "bg-emerald-500", yellow: "bg-amber-400", orange: "bg-orange-500", red: "bg-rose-500",
  };
  return (
    <div className="flex items-center justify-between py-2 text-xs border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${dot[color]}`} />
        <span className="text-secondary">{label}</span>
      </div>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

// ─── Phase step ───────────────────────────────────────────────────────────────
function PhaseStep({ number, label, active, done }: { number: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs ${active ? "text-foreground" : done ? "text-secondary" : "text-secondary/50"}`}>
      <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
        done ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
        active ? "bg-primary/10 text-primary" :
        "bg-slate-100 dark:bg-slate-800"
      }`}>
        {done ? "✓" : number}
      </div>
      <span className={active ? "font-semibold" : ""}>{label}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function TreatmentPlanningAssistant({ caseId }: { caseId: string }) {
  const [loading, setLoading]     = useState(true);
  const [analysis, setAnalysis]   = useState<CaseAnalysis | null>(null);
  const [scores, setScores]       = useState<AiScores | null>(null);
  const [ceph, setCeph]           = useState<CephAnalysis | null>(null);
  const [activeSection, setActiveSection] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [aR, sR, cR] = await Promise.allSettled([
      getLatestAnalysis(caseId),
      getAiScores(caseId),
      listCephAnalyses(caseId).then(arr => arr.length > 0 ? arr[0] : null),
    ]);
    if (aR.status === "fulfilled") setAnalysis(aR.value);
    if (sR.status === "fulfilled") setScores(sR.value);
    if (cR.status === "fulfilled") setCeph(cR.value);
    setLoading(false);
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-14 rounded-xl border border-border bg-card" />
        ))}
      </div>
    );
  }

  // ── Derive planning context from available data ────────────────────────────
  const upperCrowding = analysis?.upperCrowdingMm ?? null;
  const lowerCrowding = analysis?.lowerCrowdingMm ?? null;
  const maxCrowding = (upperCrowding !== null && lowerCrowding !== null)
    ? Math.min(upperCrowding, lowerCrowding)   // most negative = worst arch
    : upperCrowding ?? lowerCrowding;

  const overjet = analysis?.overjetMm ?? null;
  const overbite = analysis?.overbiteM ?? null;
  const angleClass = analysis?.angleClass ?? null;
  const skeletalClass = ceph?.skeletalClass ?? null;
  const verticalPattern = ceph?.verticalPattern ?? null;

  const hasExtractionIndicators =
    (maxCrowding !== null && maxCrowding < -8) ||
    (overjet !== null && overjet > 6 && skeletalClass === "II");

  const hasExpansionIndicators = analysis?.boltonOverall !== null;
  const anchorage = scores?.anchorageLevel ?? "low";
  const refinementProb = scores?.refinementProbability ?? null;
  const duration = scores?.estimatedDurationMonths ?? null;

  // ── Sections ───────────────────────────────────────────────────────────────
  const sections = [
    {
      title: "1. Space Management",
      phase: "space",
      icon: <LayoutList size={15} />,
      items: [
        {
          option: "Non-extraction approach",
          level: (maxCrowding === null ? "requires_data" : maxCrowding >= -4 ? "recommended" : maxCrowding >= -8 ? "consider" : "caution") as DecisionLevel,
          rationale: maxCrowding !== null
            ? `Crowding of ${Math.abs(maxCrowding).toFixed(1)} mm. Non-extraction is favored for crowding ≤4 mm with good arch form. Space may be obtained via arch expansion, IPR, or proclination of incisors.`
            : "Crowding measurements not available. Enter arch space measurements to determine extraction need.",
          evidence: "Proffit 2018, Little 1990",
          limitation: maxCrowding !== null && maxCrowding < -6 ? "Borderline case — extraction decision requires clinical judgment including facial profile, anchorage, and growth status." : undefined,
        },
        {
          option: "Extraction (premolar) approach",
          level: (maxCrowding === null ? "requires_data" : hasExtractionIndicators ? "consider" : "caution") as DecisionLevel,
          rationale: maxCrowding !== null
            ? hasExtractionIndicators
              ? `Crowding of ${Math.abs(maxCrowding).toFixed(1)} mm exceeds 8 mm or overjet/skeletal pattern indicates extraction benefit. Premolar extraction provides space for alignment and retraction.`
              : `Crowding of ${Math.abs(maxCrowding).toFixed(1)} mm is within non-extraction range. Extraction not indicated by space analysis alone.`
            : "Crowding measurements required.",
          evidence: "Huang 2011, Paquette 1992",
          limitation: "Extraction decisions are irreversible. Requires full facial profile assessment, CBCT bone volume, and patient growth status evaluation.",
        },
        {
          option: "IPR (interproximal reduction)",
          level: (maxCrowding !== null && maxCrowding >= -6 && maxCrowding < 0 ? "consider" : maxCrowding !== null && maxCrowding >= -8 ? "consider" : "caution") as DecisionLevel,
          rationale: "IPR of up to 0.5 mm per contact point is safe for enamel >2 mm thick. Total safe IPR per arch: ≈4–5 mm. Check Bolton discrepancy and enamel thickness before planning.",
          evidence: "Sheridan 1985, Zachrisson 2004",
          limitation: "Safe enamel reduction limit is 0.5 mm per contact. Total IPR should not exceed 50% of enamel thickness. CBCT or enamel thickness probe recommended.",
        },
      ],
      notes: "Space management is the primary driver of all subsequent planning decisions. Finalize this section with clinician review before proceeding.",
    },
    {
      title: "2. Arch Form & Expansion",
      phase: "expansion",
      icon: <ChevronRight size={15} />,
      items: [
        {
          option: "Transverse expansion (upper arch)",
          level: (hasExpansionIndicators ? "consider" : "requires_data") as DecisionLevel,
          rationale: "Expansion of the upper arch is indicated for posterior crossbite or narrow upper arch relative to lower. Effective in growing patients; limited in adults without MSE/SARPE.",
          evidence: "Proffit 2018, Bishara 1998",
          limitation: "Adult expansion has relapse risk >30% without retention. Skeletal vs dental expansion must be distinguished. Requires CBCT assessment of bone sutures in borderline cases.",
        },
        {
          option: "Lower arch expansion",
          level: "caution" as DecisionLevel,
          rationale: "Lower arch expansion beyond the natural arch perimeter has high relapse rates. Limited to 2–3 mm in the premolar region with stable retention protocol.",
          evidence: "Shapiro 1974, Little 1990",
          limitation: "High relapse risk. Permanent retention typically required. Discuss long-term expectations with patient.",
        },
        {
          option: "Arch form coordination",
          level: "recommended" as DecisionLevel,
          rationale: "Upper and lower arch forms should be coordinated to achieve inter-arch compatibility. Mismatch in arch width leads to occlusal instability.",
          evidence: "Andrews 1972",
        },
      ],
    },
    {
      title: "3. Anterior-Posterior Correction",
      phase: "ap_correction",
      icon: <CircleDot size={15} />,
      items: [
        {
          option: "Class II correction — distalization",
          level: (skeletalClass === "II" ? "consider" : skeletalClass === null ? "requires_data" : "caution") as DecisionLevel,
          rationale: skeletalClass === "II"
            ? "Skeletal Class II detected. Distalization of upper molars is a non-extraction option for mild-to-moderate Class II. Requires high anchorage and/or Class II elastics."
            : skeletalClass === null
              ? "Skeletal classification requires cephalometric analysis."
              : "Distalization is typically indicated for Class II cases only.",
          evidence: "Ngantung 2001, Bolla 2002",
          limitation: "Distalization requires adequate posterior dentoalveolar bone volume. CBCT recommended to assess distal root proximity to cortical plates.",
        },
        {
          option: "Class III correction — mesial mechanics",
          level: (skeletalClass === "III" ? "consider" : skeletalClass === null ? "requires_data" : "caution") as DecisionLevel,
          rationale: skeletalClass === "III"
            ? "Skeletal Class III detected. Dental compensation through retroclination of lower incisors and proclination of upper incisors. Surgical option should be discussed for severe cases."
            : skeletalClass === null
              ? "Skeletal classification requires cephalometric analysis."
              : "Mesial mechanics not indicated for non-Class III cases.",
          evidence: "Proffit 2018",
          limitation: "Class III with skeletal component >−4° ANB typically requires orthognathic surgery. Camouflage has facial profile and stability limitations.",
        },
        {
          option: "Overjet correction (incisor retraction)",
          level: (overjet !== null && overjet > 4 ? "recommended" : overjet !== null && overjet <= 4 ? "caution" : "requires_data") as DecisionLevel,
          rationale: overjet !== null
            ? `Overjet of ${overjet.toFixed(1)} mm. ${overjet > 4 ? "Retraction is recommended. Anchorage planning critical — avoid unwanted lower incisor proclination." : "Overjet within borderline range. Minor retraction mechanics may be considered."}`
            : "Overjet measurement required.",
          evidence: "Houston 1989",
        },
      ],
    },
    {
      title: "4. Vertical Control",
      phase: "vertical",
      icon: <ChevronDown size={15} />,
      items: [
        {
          option: "Deep bite correction (intrusion / extrusion)",
          level: (overbite !== null && overbite > 4 ? "recommended" : overbite !== null && overbite > 2 ? "consider" : overbite !== null ? "caution" : "requires_data") as DecisionLevel,
          rationale: overbite !== null
            ? overbite > 4
              ? `Severe deep bite (${overbite.toFixed(1)} mm). Active intrusion of lower incisors and/or extrusion of posterior segments required. Posterior extrusion is more stable in hyperdivergent patients.`
              : `Overbite of ${overbite.toFixed(1)} mm. ${overbite > 2 ? "Mild correction may be needed." : "Overbite within acceptable range."}`
            : "Overbite measurement required.",
          evidence: "Proffit 2018",
          limitation: overbite !== null && overbite > 4 && verticalPattern === "hyperdivergent"
            ? "Hyperdivergent patient: extrusion of posteriors worsens open bite tendency. Prefer intrusion mechanics. Monitor anchorage closely."
            : undefined,
        },
        {
          option: "Open bite treatment",
          level: (overbite !== null && overbite < 0 ? "recommended" : "caution") as DecisionLevel,
          rationale: overbite !== null && overbite < 0
            ? `Open bite of ${Math.abs(overbite).toFixed(1)} mm detected. Anterior open bite correction requires posterior intrusion (often via TADs) and habit cessation counseling.`
            : "Open bite mechanics not indicated unless overbite is negative.",
          evidence: "Proffit 2018, Rao 2011",
          limitation: "Anterior open bite has relapse rates >25% without rigorous retention. Underlying habits (digit sucking, tongue thrust) must be addressed.",
        },
        {
          option: "Curve of Spee leveling",
          level: "consider" as DecisionLevel,
          rationale: "Deep Curve of Spee requires arch leveling. Each 1 mm of Curve of Spee depth adds approximately 0.5 mm arch length demand per quadrant. This must be factored into space analysis.",
          evidence: "Braun 1996",
        },
      ],
    },
    {
      title: "5. Anchorage & Biomechanics",
      phase: "anchorage",
      icon: <ShieldAlert size={15} />,
      items: [
        {
          option: "Maximum anchorage (TADs / headgear)",
          level: (anchorage === "high" ? "recommended" : "consider") as DecisionLevel,
          rationale: anchorage === "high"
            ? "High anchorage demand detected from movement data (translation >4 mm or torque >20°). Conventional anchorage may be insufficient. TADs or headgear strongly recommended."
            : "Anchorage demand is moderate to low. Conventional anchorage with careful mechanics may suffice.",
          evidence: "Papadopoulos 2008",
          limitation: "TADs require informed consent, surgical skill, and CBCT verification of placement site. Failure rate 10–20% per systematic review.",
        },
        {
          option: "Class II / III elastics",
          level: "consider" as DecisionLevel,
          rationale: "Elastics provide inter-arch force for A-P correction. Class II: lower to upper. Class III: upper to lower. Compliance-dependent — patient motivation essential.",
          evidence: "Proffit 2018",
          limitation: "Compliance-dependent. Poor compliance causes unwanted proclination of lower incisors. Consider fixed Class II correctors for non-compliant patients.",
        },
        {
          option: "Reciprocal anchorage",
          level: (anchorage === "low" ? "recommended" : "consider") as DecisionLevel,
          rationale: "Both arches serve as anchorage for each other. Suitable for tooth alignment without significant A-P correction. Lower anchorage demand cases.",
          evidence: "Nanda 1997",
        },
      ],
    },
    {
      title: "6. Attachments & Auxiliaries",
      phase: "attachments",
      icon: <CircleDot size={15} />,
      items: [
        {
          option: "Vertical rectangular attachments",
          level: "consider" as DecisionLevel,
          rationale: "Used for torque control on incisors and canines. Required for >10° torque correction. Particularly important for upper canine torque in extraction cases.",
          evidence: "Kravitz 2009",
        },
        {
          option: "Horizontal rectangular attachments",
          level: "consider" as DecisionLevel,
          rationale: "Used for intrusion and extrusion of posterior teeth. Required when posterior vertical correction is planned beyond 1.5 mm.",
          evidence: "Kravitz 2009",
        },
        {
          option: "Optimized attachments (aligner-specific)",
          level: "recommended" as DecisionLevel,
          rationale: "Aligner-specific optimized attachments are calculated by the aligner system software for each tooth requiring movement beyond predictable thresholds. Follow manufacturer guidance.",
          evidence: "Align Technology 2019",
          limitation: "Attachment placement requires precise bonding technique. Poorly placed attachments reduce predictability.",
        },
      ],
    },
    {
      title: "7. Refinement & Retention Planning",
      phase: "refinement",
      icon: <RefreshCw size={15} />,
      items: [
        {
          option: "Refinement planning",
          level: (refinementProb !== null && refinementProb > 0.5 ? "recommended" : "consider") as DecisionLevel,
          rationale: refinementProb !== null
            ? `AI-estimated refinement probability: ${(refinementProb * 100).toFixed(0)}%. ${refinementProb > 0.5 ? "High refinement likelihood — plan for one refinement cycle in duration and cost estimates." : "Refinement may or may not be needed — monitor progress at retention."}`
            : "Refinement probability not computed (treatment plan required).",
          evidence: "Kravitz 2009, Haouili 2020",
          limitation: "Refinement probability is an estimate based on case complexity and prior cycle count. It does not substitute for clinical assessment at completion of active treatment.",
        },
        {
          option: "Fixed retention (bonded lingual wire)",
          level: "recommended" as DecisionLevel,
          rationale: "Bonded lingual retainers on lower 3-3 and/or upper 3-3 provide permanent retention for aligned incisors. Recommended for all cases with significant incisor movement.",
          evidence: "Proffit 2018, Littlewood 2016",
          limitation: "Requires monthly patient checks. Wire failure can lead to rapid relapse. Patient must be counseled on oral hygiene around retainer.",
        },
        {
          option: "Removable vacuum-formed retainer",
          level: "recommended" as DecisionLevel,
          rationale: "Removable Essix-type retainer worn nightly provides full arch retention. Used in combination with bonded retainers. Duration: at least 1 year full-time, then nightly indefinitely.",
          evidence: "Padmos 2018",
        },
      ],
    },
    {
      title: "8. Treatment Duration Estimate",
      phase: "duration",
      icon: <Clock size={15} />,
      items: [
        {
          option: "Estimated active treatment",
          level: (duration !== null ? (duration <= 24 ? "normal" as DecisionLevel : "consider" as DecisionLevel) : "requires_data" as DecisionLevel),
          rationale: duration !== null
            ? `AI-estimated duration: ${duration} months (${Math.ceil(duration / 1.5)}–${Math.ceil(duration / 1)} aligner stages estimated). This is based on planned movements; actual duration depends on compliance, staging interval, and refinements.`
            : "Treatment plan with movement data required to estimate duration.",
          evidence: "Based on planned movement magnitudes and staging parameters",
          limitation: "Duration estimates have ±30% variability. Compliance, biological response, and intercurrent events significantly affect actual duration.",
        },
      ],
      notes: `${AI_DISCLAIMER} All estimates above are derived from digital model analysis and AI movement algorithms. Clinician must confirm all planning decisions prior to treatment initiation.`,
    },
  ];

  // ── Risk Summary ──────────────────────────────────────────────────────────
  const riskItems = [
    { label: "Root resorption risk", value: scores?.clinicalRiskScore !== undefined ? (scores.clinicalRiskScore > 60 ? "Elevated" : "Standard") : "Not assessed", color: scores?.clinicalRiskScore !== undefined && scores.clinicalRiskScore > 60 ? "orange" : "green" },
    { label: "Anchorage loss risk", value: anchorage === "high" ? "High" : anchorage === "medium" ? "Medium" : "Low", color: anchorage === "high" ? "orange" : anchorage === "medium" ? "yellow" : "green" },
    { label: "Relapse risk", value: refinementProb !== null ? (refinementProb > 0.6 ? "High" : refinementProb > 0.3 ? "Moderate" : "Low") : "Unknown", color: refinementProb !== null && refinementProb > 0.6 ? "orange" : "yellow" },
    { label: "Aligner compliance", value: "Requires monitoring", color: "yellow" },
    { label: "Enamel safety (IPR)", value: scores?.unsafeIprCount === 0 ? "No unsafe IPR" : scores ? `${scores.unsafeIprCount} unsafe contacts` : "Not assessed", color: scores?.unsafeIprCount !== undefined && scores.unsafeIprCount > 0 ? "red" : "green" },
  ] as const;

  return (
    <div className="space-y-4">
      <ClinicalWarningBanner message={AI_DISCLAIMER} />

      {/* Phase progress */}
      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Treatment Planning Workflow</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {["Space Management", "Arch Form", "A-P Correction", "Anchorage"].map((step, i) => (
            <PhaseStep key={i} number={i + 1} label={step} active={activeSection === i} done={false} />
          ))}
        </div>
      </Card>

      {/* Data availability notice */}
      {(!analysis && !scores) && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-xs text-amber-700 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-400">
          <Info size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Limited data available</p>
            <p className="mt-0.5 opacity-80">
              Clinical analysis and treatment plan data are not yet available for this case.
              Planning guidance will be populated as clinical measurements are entered.
            </p>
          </div>
        </div>
      )}

      {/* Planning modules */}
      <div className="space-y-2">
        {sections.map((s, i) => (
          <PlanningModule
            key={i}
            title={s.title}
            icon={s.icon}
            items={s.items as PlanningModuleProps["items"]}
            notes={s.notes}
          />
        ))}
      </div>

      {/* Risk summary */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-foreground">Risk Summary</h3>
        </div>
        <div>
          {riskItems.map((r, i) => (
            <RiskRow key={i} label={r.label} value={r.value} color={r.color as "green" | "yellow" | "orange" | "red"} />
          ))}
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50/60 px-3 py-2 dark:bg-amber-900/10">
          <Info size={11} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-[10px] text-amber-700 dark:text-amber-400">
            Risk assessments are derived from digital model analysis and AI movement algorithms.
            Clinical risk assessment must be performed by the treating orthodontist.
          </p>
        </div>
      </Card>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh guidance
        </Button>
      </div>
    </div>
  );
}
