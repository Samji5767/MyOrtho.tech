"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchCase, type CaseDetail } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/client";
import {
  Activity,
  ArrowLeft,
  BarChart2,
  Bot,
  Box,
  Brain,
  Camera,
  CheckSquare2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  Download,
  FileText,
  FolderX,
  GitBranch,
  Grid3X3,
  Info,
  Layers,
  Microscope,
  Move3d,
  Package,
  Ruler,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Target,
  Upload,
  UploadCloud,
  Zap,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Card, DataRow, ProgressBar, StatusBadge } from "@/components/DesignSystem";
import ClinicalWorkflow, { type CaseStatus, type WorkflowEvent } from "@/components/ClinicalWorkflow";

const ScanPanel = dynamic(() => import("@/components/ScanPanel"), { ssr: false });
const TreatmentPlansPanel = dynamic(() => import("@/components/TreatmentPlansPanel"), { ssr: false });
const ToothTransformPanel = dynamic(() => import("@/components/ToothTransformPanel"), { ssr: false });
const ClinicalAnalysisPanel = dynamic(() => import("@/components/ClinicalAnalysisPanel"), { ssr: false });
const AuditTrail = dynamic(() => import("@/components/AuditTrail"), { ssr: false });
const PatientPhotosPanel = dynamic(() => import("@/components/PatientPhotosPanel"), { ssr: false });
const CephalometricPanel = dynamic(() => import("@/components/CephalometricPanel"), { ssr: false });
const AIProposalPanel = dynamic(() => import("@/components/AIProposalPanel"), { ssr: false });
const PreExportQAPanel = dynamic(() => import("@/components/PreExportQAPanel"), { ssr: false });
const ScanProcessingPanel = dynamic(() => import("@/components/ScanProcessingPanel"), { ssr: false });
const CbctFusionPanel = dynamic(() => import("@/components/CbctFusionPanel"), { ssr: false });
const ClinicalReportsPanel = dynamic(() => import("@/components/ClinicalReportsPanel"), { ssr: false });
const ClinicalAlertsPanel = dynamic(() => import("@/components/ClinicalAlertsPanel"), { ssr: false });
const OcclusionPanel = dynamic(() => import("@/components/OcclusionPanel"), { ssr: false });
const RadiologyPanel = dynamic(() => import("@/components/RadiologyPanel"), { ssr: false });
const AttachmentPlanner = dynamic(() => import("@/components/AttachmentPlanner"), { ssr: false });
const IPRPlanner = dynamic(() => import("@/components/IPRPlanner"), { ssr: false });

const AISegmentationCenter = dynamic(
  () => import("@/components/AISegmentationCenter").then((m) => ({ default: m.AISegmentationCenter })),
  { ssr: false, loading: () => <div className="h-[400px] animate-skeleton rounded-xl" /> },
);

const TreatmentPipelinePanel = dynamic(() => import("@/components/TreatmentPipelinePanel"), { ssr: false });
const ScanValidationPanel = dynamic(() => import("@/components/ScanValidationPanel"), { ssr: false });
const ToothSegmentationPanel = dynamic(() => import("@/components/ToothSegmentationPanel"), { ssr: false });
const ClinicalAnalysisDeepPanel = dynamic(() => import("@/components/ClinicalAnalysisDeepPanel"), { ssr: false });
const TreatmentGoalsPanel = dynamic(() => import("@/components/TreatmentGoalsPanel"), { ssr: false });
const CADWorkspacePanel = dynamic(() => import("@/components/CADWorkspacePanel"), { ssr: false });
const BiomechanicsPanel = dynamic(() => import("@/components/BiomechanicsPanel"), { ssr: false });
const AIClinicalAssistantPanel = dynamic(() => import("@/components/AIClinicalAssistantPanel"), { ssr: false });
const TreatmentStagesPanel = dynamic(() => import("@/components/TreatmentStagesPanel"), { ssr: false });
const QAReportPanel = dynamic(() => import("@/components/QAReportPanel"), { ssr: false });
const AlignerPreviewPanel = dynamic(() => import("@/components/AlignerPreviewPanel"), { ssr: false });
const PrinterDownloadPanel = dynamic(() => import("@/components/PrinterDownloadPanel"), { ssr: false });
const AlignerStaging = dynamic(() => import("@/components/AlignerStaging"), { ssr: false });

// ─── Representative data keyed to case ID ─────────────────────────────────────

interface CaseProfile {
  patient: string;
  initials: string;
  accentClass: string;
  doctor: string;
  malocclusionClass: string;
  crowding: string;
  chiefComplaint: string;
  urgency: "routine" | "urgent" | "critical";
  progress: number;
  workflowStatus: CaseStatus;
  goals: string[];
  measurements: { label: string; value: string }[];
  history: WorkflowEvent[];
  scanId?: string;
  planId?: string;
}

const CASE_PROFILES: Record<string, CaseProfile> = {
  "C-2883": {
    patient: "Oliver T.", initials: "OT", accentClass: "bg-rose-500",
    doctor: "Dr. Park", malocclusionClass: "Class II Div1",
    crowding: "Severe (≥6 mm)", chiefComplaint: "Canine reposition & overjet reduction",
    urgency: "critical", progress: 45, workflowStatus: "clinical_review",
    goals: ["Reduce overjet to < 2 mm", "Canine retraction UL3/UR3", "Correct midline deviation", "Improve smile arc"],
    measurements: [
      { label: "Overjet",             value: "7.4 mm" },
      { label: "Overbite",            value: "4.1 mm" },
      { label: "Upper arch width",    value: "48.2 mm" },
      { label: "Bolton ratio (6:6)",  value: "74.8% (upper excess)" },
    ],
    history: [
      { id: "h3", timestamp: "2026-06-23 09:30", actor: "Dr. Park", actorRole: "Orthodontist", action: "Submitted for clinical review", fromStatus: "scan_review", toStatus: "clinical_review" },
      { id: "h2", timestamp: "2026-06-23 08:15", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Case submitted", fromStatus: "draft", toStatus: "scan_review" },
      { id: "h1", timestamp: "2026-06-22 16:40", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Case created", toStatus: "draft" },
    ],
  },
  "C-2847": {
    patient: "Sarah M.", initials: "SM", accentClass: "bg-amber-500",
    doctor: "Dr. Chen", malocclusionClass: "Class I",
    crowding: "Moderate (3–5 mm)", chiefComplaint: "Aligner treatment — Stage 14 approval",
    urgency: "urgent", progress: 72, workflowStatus: "approved",
    goals: ["Stage 14 of 22 alignment", "Continue upper anterior torque", "Maintain lower arch form"],
    measurements: [
      { label: "Overjet",            value: "2.8 mm" },
      { label: "Overbite",           value: "2.4 mm" },
      { label: "Upper arch width",   value: "51.6 mm" },
      { label: "Bolton ratio (6:6)", value: "77.0% (within norm)" },
    ],
    history: [
      { id: "h4", timestamp: "2026-06-23 10:05", actor: "Dr. Lee", actorRole: "Clinical Director", action: "Approved", fromStatus: "clinical_review", toStatus: "approved" },
      { id: "h3", timestamp: "2026-06-23 08:45", actor: "Dr. Chen", actorRole: "Orthodontist", action: "Submitted for clinical review", fromStatus: "scan_review", toStatus: "clinical_review" },
      { id: "h2", timestamp: "2026-06-22 14:30", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Case submitted", fromStatus: "draft", toStatus: "scan_review" },
      { id: "h1", timestamp: "2026-06-20 09:00", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Case created", toStatus: "draft" },
    ],
  },
  "C-2876": {
    patient: "Emma K.", initials: "EK", accentClass: "bg-violet-500",
    doctor: "Dr. Chen", malocclusionClass: "Class I",
    crowding: "Mild (1–3 mm)", chiefComplaint: "Refinement — 8 upper aligners post-correction",
    urgency: "urgent", progress: 85, workflowStatus: "active_treatment",
    goals: ["Refine upper anterior positions", "Close residual spacing 11/21", "Final torque adjustment"],
    measurements: [
      { label: "Overjet",            value: "1.9 mm" },
      { label: "Overbite",           value: "2.0 mm" },
      { label: "Residual spacing",   value: "0.8 mm" },
      { label: "Bolton ratio (6:6)", value: "78.1% (lower excess 0.9 mm)" },
    ],
    history: [
      { id: "h4", timestamp: "2026-06-23 11:20", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Started active treatment", fromStatus: "approved", toStatus: "active_treatment" },
      { id: "h3", timestamp: "2026-06-23 10:45", actor: "Dr. Lee", actorRole: "Clinical Director", action: "Approved", fromStatus: "clinical_review", toStatus: "approved" },
      { id: "h2", timestamp: "2026-06-23 09:10", actor: "Dr. Chen", actorRole: "Orthodontist", action: "Submitted for review", fromStatus: "draft", toStatus: "scan_review" },
    ],
  },
  "C-2901": {
    patient: "James R.", initials: "JR", accentClass: "bg-teal-500",
    doctor: "Dr. Lee", malocclusionClass: "Class I",
    crowding: "Moderate (3–5 mm)", chiefComplaint: "Upper arch IPR 0.3 mm pre-authorization",
    urgency: "routine", progress: 35, workflowStatus: "clinical_review",
    goals: ["Authorize IPR 0.3 mm upper anteriors", "Maintain arch form", "Continue stage 7 of 18"],
    measurements: [
      { label: "Overjet",            value: "3.5 mm" },
      { label: "Overbite",           value: "3.1 mm" },
      { label: "Upper intercanine",  value: "34.2 mm" },
      { label: "Bolton ratio (6:6)", value: "76.4% (lower excess 0.7 mm)" },
    ],
    history: [
      { id: "h2", timestamp: "2026-06-23 10:30", actor: "Dr. Lee", actorRole: "Orthodontist", action: "Submitted for IPR review", fromStatus: "draft", toStatus: "scan_review" },
      { id: "h1", timestamp: "2026-06-22 15:00", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Case created", toStatus: "draft" },
    ],
  },
  "C-2859": {
    patient: "Marcus D.", initials: "MD", accentClass: "bg-blue-500",
    doctor: "Dr. Torres", malocclusionClass: "Class II",
    crowding: "Moderate (3–5 mm)", chiefComplaint: "Full-arch correction — 7 attachments proposed",
    urgency: "urgent", progress: 60, workflowStatus: "scan_review",
    goals: ["Class II correction with elastics", "Place 7 attachments", "Reduce overjet to < 3 mm"],
    measurements: [
      { label: "Overjet",            value: "5.2 mm" },
      { label: "Overbite",           value: "3.8 mm" },
      { label: "Upper arch length",  value: "94.6 mm" },
      { label: "Bolton ratio (6:6)", value: "75.1% (upper excess 1.6 mm)" },
    ],
    history: [
      { id: "h2", timestamp: "2026-06-23 07:45", actor: "Dr. Torres", actorRole: "Orthodontist", action: "Case submitted", fromStatus: "draft", toStatus: "scan_review" },
      { id: "h1", timestamp: "2026-06-22 10:00", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Case created", toStatus: "draft" },
    ],
  },
  "C-2912": {
    patient: "Ava N.", initials: "AN", accentClass: "bg-emerald-500",
    doctor: "Dr. Lee", malocclusionClass: "Class I",
    crowding: "Resolved", chiefComplaint: "Final retention phase — Hawley + Vivera",
    urgency: "routine", progress: 100, workflowStatus: "completed",
    goals: ["Deliver Hawley retainer upper", "Deliver Vivera retainer lower", "Schedule 6-month retention check"],
    measurements: [
      { label: "Final overjet",      value: "1.8 mm" },
      { label: "Final overbite",     value: "2.1 mm" },
      { label: "Bolton ratio (6:6)", value: "77.4% (within norm)" },
    ],
    history: [
      { id: "h5", timestamp: "2026-06-23 09:00", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Treatment completed", fromStatus: "active_treatment", toStatus: "completed" },
      { id: "h4", timestamp: "2026-06-22 14:00", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Started active treatment", fromStatus: "approved", toStatus: "active_treatment" },
      { id: "h3", timestamp: "2026-06-22 10:00", actor: "Dr. Lee", actorRole: "Orthodontist", action: "Approved", fromStatus: "clinical_review", toStatus: "approved" },
    ],
  },
  "C-2900": {
    patient: "Lily S.", initials: "LS", accentClass: "bg-indigo-500",
    doctor: "Dr. Nguyen", malocclusionClass: "Class I",
    crowding: "Mild (1–3 mm)", chiefComplaint: "Initial consultation — Class I moderate crowding",
    urgency: "routine", progress: 15, workflowStatus: "draft",
    goals: ["Complete diagnostic records", "Obtain CBCT", "Develop treatment plan"],
    measurements: [
      { label: "Overjet",   value: "3.0 mm" },
      { label: "Overbite",  value: "2.5 mm" },
    ],
    history: [
      { id: "h1", timestamp: "2026-06-23 06:30", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Case created", toStatus: "draft" },
    ],
  },
};

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab =
  // Overview
  | "summary" | "workflow" | "audit"
  // STL / Scans
  | "scans" | "scan-validation" | "processing"
  // AI Segmentation
  | "segment" | "segmentation" | "pipeline"
  // Treatment Planning
  | "plans" | "tx-goals" | "proposal" | "ai-assistant"
  // CAD
  | "cad-studio" | "movements" | "biomechanics"
  // Attachments & IPR
  | "attachments" | "ipr"
  // Staging & Aligners
  | "stages" | "aligner-staging" | "aligner-preview"
  // QA & Export
  | "qa-report" | "export" | "downloads"
  // Analysis & Imaging
  | "analysis" | "clinical-deep" | "occlusion" | "ceph" | "cbct" | "radiology"
  // AI & Clinical
  | "alerts"
  // Documentation
  | "reports" | "photos";

type TabItem =
  | { type: "tab"; key: Tab; label: string; icon: React.ReactNode }
  | { type: "separator"; label: string };

const TABS: TabItem[] = [
  // Overview
  { type: "tab", key: "summary",        label: "Summary",        icon: <ClipboardList size={13} /> },
  { type: "tab", key: "workflow",       label: "Workflow",        icon: <GitBranch size={13} /> },
  // STL / Scans
  { type: "separator", label: "Scans" },
  { type: "tab", key: "scans",          label: "Scans",           icon: <UploadCloud size={13} /> },
  { type: "tab", key: "scan-validation",label: "Upload",          icon: <Upload size={13} /> },
  { type: "tab", key: "processing",     label: "Processing",      icon: <ScanLine size={13} /> },
  // AI Segmentation
  { type: "separator", label: "AI" },
  { type: "tab", key: "segment",        label: "AI Segment",      icon: <ScanLine size={13} /> },
  { type: "tab", key: "segmentation",   label: "Segmentation",    icon: <Grid3X3 size={13} /> },
  { type: "tab", key: "pipeline",       label: "AI Pipeline",     icon: <Cpu size={13} /> },
  // Treatment Planning
  { type: "separator", label: "Planning" },
  { type: "tab", key: "plans",          label: "Plans",           icon: <ClipboardCheck size={13} /> },
  { type: "tab", key: "tx-goals",       label: "Tx Goals",        icon: <Target size={13} /> },
  { type: "tab", key: "proposal",       label: "AI Proposal",     icon: <Brain size={13} /> },
  // CAD
  { type: "separator", label: "CAD" },
  { type: "tab", key: "cad-studio",     label: "CAD Studio",      icon: <Move3d size={13} /> },
  { type: "tab", key: "movements",      label: "Movements",       icon: <Ruler size={13} /> },
  { type: "tab", key: "biomechanics",   label: "Biomechanics",    icon: <Zap size={13} /> },
  // Attachments & IPR
  { type: "separator", label: "Tx Detail" },
  { type: "tab", key: "attachments",    label: "Attachments",     icon: <Box size={13} /> },
  { type: "tab", key: "ipr",            label: "IPR",             icon: <Ruler size={13} /> },
  // Staging & Aligners
  { type: "separator", label: "Staging" },
  { type: "tab", key: "stages",         label: "Stages",          icon: <Layers size={13} /> },
  { type: "tab", key: "aligner-staging",label: "Staging",         icon: <Layers size={13} /> },
  { type: "tab", key: "aligner-preview",label: "Aligners",        icon: <Package size={13} /> },
  // QA & Export
  { type: "separator", label: "Export" },
  { type: "tab", key: "qa-report",      label: "QA",              icon: <ClipboardCheck size={13} /> },
  { type: "tab", key: "export",         label: "QA & Export",     icon: <ShieldCheck size={13} /> },
  { type: "tab", key: "downloads",      label: "Downloads",       icon: <Download size={13} /> },
  // Analysis & Imaging
  { type: "separator", label: "Analysis" },
  { type: "tab", key: "analysis",       label: "Analysis",        icon: <Microscope size={13} /> },
  { type: "tab", key: "clinical-deep",  label: "Deep Analysis",   icon: <BarChart2 size={13} /> },
  { type: "tab", key: "occlusion",      label: "Occlusion",       icon: <Target size={13} /> },
  { type: "tab", key: "ceph",           label: "Ceph",            icon: <ScanLine size={13} /> },
  { type: "tab", key: "cbct",           label: "CBCT",            icon: <Box size={13} /> },
  { type: "tab", key: "radiology",      label: "Imaging",         icon: <Camera size={13} /> },
  // AI & Clinical
  { type: "separator", label: "Clinical" },
  { type: "tab", key: "ai-assistant",   label: "AI Assistant",    icon: <Bot size={13} /> },
  { type: "tab", key: "alerts",         label: "CDS Alerts",      icon: <Activity size={13} /> },
  // Documentation
  { type: "separator", label: "Docs" },
  { type: "tab", key: "reports",        label: "Reports",         icon: <FileText size={13} /> },
  { type: "tab", key: "photos",         label: "Photos",          icon: <Camera size={13} /> },
  { type: "tab", key: "audit",          label: "Audit",           icon: <Activity size={13} /> },
];

// ─── Summary tab ──────────────────────────────────────────────────────────────

function EmptyState({ label, action }: { label: string; action?: { href: string; text: string } }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-[color:var(--border)] px-3 py-2.5 text-xs text-[color:var(--muted-foreground)]">
      <Info size={12} className="shrink-0 opacity-60" />
      <span className="flex-1">{label}</span>
      {action && (
        <Link href={action.href} className="shrink-0 font-semibold text-[color:var(--primary)] hover:underline">
          {action.text} →
        </Link>
      )}
    </div>
  );
}

function SummaryTab({
  profile,
  caseId,
  isLive,
}: {
  profile: CaseProfile;
  caseId: string;
  isLive: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Patient profile */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white ${profile.accentClass}`}>
            {profile.initials}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold text-[color:var(--foreground)]">{profile.patient}</h2>
            <p className="text-xs text-[color:var(--muted-foreground)]">{profile.doctor} · {profile.malocclusionClass}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1">
                <ProgressBar
                  value={profile.progress}
                  tone={profile.progress >= 80 ? "success" : profile.progress >= 50 ? "primary" : "warning"}
                />
              </div>
              <span className="text-xs tabular-nums text-[color:var(--muted-foreground)]">{profile.progress}%</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Clinical findings */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Stethoscope size={15} className="text-[color:var(--primary)]" />
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Clinical Findings</h3>
        </div>
        <DataRow label="Malocclusion class" value={profile.malocclusionClass !== "—" ? profile.malocclusionClass : <span className="text-[color:var(--muted-foreground)] italic text-xs">Not yet classified</span>} />
        <DataRow label="Crowding severity" value={profile.crowding !== "—" ? profile.crowding : <span className="text-[color:var(--muted-foreground)] italic text-xs">Not yet assessed</span>} />
        <DataRow label="Chief complaint" value={profile.chiefComplaint !== "—" ? profile.chiefComplaint : <span className="text-[color:var(--muted-foreground)] italic text-xs">Not recorded</span>} />
        <DataRow
          label="Urgency"
          value={
            <StatusBadge tone={profile.urgency === "critical" ? "danger" : profile.urgency === "urgent" ? "warning" : "neutral"}>
              {profile.urgency}
            </StatusBadge>
          }
        />
      </Card>

      {/* Treatment goals */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Target size={15} className="text-[color:var(--primary)]" />
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Treatment Goals</h3>
        </div>
        {profile.goals.length > 0 ? (
          <ul className="space-y-2">
            {profile.goals.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[color:var(--foreground)]">
                <CheckSquare2 size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                {g}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            label={isLive ? "No treatment goals defined yet. Set them in the Treatment Planning tab." : "No goals recorded."}
            action={isLive ? { href: `/studio?caseId=${encodeURIComponent(caseId)}&tab=plan`, text: "Set Goals" } : undefined}
          />
        )}
      </Card>

      {/* Measurements summary */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ruler size={15} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Measurements</h3>
          </div>
          <Link href={`/studio?caseId=${encodeURIComponent(caseId)}&tab=viewer`} className="text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2">
            Measure in Viewer →
          </Link>
        </div>
        {profile.measurements.length > 0 ? (
          <>
            {profile.measurements.map(m => (
              <DataRow key={m.label} label={m.label} value={m.value} />
            ))}
            {!isLive && (
              <p className="mt-3 text-[10px] text-[color:var(--muted-foreground)]">
                Representative values — verify with the 3D Viewer measurement tools before clinical decisions.
              </p>
            )}
          </>
        ) : (
          <EmptyState
            label="No measurements taken yet. Use the 3D Viewer to measure overjet, overbite, arch width, and more."
            action={{ href: `/studio?caseId=${encodeURIComponent(caseId)}&tab=viewer`, text: "Open Viewer" }}
          />
        )}
      </Card>

      {/* CAD shortcut */}
      <Card className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Box size={15} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">CAD Studio</h3>
          </div>
          <Link
            href={`/studio?caseId=${encodeURIComponent(caseId)}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)] transition-transform active:scale-95"
          >
            Open <ChevronRight size={11} />
          </Link>
        </div>
        <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
          STL import · distance / angle / overjet / overbite · Bolton Analysis · stage generation · export
        </p>
      </Card>
    </div>
  );
}

// ─── Workflow pipeline strip ──────────────────────────────────────────────────

const PIPELINE_STEPS: { key: CaseStatus; label: string }[] = [
  { key: "draft",            label: "Draft"    },
  { key: "scan_review",      label: "Scan"     },
  { key: "planning",         label: "Plan"     },
  { key: "clinical_review",  label: "Review"   },
  { key: "approved",         label: "Approved" },
  { key: "active_treatment", label: "Active"   },
  { key: "completed",        label: "Done"     },
];
const PIPELINE_ORDER = PIPELINE_STEPS.map((s) => s.key);

function WorkflowPipeline({ status }: { status: CaseStatus }) {
  const activeIdx = PIPELINE_ORDER.indexOf(status);
  return (
    <div className="mt-2.5 flex items-center" role="list" aria-label="Case workflow progress">
      {PIPELINE_STEPS.map((step, i) => {
        const done   = i <  activeIdx;
        const active = i === activeIdx;
        return (
          <div
            key={step.key}
            className={`flex items-center ${i > 0 ? "flex-1 min-w-0" : "shrink-0"}`}
          >
            {i > 0 && (
              <div
                aria-hidden="true"
                className={`h-px flex-1 min-w-[4px] transition-colors ${
                  done || active ? "bg-[color:var(--primary)]" : "bg-[color:var(--border)]"
                }`}
              />
            )}
            <span
              role="listitem"
              aria-current={active ? "step" : undefined}
              className={[
                "shrink-0 rounded-full px-1.5 py-[2px] text-[9px] font-semibold whitespace-nowrap transition-colors",
                done   ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)] opacity-70" : "",
                active ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]" : "",
                !done && !active ? "border border-[color:var(--border)] bg-transparent text-[color:var(--muted-foreground)]" : "",
              ].filter(Boolean).join(" ")}
            >
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Client component ─────────────────────────────────────────────────────────

export default function CaseDetailClient({ id }: { id: string }) {
  const [tab, setTab] = useState<Tab>("summary");
  const [liveData, setLiveData] = useState<CaseDetail | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'demo' | 'loading' | 'not_found'>('loading');

  useEffect(() => {
    fetchCase(id)
      .then(({ data, source }) => { setLiveData(data); setDataSource(source); })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setDataSource('not_found');
        } else {
          setDataSource('demo');
        }
      });
  }, [id]);

  const demoProfile = CASE_PROFILES[id] ?? {
    patient: id, initials: id.slice(-2).toUpperCase(), accentClass: "bg-slate-500",
    doctor: "—", malocclusionClass: "—", crowding: "—", chiefComplaint: "—",
    urgency: "routine" as const, progress: 50,
    workflowStatus: "clinical_review" as CaseStatus,
    goals: [], measurements: [],
    history: [{ id: "h1", timestamp: "—", actor: "—", actorRole: "—", action: "Case opened", toStatus: "draft" as CaseStatus }],
  };

  // When live API data is available, build the profile from it. Fields not exposed
  // by the API (goals, measurements, crowding) default to empty/unknown rather than
  // showing hardcoded demo data for the specific case IDs above.
  const profile: CaseProfile = liveData && dataSource === 'api' ? {
    patient: `${liveData.patient.firstName} ${liveData.patient.lastName}`,
    initials: `${liveData.patient.firstName.slice(0, 1)}${liveData.patient.lastName.slice(0, 1)}`.toUpperCase(),
    accentClass: demoProfile.accentClass,
    doctor: liveData.assignedTo?.name ?? "—",
    malocclusionClass: liveData.malocclusionClass ?? "—",
    crowding: "—",
    chiefComplaint: liveData.chiefComplaint ?? "—",
    urgency: "routine" as const,
    progress: 50,
    workflowStatus: liveData.status as CaseStatus,
    goals: [],
    measurements: [],
    history: [],
  } : demoProfile;

  const setupId = liveData?.linkedResources?.setupId      ?? undefined;
  const scanId  = liveData?.linkedResources?.latestScanId ?? profile.scanId ?? undefined;
  const planId  = liveData?.linkedResources?.planId       ?? profile.planId ?? undefined;

  const workflowStatus = (liveData?.status as CaseStatus | undefined) ?? profile.workflowStatus;
  const workflowHistory: WorkflowEvent[] = liveData?.workflowHistory?.map(e => ({
    id:        e.id,
    timestamp: e.createdAt,
    actor:     e.actorName ?? '—',
    actorRole: e.actorRole ?? '—',
    action:    e.notes ?? `→ ${e.toStatus}`,
    fromStatus: e.fromStatus as CaseStatus | undefined,
    toStatus:   e.toStatus as CaseStatus,
  })) ?? profile.history;

  const patientName = liveData
    ? `${liveData.patient.firstName} ${liveData.patient.lastName}`
    : profile.patient;

  if (dataSource === 'not_found') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]">
          <FolderX size={28} />
        </div>
        <h1 className="text-xl font-semibold text-[color:var(--foreground)]">Case not found</h1>
        <p className="max-w-xs text-sm text-[color:var(--muted-foreground)]">
          Case <span className="font-mono font-semibold">{id}</span> does not exist or you do not have access to it.
        </p>
        <Link
          href="/cases"
          className="mt-2 inline-flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-[color:var(--primary-foreground)] hover:opacity-90 transition-opacity"
        >
          <ArrowLeft size={16} /> Back to Cases
        </Link>
      </div>
    );
  }

  return (
    <section className="animate-page-enter mx-auto w-full max-w-4xl pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="flex items-center gap-3">
          <Link
            href="/cases"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] transition-transform active:scale-90"
            aria-label="Back to cases"
          >
            <ArrowLeft size={16} />
          </Link>
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${profile.accentClass}`}>
            {profile.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[color:var(--foreground)]">{patientName}</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[color:var(--muted-foreground)]">{liveData?.id ?? id}</span>
              {dataSource === 'loading' && <StatusBadge tone="neutral">Loading…</StatusBadge>}
              {dataSource === 'api'     && <StatusBadge tone="success">Live</StatusBadge>}
              {dataSource === 'demo'    && <StatusBadge tone="info">Representative data</StatusBadge>}
            </div>
          </div>
        </div>

        {/* Case workflow pipeline */}
        <WorkflowPipeline status={workflowStatus} />

        {/* Horizontally scrollable tab strip */}
        <div className="mt-3 -mx-4 sm:-mx-5 overflow-x-auto px-4 sm:px-5 scrollbar-none">
          <div className="flex items-center gap-1 w-max">
            {TABS.map((t, i) =>
              t.type === "separator" ? (
                <div key={`sep-${i}`} className="flex items-center gap-1 mx-1" aria-hidden>
                  <div className="w-px h-4 bg-[color:var(--border)]" />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)] opacity-50 select-none">{t.label}</span>
                </div>
              ) : (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={[
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                    tab === t.key
                      ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                      : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                  ].join(" ")}
                >
                  {t.icon} {t.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 sm:px-5">
        {/* Overview */}
        {tab === "summary"   && <SummaryTab profile={profile} caseId={id} isLive={dataSource === 'api'} />}
        {tab === "workflow"  && (
          <ClinicalWorkflow
            caseId={id}
            caseName={`${patientName} — ${liveData?.malocclusionClass ?? profile.malocclusionClass}`}
            initialStatus={workflowStatus}
            initialHistory={workflowHistory}
            currentActor={liveData?.assignedTo?.name ?? "—"}
            currentActorRole="Clinical Director"
          />
        )}
        {tab === "audit"     && <AuditTrail caseId={id} isLive={dataSource === 'api'} />}

        {/* STL / Scans */}
        {tab === "scans"          && <ScanPanel caseId={id} />}
        {tab === "scan-validation" && <ScanValidationPanel caseId={id} uploadId={scanId} />}
        {tab === "processing"     && <ScanProcessingPanel caseId={id} scanId={scanId ?? ''} />}

        {/* AI Segmentation */}
        {tab === "segment"        && <AISegmentationCenter caseId={id} />}
        {tab === "segmentation"   && <ToothSegmentationPanel uploadId={scanId ?? ""} />}
        {tab === "pipeline"       && <TreatmentPipelinePanel caseId={id} />}

        {/* Treatment Planning */}
        {tab === "plans"          && <TreatmentPlansPanel caseId={id} />}
        {tab === "tx-goals"       && <TreatmentGoalsPanel caseId={id} />}
        {tab === "proposal"       && <AIProposalPanel caseId={id} />}

        {/* CAD */}
        {tab === "cad-studio"     && <CADWorkspacePanel caseId={id} />}
        {tab === "movements"      && <ToothTransformPanel caseId={id} />}
        {tab === "biomechanics"   && <BiomechanicsPanel setupId={setupId} />}

        {/* Attachments & IPR */}
        {tab === "attachments"    && <AttachmentPlanner caseId={id} planId={planId ?? ''} />}
        {tab === "ipr"            && <IPRPlanner caseId={id} planId={planId ?? ''} />}

        {/* Staging & Aligners */}
        {tab === "stages"         && <TreatmentStagesPanel setupId={setupId} />}
        {tab === "aligner-staging" && <AlignerStaging caseId={id} patientName={patientName} />}
        {tab === "aligner-preview" && <AlignerPreviewPanel setupId={setupId} />}

        {/* QA & Export */}
        {tab === "qa-report"      && <QAReportPanel setupId={setupId} />}
        {tab === "export"         && <PreExportQAPanel caseId={id} />}
        {tab === "downloads"      && <PrinterDownloadPanel caseId={id} setupId={setupId} />}

        {/* Analysis & Imaging */}
        {tab === "analysis"       && <ClinicalAnalysisPanel caseId={id} />}
        {tab === "clinical-deep"  && <ClinicalAnalysisDeepPanel caseId={id} uploadId={scanId} />}
        {tab === "occlusion"      && <OcclusionPanel caseId={id} />}
        {tab === "ceph"           && <CephalometricPanel caseId={id} />}
        {tab === "cbct"           && <CbctFusionPanel caseId={id} stlScanId={scanId ?? ''} />}
        {tab === "radiology"      && <RadiologyPanel patientId={liveData?.patient.id ?? id} caseId={id} />}

        {/* AI & Clinical */}
        {tab === "ai-assistant"   && <AIClinicalAssistantPanel setupId={setupId} />}
        {tab === "alerts"         && <ClinicalAlertsPanel caseId={id} />}

        {/* Documentation */}
        {tab === "reports"        && <ClinicalReportsPanel caseId={id} planId={planId} />}
        {tab === "photos"         && <PatientPhotosPanel caseId={id} />}
      </div>
    </section>
  );
}
