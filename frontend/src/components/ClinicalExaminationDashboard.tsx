"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Info, RefreshCw } from "lucide-react";
import { Button, Card } from "@/components/DesignSystem";
import { ClinicalWarningBanner } from "@/components/ui/ClinicalWarningBanner";
import { getLatestAnalysis, type CaseAnalysis } from "@/lib/api/analysis";
import { listCephAnalyses, type CephAnalysis } from "@/lib/api/ceph";
import { listOcclusionAnalyses, type OcclusionAnalysis } from "@/lib/api/occlusion";
import { getAiScores, type AiScores } from "@/lib/api/ai-scores";

// ─── Deep analysis type (from /api/clinical-analysis-deep?caseId) ─────────────
interface DeepAnalysis {
  id: string;
  case_id: string | null;
  bolton_anterior_ratio: number;
  bolton_overall_ratio: number;
  bolton_discrepancy_mm: number;
  arch_length_upper_mm: number | null;
  arch_length_lower_mm: number | null;
  arch_length_discrepancy_mm: number | null;
  crowding_upper_mm: number | null;
  crowding_lower_mm: number | null;
  spacing_upper_mm: number | null;
  spacing_lower_mm: number | null;
  overjet_mm: number | null;
  overbite_mm: number | null;
  overbite_percent: number | null;
  curve_of_spee_mm: number | null;
  midline_deviation_mm: number | null;
  midline_direction: string | null;
  angle_class: string | null;
  canine_relationship_right: string | null;
  canine_relationship_left: string | null;
  molar_relationship_right: string | null;
  molar_relationship_left: string | null;
  upper_arch_width_mm: number | null;
  lower_arch_width_mm: number | null;
  transverse_discrepancy_mm: number | null;
  measurement_source: Record<string, string>;
  diagnostic_summary: string;
  confidence: number;
  created_at: string;
}

// ─── Severity classification ──────────────────────────────────────────────────
type Severity = "normal" | "mild" | "moderate" | "severe" | "not_computed";
type BadgeColor = "green" | "yellow" | "orange" | "red" | "slate";

const SEV_COLOR: Record<Severity, BadgeColor> = {
  normal: "green",
  mild: "yellow",
  moderate: "orange",
  severe: "red",
  not_computed: "slate",
};

const SEV_LABEL: Record<Severity, string> = {
  normal: "Within normal range",
  mild: "Mild deviation",
  moderate: "Moderate deviation",
  severe: "Severe deviation",
  not_computed: "Not computed",
};

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ label, color }: { label: string; color: BadgeColor }) {
  const cls: Record<BadgeColor, string> = {
    green:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    yellow: "bg-amber-100  text-amber-700  dark:bg-amber-900/30  dark:text-amber-400",
    orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    red:    "bg-rose-100   text-rose-700   dark:bg-rose-900/30   dark:text-rose-400",
    slate:  "bg-slate-100  text-slate-500  dark:bg-slate-800     dark:text-slate-400",
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cls[color]}`}>
      {label}
    </span>
  );
}

// ─── Metric display row ────────────────────────────────────────────────────────
interface MetricRowProps {
  label: string;
  value: number | string | null;
  unit?: string;
  normalRange: string;
  severity: Severity;
  explanation: string;
  confidence: number | null;
  dataSource: string;
  evidence?: string;
}

function MetricRow({ label, value, unit = "", normalRange, severity, explanation, confidence, dataSource, evidence }: MetricRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasValue = value !== null && value !== undefined;
  const displayValue = hasValue ? `${typeof value === "number" ? value.toFixed(1) : value}${unit}` : null;

  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      <div className="flex items-start justify-between gap-3 text-xs">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-secondary shrink-0">{label}</span>
            {explanation && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
                aria-label="Toggle explanation"
              >
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </button>
            )}
          </div>
          {expanded && (
            <div className="mt-1.5 space-y-1 pl-0.5">
              <p className="text-[10px] text-secondary leading-relaxed">{explanation}</p>
              <p className="text-[10px] text-secondary/70">
                Normal range: {normalRange}
                {evidence && <> &nbsp;·&nbsp; Source: {evidence}</>}
              </p>
              <p className="text-[10px] text-secondary/70">
                Data source: {dataSource}
                {confidence !== null && <> &nbsp;·&nbsp; Confidence: {(confidence * 100).toFixed(0)}%</>}
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {displayValue ? (
            <span className="tabular-nums font-semibold text-foreground">{displayValue}</span>
          ) : (
            <span className="italic text-secondary text-[11px]">Not computed</span>
          )}
          <Badge
            label={hasValue ? SEV_LABEL[severity] : "Not computed"}
            color={hasValue ? SEV_COLOR[severity] : "slate"}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Tooth list display ───────────────────────────────────────────────────────
function ToothListRow({ label, teeth }: { label: string; teeth: number[] }) {
  if (teeth.length === 0) {
    return (
      <div className="flex items-center justify-between gap-3 py-2 text-xs border-b border-border/50 last:border-0">
        <span className="text-secondary">{label}</span>
        <Badge label="None detected" color="green" />
      </div>
    );
  }
  return (
    <div className="py-2 border-b border-border/50 last:border-0">
      <div className="flex items-start justify-between gap-3 text-xs">
        <span className="text-secondary shrink-0">{label}</span>
        <div className="flex flex-wrap gap-1 justify-end max-w-[200px]">
          {teeth.map(t => (
            <span key={t} className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Confidence bar ───────────────────────────────────────────────────────────
function ConfidenceBar({ confidence }: { confidence: number | null }) {
  if (confidence === null) return (
    <span className="text-xs italic text-secondary">Not scored</span>
  );
  const pct = Math.min(100, Math.max(0, confidence * 100));
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-400" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-secondary w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, subtitle, children, badge }: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[11px] text-secondary">{subtitle}</p>}
        </div>
        {badge}
      </div>
      <div>{children}</div>
    </Card>
  );
}

// ─── Not available callout ─────────────────────────────────────────────────────
function NotAvailable({ reason, action }: { reason: string; action?: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-50/80 px-3 py-2.5 dark:bg-slate-800/50">
      <Info size={13} className="mt-0.5 shrink-0 text-slate-400" />
      <div>
        <p className="text-[11px] text-secondary">{reason}</p>
        {action && <p className="mt-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">{action}</p>}
      </div>
    </div>
  );
}

// ─── Severity helpers ─────────────────────────────────────────────────────────

function overjetSeverity(v: number): Severity {
  if (v < 0)   return "severe";   // crossbite
  if (v <= 3)  return "normal";
  if (v <= 5)  return "mild";
  if (v <= 8)  return "moderate";
  return "severe";
}

function overbiteSeverity(v: number): Severity {
  if (v < 0)   return "severe";   // open bite
  if (v <= 3)  return "normal";
  if (v <= 5)  return "mild";
  if (v <= 7)  return "moderate";
  return "severe";
}

function crowdingSeverity(v: number): Severity {
  if (v > 0)    return "normal";  // spacing
  if (v >= -4)  return "mild";
  if (v >= -8)  return "moderate";
  return "severe";
}

function anbSeverity(v: number): Severity {
  if (v >= 0 && v <= 4) return "normal";
  if (v > 4 && v <= 6)  return "mild";
  if (v > 6 && v <= 9)  return "moderate";
  if (v < 0 && v >= -2) return "mild";
  if (v < -2 && v >= -4) return "moderate";
  return "severe";
}

function fmaSeverity(v: number): Severity {
  if (v >= 22 && v <= 28) return "normal";
  if ((v >= 20 && v < 22) || (v > 28 && v <= 30)) return "mild";
  if ((v >= 17 && v < 20) || (v > 30 && v <= 35)) return "moderate";
  return "severe";
}

function curveOfSpeeSeverity(v: number): Severity {
  if (v <= 2)  return "normal";
  if (v <= 3)  return "mild";
  if (v <= 5)  return "moderate";
  return "severe";
}

function boltonSeverity(value: number, low: number, high: number): Severity {
  const mid = (low + high) / 2;
  const range = (high - low) / 2;
  const deviation = Math.abs(value - mid) / range;
  if (value >= low && value <= high) return "normal";
  if (deviation <= 1.5) return "mild";
  if (deviation <= 2.5) return "moderate";
  return "severe";
}

function transverseSeverity(v: number): Severity {
  const abs = Math.abs(v);
  if (abs <= 1) return "normal";
  if (abs <= 2) return "mild";
  if (abs <= 4) return "moderate";
  return "severe";
}

// ─── Aggregate data fetch ──────────────────────────────────────────────────────
interface ExamData {
  analysis: CaseAnalysis | null;
  deepAnalysis: DeepAnalysis | null;
  occlusion: OcclusionAnalysis | null;
  ceph: CephAnalysis | null;
  aiScores: AiScores | null;
}

async function fetchDeepAnalysis(caseId: string): Promise<DeepAnalysis | null> {
  const res = await fetch(`/api/clinical-analysis-deep?caseId=${encodeURIComponent(caseId)}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) return null;
  const arr = await res.json() as DeepAnalysis[];
  return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ClinicalExaminationDashboard({ caseId }: { caseId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExamData>({ analysis: null, deepAnalysis: null, occlusion: null, ceph: null, aiScores: null });
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    const errs: string[] = [];

    const [analysisR, deepR, occlusionR, cephR, scoresR] = await Promise.allSettled([
      getLatestAnalysis(caseId),
      fetchDeepAnalysis(caseId),
      listOcclusionAnalyses(caseId).then(arr => arr.length > 0 ? arr[0] : null),
      listCephAnalyses(caseId).then(arr => arr.length > 0 ? arr[0] : null),
      getAiScores(caseId),
    ]);

    if (analysisR.status === "rejected") errs.push(`Analysis: ${(analysisR.reason as Error).message}`);
    if (cephR.status === "rejected")     errs.push(`Cephalometric: ${(cephR.reason as Error).message}`);
    if (scoresR.status === "rejected")   errs.push(`AI scores: ${(scoresR.reason as Error).message}`);

    setData({
      analysis:     analysisR.status === "fulfilled" ? analysisR.value : null,
      deepAnalysis: deepR.status === "fulfilled"     ? deepR.value     : null,
      occlusion:    occlusionR.status === "fulfilled" ? occlusionR.value : null,
      ceph:         cephR.status === "fulfilled"      ? cephR.value     : null,
      aiScores:     scoresR.status === "fulfilled"    ? scoresR.value   : null,
    });

    setErrors(errs);
    setLoading(false);
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1,2,3,4,5,6,7].map(i => (
          <div key={i} className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="space-y-2">
              <div className="h-3 rounded bg-slate-100 dark:bg-slate-800" />
              <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const { analysis, deepAnalysis, occlusion, ceph, aiScores } = data;
  const m = ceph?.measurements ?? {};

  // Prefer deep analysis values where available, fall back to basic analysis
  const overjet = deepAnalysis?.overjet_mm ?? analysis?.overjetMm ?? occlusion?.overjetMm ?? null;
  const overbite = deepAnalysis?.overbite_mm ?? analysis?.overbiteM ?? occlusion?.overbitemm ?? null;
  const crowdingUpper = deepAnalysis?.crowding_upper_mm ?? analysis?.upperCrowdingMm ?? occlusion?.crowdingUpperMm ?? null;
  const crowdingLower = deepAnalysis?.crowding_lower_mm ?? analysis?.lowerCrowdingMm ?? occlusion?.crowdingLowerMm ?? null;
  const midlineDeviation = deepAnalysis?.midline_deviation_mm ?? occlusion?.midlineShiftMm ?? null;
  const curveOfSpee = deepAnalysis?.curve_of_spee_mm ?? null;
  const angleClass = deepAnalysis?.angle_class ?? analysis?.angleClass ?? occlusion?.angleClass ?? null;
  const boltonOverall = analysis?.boltonOverall ?? (deepAnalysis ? deepAnalysis.bolton_overall_ratio : null);
  const boltonAnterior = analysis?.boltonAnterior ?? (deepAnalysis ? deepAnalysis.bolton_anterior_ratio : null);
  const crossbiteTeeth = occlusion?.crossbiteTeeth ?? [];
  const openBiteTeeth = occlusion?.openBiteTeeth ?? [];
  const transverseDiscrepancy = deepAnalysis?.transverse_discrepancy_mm ?? null;

  // Data confidence
  const clinicalConfidence = deepAnalysis ? deepAnalysis.confidence : null;

  return (
    <div className="space-y-4">
      <ClinicalWarningBanner message="AI-assisted clinical analysis only. All findings require review and confirmation by a licensed orthodontist before clinical use." />

      {errors.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-xs text-amber-700 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-400">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Some data sources unavailable</p>
            {errors.map((e, i) => <p key={i} className="opacity-80">{e}</p>)}
          </div>
        </div>
      )}

      {/* ── Section 1: Skeletal Analysis ────────────────────────────────────── */}
      <Section
        title="Skeletal Analysis"
        subtitle="Cephalometric measurements — lateral radiograph required"
        badge={ceph ? <Badge label={`Skeletal Class ${ceph.skeletalClass ?? "?"}`} color={ceph.skeletalClass === "I" ? "green" : ceph.skeletalClass === "II" ? "orange" : "red"} /> : <Badge label="Not performed" color="slate" />}
      >
        {!ceph ? (
          <NotAvailable
            reason="Cephalometric analysis has not been performed for this case."
            action="Requires lateral cephalometric radiograph. Upload and run ceph analysis to populate skeletal measurements."
          />
        ) : (
          <div>
            <MetricRow
              label="SNA"
              value={m.snaDeg ?? null}
              unit="°"
              normalRange="80–84°"
              severity={m.snaDeg !== undefined && m.snaDeg !== null ? (m.snaDeg >= 80 && m.snaDeg <= 84 ? "normal" : Math.abs(m.snaDeg - 82) <= 3 ? "mild" : "moderate") : "not_computed"}
              explanation="SNA measures the antero-posterior position of the maxilla relative to the cranial base. Increased SNA indicates maxillary prognathism; decreased SNA indicates maxillary retrognathism."
              confidence={clinicalConfidence}
              dataSource="Lateral cephalometric radiograph"
              evidence="Steiner 1953"
            />
            <MetricRow
              label="SNB"
              value={m.snbDeg ?? null}
              unit="°"
              normalRange="78–82°"
              severity={m.snbDeg !== undefined && m.snbDeg !== null ? (m.snbDeg >= 78 && m.snbDeg <= 82 ? "normal" : Math.abs(m.snbDeg - 80) <= 3 ? "mild" : "moderate") : "not_computed"}
              explanation="SNB measures the antero-posterior position of the mandible. Increased SNB indicates mandibular prognathism; decreased SNB indicates mandibular retrognathism."
              confidence={clinicalConfidence}
              dataSource="Lateral cephalometric radiograph"
              evidence="Steiner 1953"
            />
            <MetricRow
              label="ANB"
              value={m.anbDeg ?? null}
              unit="°"
              normalRange="0–4°"
              severity={m.anbDeg !== undefined && m.anbDeg !== null ? anbSeverity(m.anbDeg) : "not_computed"}
              explanation="ANB is the difference between SNA and SNB angles. It indicates the sagittal relationship between the maxilla and mandible. Class I: 0–4°, Class II: >4°, Class III: <0°."
              confidence={clinicalConfidence}
              dataSource="Lateral cephalometric radiograph"
              evidence="Riedel 1952"
            />
            <MetricRow
              label="Wits Appraisal"
              value={m.witsMm ?? null}
              unit=" mm"
              normalRange="−1 to +3 mm (females: −1 to +2 mm)"
              severity={m.witsMm !== undefined && m.witsMm !== null ? (m.witsMm >= -1 && m.witsMm <= 3 ? "normal" : Math.abs(m.witsMm - 1) <= 3 ? "mild" : "severe") : "not_computed"}
              explanation="Wits appraisal measures the A-B discrepancy on the functional occlusal plane. It supplements ANB in assessing sagittal jaw relationships, especially when the sella-nasion plane is atypical."
              confidence={clinicalConfidence}
              dataSource="Lateral cephalometric radiograph"
              evidence="Jacobson 1975"
            />
            <MetricRow
              label="FMA (Frankfort-Mandibular Plane)"
              value={m.fmaDeg ?? null}
              unit="°"
              normalRange="22–28°"
              severity={m.fmaDeg !== undefined && m.fmaDeg !== null ? fmaSeverity(m.fmaDeg) : "not_computed"}
              explanation="FMA measures the angle between the Frankfort Horizontal and the mandibular plane. <22° = hypodivergent (deep bite tendency), 22–28° = normodivergent, >28° = hyperdivergent (open bite tendency)."
              confidence={clinicalConfidence}
              dataSource="Lateral cephalometric radiograph"
              evidence="Tweed 1953"
            />
            <MetricRow
              label="IMPA (Incisor-Mandibular Plane)"
              value={m.impaDeg ?? null}
              unit="°"
              normalRange="87–95°"
              severity={m.impaDeg !== undefined && m.impaDeg !== null ? (m.impaDeg >= 87 && m.impaDeg <= 95 ? "normal" : Math.abs(m.impaDeg - 91) <= 5 ? "mild" : "moderate") : "not_computed"}
              explanation="IMPA measures the axial inclination of the lower incisor to the mandibular plane. Values outside the normal range indicate incisor flaring or retroclination."
              confidence={clinicalConfidence}
              dataSource="Lateral cephalometric radiograph"
              evidence="Tweed 1953"
            />
            <MetricRow
              label="FMIA (Frankfort-Mandibular Incisor)"
              value={m.fmiaDeg ?? null}
              unit="°"
              normalRange="65–70°"
              severity={m.fmiaDeg !== undefined && m.fmiaDeg !== null ? (m.fmiaDeg >= 65 && m.fmiaDeg <= 70 ? "normal" : Math.abs(m.fmiaDeg - 67.5) <= 5 ? "mild" : "moderate") : "not_computed"}
              explanation="FMIA is the angle between the Frankfort Horizontal and the long axis of the lower incisor. It completes the Tweed Triangle with FMA and IMPA."
              confidence={clinicalConfidence}
              dataSource="Lateral cephalometric radiograph"
              evidence="Tweed 1953"
            />
            {m.interincisalDeg !== undefined && m.interincisalDeg !== null && (
              <MetricRow
                label="Interincisal Angle"
                value={m.interincisalDeg}
                unit="°"
                normalRange="125–135°"
                severity={m.interincisalDeg >= 125 && m.interincisalDeg <= 135 ? "normal" : Math.abs(m.interincisalDeg - 130) <= 10 ? "mild" : "moderate"}
                explanation="The angle between the long axes of upper and lower central incisors. Decreased angle indicates bimaxillary proclination; increased angle indicates retroclination."
                confidence={clinicalConfidence}
                dataSource="Lateral cephalometric radiograph"
                evidence="Jacobson 1995"
              />
            )}
            <div className="mt-3 pt-2 flex gap-4 text-[10px] text-secondary">
              <span>Skeletal class: <strong className="text-foreground">{ceph.skeletalClass ? `Class ${ceph.skeletalClass}` : "Not classified"}</strong></span>
              <span>Vertical: <strong className="text-foreground">{ceph.verticalPattern ?? "Not classified"}</strong></span>
              <span>Growth: <strong className="text-foreground">{ceph.growthPattern ?? "Not classified"}</strong></span>
            </div>
          </div>
        )}
      </Section>

      {/* ── Section 2: Dental Occlusion ─────────────────────────────────────── */}
      <Section
        title="Dental Occlusion"
        subtitle="Angle classification, overjet, overbite, arch relationships"
        badge={angleClass ? <Badge label={angleClass} color={angleClass.startsWith("Class I") && !angleClass.startsWith("Class II") && !angleClass.startsWith("Class III") ? "green" : angleClass.startsWith("Class III") ? "red" : "orange"} /> : <Badge label="Not recorded" color="slate" />}
      >
        <MetricRow
          label="Angle Classification"
          value={angleClass}
          normalRange="Class I"
          severity={!angleClass ? "not_computed" : angleClass.startsWith("Class I") && !angleClass.startsWith("Class II") && !angleClass.startsWith("Class III") ? "normal" : angleClass.startsWith("Class III") ? "severe" : "moderate"}
          explanation="Angle's classification describes the antero-posterior molar relationship. Class I: normal; Class II: mandibular first molar distal to maxillary; Class III: mandibular molar mesial to maxillary."
          confidence={null}
          dataSource="Clinical examination — clinician-entered"
          evidence="Angle 1899"
        />
        <MetricRow
          label="Overjet"
          value={overjet}
          unit=" mm"
          normalRange="0–3 mm"
          severity={overjet !== null ? overjetSeverity(overjet) : "not_computed"}
          explanation="Horizontal overlap of upper incisors beyond lower incisors. Normal 0–3 mm. Negative value indicates an anterior crossbite. >6 mm indicates increased overjet requiring correction."
          confidence={clinicalConfidence}
          dataSource={deepAnalysis?.measurement_source?.overjet_mm ?? "Clinical examination"}
          evidence="Proffit 2018"
        />
        <MetricRow
          label="Overbite"
          value={overbite}
          unit=" mm"
          normalRange="0–3 mm"
          severity={overbite !== null ? overbiteSeverity(overbite) : "not_computed"}
          explanation="Vertical overlap of upper incisors over lower incisors. 0–3 mm = normal, >3 mm = deep bite, <0 mm = open bite. Deep bite may require intrusion mechanics."
          confidence={clinicalConfidence}
          dataSource={deepAnalysis?.measurement_source?.overbite_mm ?? "Clinical examination"}
          evidence="Proffit 2018"
        />
        {deepAnalysis?.molar_relationship_right && (
          <MetricRow
            label="Molar Relationship (Right)"
            value={deepAnalysis.molar_relationship_right}
            normalRange="Class I"
            severity={deepAnalysis.molar_relationship_right.includes("I") && !deepAnalysis.molar_relationship_right.includes("II") && !deepAnalysis.molar_relationship_right.includes("III") ? "normal" : deepAnalysis.molar_relationship_right.includes("III") ? "severe" : "moderate"}
            explanation="Right first molar antero-posterior relationship classification."
            confidence={clinicalConfidence}
            dataSource="Clinical examination"
          />
        )}
        {deepAnalysis?.molar_relationship_left && (
          <MetricRow
            label="Molar Relationship (Left)"
            value={deepAnalysis.molar_relationship_left}
            normalRange="Class I"
            severity={deepAnalysis.molar_relationship_left.includes("I") && !deepAnalysis.molar_relationship_left.includes("II") && !deepAnalysis.molar_relationship_left.includes("III") ? "normal" : deepAnalysis.molar_relationship_left.includes("III") ? "severe" : "moderate"}
            explanation="Left first molar antero-posterior relationship classification."
            confidence={clinicalConfidence}
            dataSource="Clinical examination"
          />
        )}
        {deepAnalysis?.canine_relationship_right && (
          <MetricRow
            label="Canine Relationship (Right)"
            value={deepAnalysis.canine_relationship_right}
            normalRange="Class I"
            severity={deepAnalysis.canine_relationship_right.includes("I") && !deepAnalysis.canine_relationship_right.includes("II") && !deepAnalysis.canine_relationship_right.includes("III") ? "normal" : "moderate"}
            explanation="Right canine antero-posterior relationship classification."
            confidence={clinicalConfidence}
            dataSource="Clinical examination"
          />
        )}
        {deepAnalysis?.canine_relationship_left && (
          <MetricRow
            label="Canine Relationship (Left)"
            value={deepAnalysis.canine_relationship_left}
            normalRange="Class I"
            severity={deepAnalysis.canine_relationship_left.includes("I") && !deepAnalysis.canine_relationship_left.includes("II") && !deepAnalysis.canine_relationship_left.includes("III") ? "normal" : "moderate"}
            explanation="Left canine antero-posterior relationship classification."
            confidence={clinicalConfidence}
            dataSource="Clinical examination"
          />
        )}
        {occlusion?.tmjFindings && (
          <div className="py-2 text-xs border-b border-border/50">
            <span className="text-secondary">TMJ Findings: </span>
            <span className="text-foreground">{occlusion.tmjFindings}</span>
          </div>
        )}
      </Section>

      {/* ── Section 3: Arch Space Analysis ──────────────────────────────────── */}
      <Section
        title="Arch Space Analysis"
        subtitle="Crowding, spacing, arch length discrepancy, Curve of Spee"
      >
        {(crowdingUpper === null && crowdingLower === null && curveOfSpee === null) ? (
          <NotAvailable
            reason="Arch space measurements not available for this case."
            action="Enter arch length measurements and crowding values via Clinical Analysis to populate this section."
          />
        ) : (
          <>
            <MetricRow
              label="Upper Arch Crowding/Spacing"
              value={crowdingUpper}
              unit=" mm"
              normalRange="0 mm (ideal alignment)"
              severity={crowdingUpper !== null ? crowdingSeverity(crowdingUpper) : "not_computed"}
              explanation="Positive values indicate spacing; negative values indicate crowding (insufficient arch length). Mild crowding: 0 to −4 mm; Moderate: −4 to −8 mm; Severe: > −8 mm."
              confidence={clinicalConfidence}
              dataSource={deepAnalysis?.measurement_source?.crowding_upper_mm ?? "Clinical examination / arch perimeter analysis"}
              evidence="Little 1975, Proffit 2018"
            />
            <MetricRow
              label="Lower Arch Crowding/Spacing"
              value={crowdingLower}
              unit=" mm"
              normalRange="0 mm (ideal alignment)"
              severity={crowdingLower !== null ? crowdingSeverity(crowdingLower) : "not_computed"}
              explanation="Positive values indicate spacing; negative values indicate crowding. Crowding severity determines extraction vs non-extraction decision and space management strategy."
              confidence={clinicalConfidence}
              dataSource={deepAnalysis?.measurement_source?.crowding_lower_mm ?? "Clinical examination / arch perimeter analysis"}
              evidence="Little 1975, Proffit 2018"
            />
            {deepAnalysis?.arch_length_discrepancy_mm !== null && deepAnalysis?.arch_length_discrepancy_mm !== undefined && (
              <MetricRow
                label="Arch Length Discrepancy"
                value={deepAnalysis.arch_length_discrepancy_mm}
                unit=" mm"
                normalRange="0 mm"
                severity={deepAnalysis.arch_length_discrepancy_mm !== null ? crowdingSeverity(deepAnalysis.arch_length_discrepancy_mm) : "not_computed"}
                explanation="Total arch length discrepancy = (tooth material sum) − (available arch length). Negative = crowding. Used to determine space requirements and treatment approach."
                confidence={clinicalConfidence}
                dataSource="Digital model analysis"
                evidence="Moyers 1988"
              />
            )}
            <MetricRow
              label="Curve of Spee"
              value={curveOfSpee}
              unit=" mm"
              normalRange="≤ 2 mm"
              severity={curveOfSpee !== null ? curveOfSpeeSeverity(curveOfSpee) : "not_computed"}
              explanation="Depth of Curve of Spee from the condyle. Each 1 mm of curve requires approximately 0.5 mm of arch length to level. >2 mm requires active leveling in treatment planning."
              confidence={clinicalConfidence}
              dataSource={deepAnalysis?.measurement_source?.curve_of_spee_mm ?? "Clinical measurement"}
              evidence="Braun et al. 1996"
            />
            {midlineDeviation !== null && (
              <MetricRow
                label="Midline Deviation"
                value={midlineDeviation}
                unit=" mm"
                normalRange="0 mm (coincident midlines)"
                severity={Math.abs(midlineDeviation) <= 1 ? "normal" : Math.abs(midlineDeviation) <= 2 ? "mild" : Math.abs(midlineDeviation) <= 4 ? "moderate" : "severe"}
                explanation={`Upper midline is deviated ${midlineDeviation > 0 ? "left" : "right"} ${Math.abs(midlineDeviation).toFixed(1)} mm from the facial midline. Deviations >2 mm are clinically significant.`}
                confidence={clinicalConfidence}
                dataSource={deepAnalysis?.measurement_source?.midline_deviation_mm ?? "Clinical examination"}
              />
            )}
            {(deepAnalysis?.upper_arch_width_mm !== null && deepAnalysis?.upper_arch_width_mm !== undefined) && (
              <MetricRow
                label="Upper Arch Width (inter-molar)"
                value={deepAnalysis.upper_arch_width_mm}
                unit=" mm"
                normalRange="50–55 mm (varies by age and sex)"
                severity={deepAnalysis.upper_arch_width_mm !== null && deepAnalysis.upper_arch_width_mm >= 46 && deepAnalysis.upper_arch_width_mm <= 58 ? "normal" : "mild"}
                explanation="Inter-molar width measured at upper first molar. Used with lower arch width to assess transverse discrepancy and expansion need."
                confidence={clinicalConfidence}
                dataSource="Digital model measurement"
              />
            )}
            {transverseDiscrepancy !== null && (
              <MetricRow
                label="Transverse Discrepancy"
                value={transverseDiscrepancy}
                unit=" mm"
                normalRange="≤ 1 mm"
                severity={transverseSeverity(transverseDiscrepancy)}
                explanation="Difference in upper vs lower inter-molar widths corrected for Bolton arch width norms. Positive values indicate upper arch narrowing relative to lower (potential crossbite)."
                confidence={clinicalConfidence}
                dataSource="Digital model analysis"
                evidence="Mew 1977"
              />
            )}
          </>
        )}
      </Section>

      {/* ── Section 4: Bolton Analysis ───────────────────────────────────────── */}
      <Section
        title="Bolton Analysis"
        subtitle="Tooth-size discrepancy analysis (Bolton 1958)"
      >
        {(boltonOverall === null && boltonAnterior === null) ? (
          <NotAvailable
            reason="Bolton analysis requires mesio-distal tooth width measurements."
            action="Enter individual tooth widths in the Clinical Analysis panel to compute Bolton ratios."
          />
        ) : (
          <>
            <MetricRow
              label="Overall Ratio (12:12)"
              value={boltonOverall}
              unit="%"
              normalRange="89.4–93.2% (norm 91.3% ± 1.91 SD)"
              severity={boltonOverall !== null ? boltonSeverity(boltonOverall, 89.4, 93.2) : "not_computed"}
              explanation="Ratio of summed mandibular to maxillary tooth widths (all 12 teeth). Values outside 89.4–93.2% indicate tooth size discrepancy requiring IPR or composite additions."
              confidence={clinicalConfidence}
              dataSource="Mesio-distal tooth width measurements"
              evidence="Bolton 1958"
            />
            <MetricRow
              label="Anterior Ratio (6:6)"
              value={boltonAnterior}
              unit="%"
              normalRange="74.9–79.5% (norm 77.2% ± 1.65 SD)"
              severity={boltonAnterior !== null ? boltonSeverity(boltonAnterior, 74.9, 79.5) : "not_computed"}
              explanation="Ratio of summed mandibular to maxillary anterior tooth widths (6 teeth). Mandibular excess: anterior crossbite or diastema. Maxillary excess: overjet or anterior spacing."
              confidence={clinicalConfidence}
              dataSource="Mesio-distal tooth width measurements"
              evidence="Bolton 1958"
            />
            {analysis?.boltonOverall !== null && analysis?.boltonOverall !== undefined && (
              <p className="mt-2 text-[10px] text-secondary">
                Norms: Overall 91.3% ± 1.91 SD; Anterior 77.2% ± 1.65 SD. Source: Bolton 1958 / 1962. Reference only — requires clinician confirmation.
              </p>
            )}
          </>
        )}
      </Section>

      {/* ── Section 5: Special Occlusal Findings ────────────────────────────── */}
      <Section
        title="Special Occlusal Findings"
        subtitle="Crossbite, open bite, deep bite — by tooth (FDI notation)"
      >
        {!occlusion ? (
          <NotAvailable
            reason="Occlusion analysis has not been recorded for this case."
            action="Run an occlusion analysis or enter occlusal findings to identify crossbite and open bite locations."
          />
        ) : (
          <>
            <ToothListRow label="Crossbite (FDI teeth)" teeth={crossbiteTeeth} />
            <ToothListRow label="Open Bite (FDI teeth)" teeth={openBiteTeeth} />
            <MetricRow
              label="Deep Bite"
              value={overbite}
              unit=" mm"
              normalRange="0–3 mm"
              severity={overbite !== null ? (overbite > 3 ? (overbite > 5 ? "severe" : "moderate") : "normal") : "not_computed"}
              explanation="Overbite >3 mm constitutes a deep bite. Deep bite correction typically requires intrusion of lower incisors and/or extrusion of posterior teeth, adding arc length demand."
              confidence={clinicalConfidence}
              dataSource={deepAnalysis?.measurement_source?.overbite_mm ?? "Clinical examination"}
            />
            {occlusion.notes && (
              <div className="pt-2 text-[11px] text-secondary">
                <span className="font-medium">Clinical notes: </span>{occlusion.notes}
              </div>
            )}
          </>
        )}
      </Section>

      {/* ── Section 6: Soft Tissue Profile ──────────────────────────────────── */}
      <Section
        title="Soft Tissue Profile"
        subtitle="Requires cephalometric analysis with soft tissue landmarks"
      >
        {(!ceph || !m.softTissue || Object.keys(m.softTissue ?? {}).length === 0) ? (
          <NotAvailable
            reason="Soft tissue cephalometric measurements not available."
            action="Soft tissue analysis requires landmarks traced on a lateral cephalometric radiograph with soft tissue visible."
          />
        ) : (
          <div className="space-y-1 text-xs">
            {Object.entries(m.softTissue ?? {}).map(([key, val]) => (
              <div key={key} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-secondary capitalize">{key.replace(/_/g, " ")}</span>
                <span className="tabular-nums font-semibold text-foreground">{typeof val === "number" ? val.toFixed(1) : String(val)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── Section 7: Case Complexity & Risk ───────────────────────────────── */}
      <Section
        title="Case Complexity & Risk Assessment"
        subtitle="AI-derived complexity metrics — requires clinical confirmation"
      >
        {!aiScores ? (
          <NotAvailable
            reason="AI complexity scores not available. A treatment plan with movement data is required."
            action="Generate or import a treatment plan to compute complexity, refinement probability, and risk scores."
          />
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-slate-50/60 p-3 dark:bg-slate-800/40">
                <p className="text-[10px] font-medium text-secondary uppercase tracking-wide">Success Confidence</p>
                <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{aiScores.successConfidence.toFixed(0)}%</p>
                <ConfidenceBar confidence={aiScores.successConfidence / 100} />
              </div>
              <div className="rounded-lg border border-border bg-slate-50/60 p-3 dark:bg-slate-800/40">
                <p className="text-[10px] font-medium text-secondary uppercase tracking-wide">Refinement Probability</p>
                <p className="mt-1 text-2xl font-bold text-foreground tabular-nums">{(aiScores.refinementProbability * 100).toFixed(0)}%</p>
                <ConfidenceBar confidence={aiScores.refinementProbability} />
              </div>
            </div>
            <MetricRow
              label="Clinical Risk Score"
              value={aiScores.clinicalRiskScore}
              normalRange="0–30 (lower is better)"
              severity={aiScores.clinicalRiskScore <= 30 ? "normal" : aiScores.clinicalRiskScore <= 50 ? "mild" : aiScores.clinicalRiskScore <= 70 ? "moderate" : "severe"}
              explanation="Composite risk score derived from collision count, unsafe IPR, PDL stress, and treatment quality warnings. Higher scores require greater clinician oversight."
              confidence={null}
              dataSource="AI movement analysis"
            />
            <MetricRow
              label="Anchorage Demand"
              value={aiScores.anchorageLevel}
              normalRange="Low"
              severity={aiScores.anchorageLevel === "low" ? "normal" : aiScores.anchorageLevel === "medium" ? "mild" : "moderate"}
              explanation="Anchorage demand derived from maximum planned translation (>4 mm = high) and torque (>20° = high). High anchorage demand may require TADs or Class II/III elastics."
              confidence={null}
              dataSource="AI movement analysis"
            />
            {aiScores.estimatedDurationMonths !== null && (
              <MetricRow
                label="Estimated Treatment Duration"
                value={aiScores.estimatedDurationMonths}
                unit=" months"
                normalRange="12–24 months"
                severity={aiScores.estimatedDurationMonths !== null ? (aiScores.estimatedDurationMonths <= 24 ? "normal" : aiScores.estimatedDurationMonths <= 36 ? "mild" : "moderate") : "not_computed"}
                explanation="Estimated treatment duration based on planned movement complexity, number of stages, and refinement probability. Actual duration varies with patient compliance."
                confidence={null}
                dataSource="AI staging analysis"
              />
            )}
            <div className="mt-2 pt-2 grid grid-cols-3 gap-2 text-center text-[10px]">
              <div>
                <p className="text-secondary">Collisions</p>
                <p className="font-bold text-foreground tabular-nums">{aiScores.collisionCount}</p>
              </div>
              <div>
                <p className="text-secondary">Unsafe IPR</p>
                <p className="font-bold text-foreground tabular-nums">{aiScores.unsafeIprCount}</p>
              </div>
              <div>
                <p className="text-secondary">Refinement Cycles</p>
                <p className="font-bold text-foreground tabular-nums">{aiScores.refinementCycleCount}</p>
              </div>
            </div>
          </>
        )}
      </Section>

      {/* ── Refresh ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-secondary max-w-sm">
          All clinical measurements require verification by a licensed orthodontist.
          AI-computed values are estimates based on available digital data.
        </p>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>
    </div>
  );
}
