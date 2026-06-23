"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cpu,
  Eye,
  FlaskConical,
  Ruler,
  ScanLine,
  Shield,
  Stethoscope,
  Target,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

type Maturity = "implemented" | "simulated" | "planned";
type RiskLevel = "low" | "medium" | "high" | "critical";

interface AiCapability {
  id: string;
  name: string;
  category: string;
  maturity: Maturity;
  clinicalUseCase: string;
  requiredData: string[];
  humanReviewRequired: string;
  riskLevel: RiskLevel;
  regulatoryNote: string;
  decisionSupportOnly: true; // every AI feature is decision support, never replacement
}

// ─── Maturity metadata ────────────────────────────────────────────────────────

const MATURITY_META: Record<Maturity, { label: string; tone: "success" | "info" | "neutral"; icon: LucideIcon; description: string }> = {
  implemented: { label: "Implemented",  tone: "success",  icon: CheckCircle2,  description: "Working feature in the app today." },
  simulated:   { label: "Simulated",    tone: "info",     icon: FlaskConical,  description: "Realistic UI with representative data; not a validated clinical engine." },
  planned:     { label: "Planned",      tone: "neutral",  icon: Clock,         description: "Architecture and data model defined; feature not yet built." },
};

const RISK_META: Record<RiskLevel, { label: string; className: string }> = {
  low:      { label: "Low",      className: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200/60 dark:border-emerald-500/20" },
  medium:   { label: "Medium",   className: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-200/60 dark:border-blue-500/20" },
  high:     { label: "High",     className: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200/60 dark:border-amber-500/20" },
  critical: { label: "Critical", className: "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border-rose-200/60 dark:border-rose-500/20" },
};

// ─── AI capability registry ───────────────────────────────────────────────────

const AI_CAPABILITIES: AiCapability[] = [
  // 1. Scan intake
  {
    id: "scan-intake",
    name: "Scan Intake & Validation",
    category: "Scan Intake",
    maturity: "implemented",
    clinicalUseCase: "Import and validate intraoral scan files (STL, PLY, OBJ) for completeness before processing.",
    requiredData: ["STL, PLY, or OBJ file", "Arch type (upper/lower)"],
    humanReviewRequired: "Clinician confirms scan quality and completeness before proceeding.",
    riskLevel: "low",
    regulatoryNote: "File import and validation only. No clinical inference is made during intake.",
    decisionSupportOnly: true,
  },
  {
    id: "scan-quality",
    name: "Scan Quality Assessment",
    category: "Scan Intake",
    maturity: "simulated",
    clinicalUseCase: "Flag scans with insufficient coverage, noise, or missing anatomy before processing begins.",
    requiredData: ["Imported scan mesh", "Coverage threshold parameters"],
    humanReviewRequired: "Clinician reviews flagged areas and decides whether to re-scan or proceed.",
    riskLevel: "medium",
    regulatoryNote: "Decision support only. Clinician makes the final determination on scan acceptability.",
    decisionSupportOnly: true,
  },
  // 2. Landmark detection
  {
    id: "landmark-detection",
    name: "Dental Landmark Detection",
    category: "Landmark Detection",
    maturity: "planned",
    clinicalUseCase: "Automatically identify cusp tips, contact points, and cephalometric reference points on digital models.",
    requiredData: ["Segmented dental model", "Arch orientation"],
    humanReviewRequired: "Every detected landmark must be reviewed and corrected by a trained clinician before use in measurements or planning.",
    riskLevel: "high",
    regulatoryNote: "Automated landmark detection is decision support only. Landmark accuracy directly impacts measurement validity and treatment outcomes.",
    decisionSupportOnly: true,
  },
  {
    id: "cephalometric-analysis",
    name: "Cephalometric Analysis",
    category: "Landmark Detection",
    maturity: "planned",
    clinicalUseCase: "Compute skeletal and dental relationships from CBCT or lateral cephalogram data.",
    requiredData: ["CBCT or cephalogram", "Landmark positions"],
    humanReviewRequired: "Orthodontist must verify all cephalometric values before use in diagnosis or treatment planning.",
    riskLevel: "high",
    regulatoryNote: "Not a diagnostic substitute. Values require clinical interpretation by a qualified orthodontist.",
    decisionSupportOnly: true,
  },
  // 3. Tooth segmentation
  {
    id: "tooth-segmentation",
    name: "Automated Tooth Segmentation",
    category: "Tooth Segmentation",
    maturity: "planned",
    clinicalUseCase: "Isolate individual teeth from a full-arch intraoral scan for per-tooth movement planning.",
    requiredData: ["Full-arch intraoral scan (STL)", "Arch type"],
    humanReviewRequired: "Lab technician or clinician must review and correct all segmentation boundaries before proceeding to treatment planning.",
    riskLevel: "high",
    regulatoryNote: "Segmentation errors propagate to all downstream computations. Manual verification is mandatory.",
    decisionSupportOnly: true,
  },
  {
    id: "arch-analysis",
    name: "Arch Analysis",
    category: "Tooth Segmentation",
    maturity: "simulated",
    clinicalUseCase: "Compute arch width, length, intercanine and intermolar distances, and curve of Spee index.",
    requiredData: ["Segmented dental model", "Landmark positions"],
    humanReviewRequired: "Clinician verifies measurements; automated values are decision support, not a clinical record.",
    riskLevel: "medium",
    regulatoryNote: "Arch measurements assist diagnosis. Final diagnostic conclusions require clinician expertise.",
    decisionSupportOnly: true,
  },
  // 4. Root prediction
  {
    id: "root-position",
    name: "Root Position Estimation",
    category: "Root Prediction",
    maturity: "planned",
    clinicalUseCase: "Estimate root positions from crown anatomy for collision detection during movement planning.",
    requiredData: ["Segmented crown models", "Statistical root shape model"],
    humanReviewRequired: "Root estimates are statistical. CBCT confirmation is required for high-risk movements.",
    riskLevel: "critical",
    regulatoryNote: "Root estimation is not a substitute for CBCT imaging. Used as a planning aid only, with mandatory clinical validation for movements exceeding conservative biomechanical limits.",
    decisionSupportOnly: true,
  },
  {
    id: "root-resorption-risk",
    name: "Root Resorption Risk Scoring",
    category: "Root Prediction",
    maturity: "planned",
    clinicalUseCase: "Score the risk of external apical root resorption based on movement type, magnitude, and root morphology.",
    requiredData: ["Root position data", "Movement plan", "Historical resorption data"],
    humanReviewRequired: "Risk score is informational only. Orthodontist adjusts treatment based on clinical judgement.",
    riskLevel: "critical",
    regulatoryNote: "Risk prediction is based on statistical models. It is not a clinical guarantee. Human oversight is mandatory.",
    decisionSupportOnly: true,
  },
  // 5. Movement planning
  {
    id: "movement-vectors",
    name: "Tooth Movement Prescription",
    category: "Movement Planning",
    maturity: "implemented",
    clinicalUseCase: "Define per-tooth 6-DoF movement targets with PDL biomechanical limit validation.",
    requiredData: ["Segmented tooth models", "Treatment goals", "Biomechanical reference values"],
    humanReviewRequired: "All movement prescriptions require orthodontist review and approval before manufacturing release.",
    riskLevel: "high",
    regulatoryNote: "PDL limits are reference values. Clinical appropriateness depends on patient-specific factors that require orthodontist assessment.",
    decisionSupportOnly: true,
  },
  {
    id: "auto-setup",
    name: "Auto Setup Proposal",
    category: "Movement Planning",
    maturity: "planned",
    clinicalUseCase: "Generate a candidate treatment setup from diagnosis goals for orthodontist review and modification.",
    requiredData: ["Segmented models", "Landmark data", "Treatment goals"],
    humanReviewRequired: "Every auto-proposal must be reviewed, modified, and explicitly approved by the prescribing orthodontist before any clinical use.",
    riskLevel: "critical",
    regulatoryNote: "This is decision support, not autonomous treatment planning. No setup may be used clinically without explicit orthodontist prescription.",
    decisionSupportOnly: true,
  },
  // 6. Collision detection
  {
    id: "tooth-collision",
    name: "Inter-Tooth Collision Detection",
    category: "Collision Detection",
    maturity: "implemented",
    clinicalUseCase: "Detect physically impossible movements where teeth would interpenetrate during staging.",
    requiredData: ["Tooth mesh geometries", "Stage-wise movement data"],
    humanReviewRequired: "Collisions must be resolved by the treating clinician. The system flags; it does not auto-correct.",
    riskLevel: "medium",
    regulatoryNote: "Geometric collision detection. Does not account for soft tissue or biomechanical constraints not represented in the model.",
    decisionSupportOnly: true,
  },
  {
    id: "occlusal-heatmap",
    name: "Occlusal Contact Heatmap",
    category: "Collision Detection",
    maturity: "planned",
    clinicalUseCase: "Visualise occlusal load distribution across teeth at each treatment stage.",
    requiredData: ["Upper and lower arch models", "Bite registration", "Stage movement data"],
    humanReviewRequired: "Heatmap is a visualization aid. Occlusal analysis requires clinical verification with physical articulation.",
    riskLevel: "medium",
    regulatoryNote: "Digital occlusal simulation. Physical articulator verification recommended before finalizing treatment.",
    decisionSupportOnly: true,
  },
  // 7. IPR suggestion
  {
    id: "ipr-planning",
    name: "IPR Planning",
    category: "IPR Suggestion",
    maturity: "simulated",
    clinicalUseCase: "Calculate interproximal reduction amounts needed to resolve crowding without extraction.",
    requiredData: ["Bolton analysis results", "Crowding severity", "Tooth dimensions"],
    humanReviewRequired: "IPR is an irreversible procedure. All IPR prescriptions require explicit orthodontist authorization.",
    riskLevel: "high",
    regulatoryNote: "IPR planning is decision support. Amounts must be approved by the treating orthodontist before any clinical execution.",
    decisionSupportOnly: true,
  },
  {
    id: "bolton-analysis",
    name: "Bolton Analysis",
    category: "IPR Suggestion",
    maturity: "simulated",
    clinicalUseCase: "Compute anterior (6:6) and overall (12:12) tooth-width discrepancy ratios to identify excess or deficit material.",
    requiredData: ["Tooth width measurements (manual or automated)"],
    humanReviewRequired: "Tooth widths require clinician verification. Automated measurement is decision support, not a clinical record.",
    riskLevel: "medium",
    regulatoryNote: "Bolton norms are population references. Individual patient variation requires clinical interpretation.",
    decisionSupportOnly: true,
  },
  // 8. Attachment recommendation
  {
    id: "attachment-recommendation",
    name: "Attachment Recommendation",
    category: "Attachment Recommendation",
    maturity: "simulated",
    clinicalUseCase: "Suggest attachment type, position, and activation stage to achieve the prescribed tooth movement.",
    requiredData: ["Movement vectors", "Tooth geometry", "Stage count"],
    humanReviewRequired: "Attachment placement must be reviewed and approved by the prescribing orthodontist.",
    riskLevel: "medium",
    regulatoryNote: "Recommendations are based on biomechanical principles and representative clinical data. Clinician discretion governs final placement.",
    decisionSupportOnly: true,
  },
  {
    id: "refinement-prediction",
    name: "Refinement Stage Prediction",
    category: "Attachment Recommendation",
    maturity: "planned",
    clinicalUseCase: "Estimate the probability that refinement stages will be needed based on case complexity and movement profile.",
    requiredData: ["Initial treatment plan", "Case complexity metrics", "Historical outcome data"],
    humanReviewRequired: "Probability output is informational. The need for refinement is determined by clinical assessment at the time of treatment.",
    riskLevel: "medium",
    regulatoryNote: "Statistical prediction. Not a clinical guarantee. Outcome depends on patient compliance and biology.",
    decisionSupportOnly: true,
  },
  // 9. Treatment risk scoring
  {
    id: "treatment-risk",
    name: "Treatment Risk Scoring",
    category: "Treatment Risk Scoring",
    maturity: "planned",
    clinicalUseCase: "Score overall treatment complexity and identify the highest-risk movements in a proposed plan.",
    requiredData: ["Complete treatment plan", "Patient history indicators"],
    humanReviewRequired: "Risk scores are decision support. The treating orthodontist determines clinical appropriateness.",
    riskLevel: "high",
    regulatoryNote: "Risk scoring is not a clinical diagnosis. Scores based on statistical population data may not apply to individual patients.",
    decisionSupportOnly: true,
  },
  // 10. Manufacturing QC
  {
    id: "manufacturing-qc",
    name: "Manufacturing QC Check",
    category: "Manufacturing QC",
    maturity: "simulated",
    clinicalUseCase: "Validate that manufactured models are watertight, correctly labelled, and within print tolerance before thermoforming.",
    requiredData: ["Prepared manufacturing mesh", "Printer tolerance spec"],
    humanReviewRequired: "Lab technician performs physical QC after digital check. Digital check is a pre-screening step.",
    riskLevel: "low",
    regulatoryNote: "Digital QC is a pre-check. Physical inspection of manufactured parts is always required.",
    decisionSupportOnly: true,
  },
];

// ─── Group capabilities ───────────────────────────────────────────────────────

const CATEGORIES = Array.from(new Set(AI_CAPABILITIES.map(c => c.category)));

// ─── Components ───────────────────────────────────────────────────────────────

function MaturityPill({ maturity }: { maturity: Maturity }) {
  const meta = MATURITY_META[maturity];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
      meta.tone === "success" ? "border-emerald-200/60 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300" :
      meta.tone === "info"    ? "border-blue-200/60 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300" :
                                "border-[color:var(--border)] bg-[color:var(--muted)] text-[color:var(--muted-foreground)]"
    }`}>
      <Icon size={10} />
      {meta.label}
    </span>
  );
}

function CapabilityCard({ cap }: { cap: AiCapability }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]">
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-[color:var(--muted)]/40"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[color:var(--foreground)]">{cap.name}</span>
            <MaturityPill maturity={cap.maturity} />
          </div>
          <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">{cap.clinicalUseCase}</p>
        </div>
        <ChevronDown
          size={16}
          className={`mt-0.5 shrink-0 text-[color:var(--muted-foreground)] transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-[color:var(--border)] bg-[color:var(--background)] px-4 py-4 space-y-3">
          {/* Required data */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Required inputs</p>
            <ul className="space-y-1">
              {cap.requiredData.map(d => (
                <li key={d} className="flex items-start gap-1.5 text-xs text-[color:var(--foreground)]">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[color:var(--primary)]" />
                  {d}
                </li>
              ))}
            </ul>
          </div>

          {/* Human review */}
          <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
            <Eye size={12} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Human review required</p>
              <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-300">{cap.humanReviewRequired}</p>
            </div>
          </div>

          {/* Risk + regulatory row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Clinical risk</p>
              <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${RISK_META[cap.riskLevel].className}`}>
                {RISK_META[cap.riskLevel].label}
              </span>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">Role</p>
              <span className="inline-flex rounded-lg border border-[color:var(--border)] bg-[color:var(--muted)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted-foreground)]">
                Decision support
              </span>
            </div>
          </div>

          {/* Regulatory note */}
          <div className="flex items-start gap-2 rounded-xl border border-[color:var(--border)] px-3 py-2.5">
            <Shield size={12} className="mt-0.5 shrink-0 text-[color:var(--muted-foreground)]" />
            <p className="text-xs text-[color:var(--muted-foreground)]">{cap.regulatoryNote}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "Scan Intake":               ScanLine,
  "Landmark Detection":        Target,
  "Tooth Segmentation":        Cpu,
  "Root Prediction":           Ruler,
  "Movement Planning":         Stethoscope,
  "Collision Detection":       Wrench,
  "IPR Suggestion":            Ruler,
  "Attachment Recommendation": Brain,
  "Treatment Risk Scoring":    AlertTriangle,
  "Manufacturing QC":          CheckCircle2,
};

const counts = AI_CAPABILITIES.reduce((acc, c) => {
  acc[c.maturity] = (acc[c.maturity] ?? 0) + 1;
  return acc;
}, {} as Record<Maturity, number>);

export default function AIReadinessPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = activeCategory
    ? AI_CAPABILITIES.filter(c => c.category === activeCategory)
    : AI_CAPABILITIES;

  return (
    <section className="animate-page-enter mx-auto w-full max-w-3xl px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+2rem)] pt-4 sm:px-5">

      {/* Header */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">Clinical Intelligence</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">AI Readiness Center</h1>
        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
          Transparent view of what every AI capability does, its current maturity, the data it needs, and the human review it requires.
          Every AI feature in MyOrtho is <strong className="text-[color:var(--foreground)]">decision support</strong>, never a replacement for clinical judgement.
        </p>
      </div>

      {/* Policy disclaimer */}
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <Shield size={18} className="mt-0.5 shrink-0 text-[color:var(--primary)]" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">Human-in-the-loop policy</p>
          <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
            MyOrtho does not claim autonomous diagnosis, FDA clearance, or treatment automation.
            Every AI output in this platform requires explicit clinician review before any clinical action is taken.
            AI features are labelled by maturity: <strong>Implemented</strong> (working today), <strong>Simulated</strong> (representative data), or <strong>Planned</strong> (roadmap).
          </p>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {(["implemented", "simulated", "planned"] as Maturity[]).map(m => {
          const meta = MATURITY_META[m];
          const Icon = meta.icon;
          return (
            <Card key={m} className="p-4 text-center">
              <Icon size={20} className={`mx-auto mb-2 ${m === "implemented" ? "text-emerald-500" : m === "simulated" ? "text-blue-500" : "text-[color:var(--muted-foreground)]"}`} />
              <p className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">{counts[m] ?? 0}</p>
              <p className="mt-0.5 text-xs font-semibold text-[color:var(--muted-foreground)]">{meta.label}</p>
            </Card>
          );
        })}
      </div>

      {/* Category filter chips */}
      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
            activeCategory === null
              ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
              : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          }`}
        >
          All ({AI_CAPABILITIES.length})
        </button>
        {CATEGORIES.map(cat => {
          const CatIcon = CATEGORY_ICONS[cat] ?? Brain;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                  : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              }`}
            >
              <CatIcon size={11} />
              {cat}
            </button>
          );
        })}
      </div>

      {/* Capability list */}
      <div className="space-y-2.5">
        {CATEGORIES.filter(cat => !activeCategory || cat === activeCategory).map(cat => {
          const catCaps = filtered.filter(c => c.category === cat);
          if (!catCaps.length) return null;
          const CatIcon = CATEGORY_ICONS[cat] ?? Brain;
          return (
            <div key={cat}>
              <div className="mb-2 flex items-center gap-2">
                <CatIcon size={13} className="text-[color:var(--primary)]" />
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">{cat}</p>
                <span className="text-[10px] text-[color:var(--muted-foreground)]">
                  ({catCaps.length})
                </span>
              </div>
              <div className="space-y-2">
                {catCaps.map(cap => <CapabilityCard key={cap.id} cap={cap} />)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer disclaimer */}
      <div className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-2">
        <p className="text-xs font-semibold text-[color:var(--foreground)]">Regulatory disclaimer</p>
        <p className="text-xs text-[color:var(--muted-foreground)] leading-relaxed">
          MyOrtho AI capabilities are designed to support — not replace — qualified clinical professionals.
          This platform is not FDA-cleared, CE-marked, or MDR-certified as a medical device. AI outputs must be interpreted
          by a licensed orthodontist or dentist. Clinical decisions remain the responsibility of the treating practitioner.
          Maturity labels reflect current development status, not clinical validation or regulatory approval.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {["Decision support only", "Clinician review required", "Not FDA cleared", "Not CE marked"].map(tag => (
            <StatusBadge key={tag} tone="neutral">{tag}</StatusBadge>
          ))}
        </div>
      </div>
    </section>
  );
}
