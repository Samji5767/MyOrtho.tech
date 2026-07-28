"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/auth";
import Link from "next/link";
import { fetchCase, type CaseDetail } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/client";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckSquare2,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FolderX,
  GitBranch,
  Info,
  Layers,
  Ruler,
  ScanLine,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Card, DataRow, ProgressBar, StatusBadge } from "@/components/DesignSystem";
import ClinicalWorkflow, { type CaseStatus, type WorkflowEvent } from "@/components/ClinicalWorkflow";

const ScanPanel = dynamic(() => import("@/components/ScanPanel"), { ssr: false });
const TreatmentPlansPanel = dynamic(() => import("@/components/TreatmentPlansPanel"), { ssr: false });
const PatientPhotosPanel = dynamic(() => import("@/components/PatientPhotosPanel"), { ssr: false });
const ApprovalValidationPanel = dynamic(
  () => import("@/components/ApprovalValidationPanel").then((m) => ({ default: m.ApprovalValidationPanel })),
  { ssr: false },
);
const AISegmentationCenter = dynamic(
  () => import("@/components/AISegmentationCenter").then((m) => ({ default: m.AISegmentationCenter })),
  { ssr: false, loading: () => <div className="h-[400px] animate-skeleton rounded-xl" /> },
);
const DentalAnatomyViewer = dynamic(() => import("@/components/DentalAnatomyViewer"), { ssr: false });

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
    goals: ["Complete diagnostic records", "Develop treatment plan"],
    measurements: [
      { label: "Overjet",   value: "3.0 mm" },
      { label: "Overbite",  value: "2.5 mm" },
    ],
    history: [
      { id: "h1", timestamp: "2026-06-23 06:30", actor: "T. Williams", actorRole: "Treatment Coordinator", action: "Case created", toStatus: "draft" },
    ],
  },
};

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

function SummaryTab({ profile, caseId, isLive }: { profile: CaseProfile; caseId: string; isLive: boolean }) {
  const urgencyConfig = {
    critical: { label: "Critical",  bg: "bg-rose-100 dark:bg-rose-900/30",   text: "text-rose-700 dark:text-rose-400"   },
    urgent:   { label: "Urgent",    bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
    routine:  { label: "Routine",   bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
  }[profile.urgency];

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Case Details</h3>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${urgencyConfig.bg} ${urgencyConfig.text}`}>
            {urgencyConfig.label}
          </span>
        </div>
        <div className="space-y-0.5">
          <DataRow label="Patient"      value={profile.patient} />
          <DataRow label="Treating Dr." value={profile.doctor} />
          <DataRow label="Malocclusion" value={profile.malocclusionClass} />
          <DataRow label="Chief Complaint" value={profile.chiefComplaint} />
        </div>
        <div className="mt-4">
          <ProgressBar value={profile.progress} label={`${profile.progress}% complete`} />
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <CheckSquare2 size={15} className="text-[color:var(--primary)]" />
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
            label={isLive ? "No treatment goals defined yet. Create a treatment plan to set goals." : "No goals recorded."}
          />
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ruler size={15} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Measurements</h3>
          </div>
          <Link href={`/cases/${encodeURIComponent(caseId)}?tab=3d-anatomy`} className="text-xs font-semibold text-[color:var(--primary)] hover:underline underline-offset-2">
            View in 3D →
          </Link>
        </div>
        {profile.measurements.length > 0 ? (
          <>
            {profile.measurements.map(m => (
              <DataRow key={m.label} label={m.label} value={m.value} />
            ))}
            {!isLive && (
              <p className="mt-3 text-[10px] text-[color:var(--muted-foreground)]">
                Representative values — verify with the 3D Viewer before clinical decisions.
              </p>
            )}
          </>
        ) : (
          <EmptyState label="No measurements taken yet. Upload a scan to begin." />
        )}
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

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab =
  | "summary"
  | "workflow"
  | "scans"
  | "segment"
  | "3d-anatomy"
  | "plans"
  | "export"
  | "photos";

type TabItem = { key: Tab; label: string; icon: React.ReactNode };

const TABS: TabItem[] = [
  { key: "summary",    label: "Summary",       icon: <ClipboardList size={13} /> },
  { key: "workflow",   label: "Workflow",       icon: <GitBranch size={13} /> },
  { key: "scans",      label: "Scans",          icon: <UploadCloud size={13} /> },
  { key: "segment",    label: "AI Segment",     icon: <ScanLine size={13} /> },
  { key: "3d-anatomy", label: "3D Anatomy",     icon: <Layers size={13} /> },
  { key: "plans",      label: "Treatment Plan", icon: <ClipboardCheck size={13} /> },
  { key: "export",     label: "Approval",       icon: <ShieldCheck size={13} /> },
  { key: "photos",     label: "Photos",         icon: <Camera size={13} /> },
];

// ─── Client component ─────────────────────────────────────────────────────────

export default function CaseDetailClient({ id }: { id: string }) {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("summary");
  const [liveData, setLiveData] = useState<CaseDetail | null>(null);
  const [dataSource, setDataSource] = useState<'api' | 'error' | 'loading' | 'not_found'>('loading');
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    setFetchError(null);
    setDataSource('loading');
    fetchCase(id)
      .then(({ data, source }) => {
        if (source === 'demo') {
          setDataSource('error');
          setFetchError('Could not reach the backend — check your connection');
        } else {
          setLiveData(data);
          setDataSource(source);
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setDataSource('not_found');
        } else {
          setDataSource('error');
          setFetchError(err instanceof Error ? err.message : 'Failed to load case');
        }
      });
  }, [id, retryTick]);

  const demoProfile = CASE_PROFILES[id] ?? {
    patient: "Unknown Patient", initials: "?", accentClass: "bg-slate-500",
    doctor: "—", malocclusionClass: "—", crowding: "—", chiefComplaint: "—",
    urgency: "routine" as const, progress: 50,
    workflowStatus: "clinical_review" as CaseStatus,
    goals: [], measurements: [],
    history: [{ id: "h1", timestamp: "—", actor: "—", actorRole: "—", action: "Case opened", toStatus: "draft" as CaseStatus }],
  };

  const profile: CaseProfile = liveData && dataSource === 'api' ? {
    patient: `${liveData.patient.firstName} ${liveData.patient.lastName}`,
    initials: `${liveData.patient.firstName.slice(0, 1)}${liveData.patient.lastName.slice(0, 1)}`.toUpperCase(),
    accentClass: demoProfile.accentClass,
    doctor: liveData.assignedTo?.name ?? "—",
    malocclusionClass: liveData.malocclusionClass ?? "—",
    crowding: "—",
    chiefComplaint: liveData.chiefComplaint ?? "—",
    urgency: ((): CaseProfile['urgency'] => {
      const s = liveData.status;
      if (s === 'clinical_review' || s === 'approved') return 'urgent';
      return 'routine';
    })(),
    progress: (() => {
      const map: Record<string, number> = {
        draft: 10, scan_review: 25, segmentation: 40, planning: 55,
        clinical_review: 70, approved: 85, active_treatment: 90,
        monitoring: 95, retention: 98, completed: 100, archived: 100, cancelled: 0,
      };
      return map[liveData.status] ?? 50;
    })(),
    workflowStatus: liveData.status as CaseStatus,
    goals: [],
    measurements: [],
    history: liveData.workflowHistory?.map((e) => ({
      id: e.id,
      timestamp: e.createdAt,
      actor: e.actorName ?? '—',
      actorRole: e.actorRole ?? '—',
      action: e.toStatus ? `Status → ${e.toStatus.replace(/_/g, ' ')}` : '—',
      toStatus: e.toStatus as CaseStatus,
    })) ?? [],
  } : demoProfile;

  const planId  = liveData?.linkedResources?.planId ?? profile.planId ?? undefined;

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

  if (dataSource === 'error') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 px-6 py-24 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-200/60 bg-rose-50/60 dark:border-rose-700/30 dark:bg-rose-900/10 text-rose-500">
          <AlertTriangle size={28} />
        </div>
        <h1 className="text-xl font-semibold text-[color:var(--foreground)]">Unable to load case</h1>
        {fetchError && (
          <p className="max-w-xs text-sm text-[color:var(--muted-foreground)]">{fetchError}</p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <button
            type="button"
            onClick={() => setRetryTick((t) => t + 1)}
            className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-[color:var(--primary-foreground)] hover:opacity-90 transition-opacity"
          >
            Retry
          </button>
          <Link
            href="/cases"
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--border)]/40 transition-colors"
          >
            <ArrowLeft size={16} /> Back to Cases
          </Link>
        </div>
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
            </div>
          </div>
        </div>

        {/* Case workflow pipeline */}
        <WorkflowPipeline status={workflowStatus} />

        {/* Horizontally scrollable tab strip */}
        <div className="mt-3 -mx-4 sm:-mx-5 overflow-x-auto px-4 sm:px-5 scrollbar-none">
          <div className="flex items-center gap-1 w-max">
            {TABS.map((t) => (
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
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 sm:px-5">
        {/* API error banner */}
        {fetchError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-300/50 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-700/40 dark:bg-rose-900/10 dark:text-rose-400">
            <AlertTriangle size={12} className="shrink-0" />
            <span className="flex-1">
              Could not load live data — showing representative data. ({fetchError})
            </span>
            <button
              type="button"
              onClick={() => setFetchError(null)}
              className="shrink-0 font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {tab === "summary"    && <SummaryTab profile={profile} caseId={id} isLive={dataSource === 'api'} />}
        {tab === "workflow"   && (
          <ClinicalWorkflow
            caseId={id}
            caseName={`${patientName} — ${liveData?.malocclusionClass ?? profile.malocclusionClass}`}
            initialStatus={workflowStatus}
            initialHistory={workflowHistory}
            currentActor={liveData?.assignedTo?.name ?? "—"}
            currentActorRole={user?.role ? roleLabel(user.role) : "Clinician"}
          />
        )}
        {tab === "scans"      && <ScanPanel caseId={id} />}
        {tab === "segment"    && <AISegmentationCenter caseId={id} />}
        {tab === "3d-anatomy" && <DentalAnatomyViewer caseId={id} />}
        {tab === "plans"      && <TreatmentPlansPanel caseId={id} />}
        {tab === "export"     && (
          planId
            ? <ApprovalValidationPanel caseId={id} planId={planId} />
            : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <ChevronRight size={24} className="text-[color:var(--muted-foreground)]" />
                <p className="text-sm text-[color:var(--muted-foreground)]">
                  Create a treatment plan before requesting approval.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("plans")}
                  className="rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-xs font-semibold text-[color:var(--primary-foreground)]"
                >
                  Go to Treatment Plan
                </button>
              </div>
            )
        )}
        {tab === "photos"     && <PatientPhotosPanel caseId={id} />}
      </div>
    </section>
  );
}
