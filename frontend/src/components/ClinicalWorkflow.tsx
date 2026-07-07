"use client";

import React, { useState } from "react";
import { Activity, Archive, CheckCircle2, ChevronRight, Clock, FileEdit, FlaskConical, Scan, ShieldCheck, XCircle } from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";
import { api } from "@/lib/api/client";

export type CaseStatus =
  | "draft"
  | "scan_review"
  | "segmentation"
  | "planning"
  | "clinical_review"
  | "approved"
  | "active_treatment"
  | "monitoring"
  | "retention"
  | "completed"
  | "archived"
  | "cancelled";

export type WorkflowEvent = {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  action: string;
  fromStatus?: CaseStatus;
  toStatus: CaseStatus;
  notes?: string;
};

const STATUS_META: Record<
  CaseStatus,
  { label: string; tone: "neutral" | "info" | "primary" | "success" | "warning" | "danger"; icon: React.ReactNode; order: number }
> = {
  draft:            { label: "Draft",            tone: "neutral",  icon: <FileEdit size={13} />,     order: 0 },
  scan_review:      { label: "Scan Review",      tone: "info",     icon: <Scan size={13} />,         order: 1 },
  segmentation:     { label: "Segmentation",     tone: "info",     icon: <FlaskConical size={13} />, order: 2 },
  planning:         { label: "Planning",         tone: "primary",  icon: <Activity size={13} />,     order: 3 },
  clinical_review:  { label: "Clinical Review",  tone: "primary",  icon: <ShieldCheck size={13} />,  order: 4 },
  approved:         { label: "Approved",         tone: "success",  icon: <CheckCircle2 size={13} />, order: 5 },
  active_treatment: { label: "Active Treatment", tone: "success",  icon: <Activity size={13} />,     order: 6 },
  monitoring:       { label: "Monitoring",       tone: "info",     icon: <Clock size={13} />,        order: 7 },
  retention:        { label: "Retention",        tone: "warning",  icon: <Clock size={13} />,        order: 8 },
  completed:        { label: "Completed",        tone: "success",  icon: <CheckCircle2 size={13} />, order: 9 },
  archived:         { label: "Archived",         tone: "neutral",  icon: <Archive size={13} />,      order: 10 },
  cancelled:        { label: "Cancelled",        tone: "danger",   icon: <XCircle size={13} />,      order: 10 },
};

const ORDERED_STATUSES: CaseStatus[] = [
  "draft", "scan_review", "segmentation", "planning", "clinical_review",
  "approved", "active_treatment", "monitoring", "retention", "completed",
];

type AllowedAction = {
  label: string;
  toStatus: CaseStatus;
  tone: "primary" | "success" | "danger" | "secondary";
  requiresNote?: boolean;
};

const TRANSITIONS: Record<CaseStatus, AllowedAction[]> = {
  draft:            [
    { label: "Upload Scans",  toStatus: "scan_review", tone: "primary" },
    { label: "Cancel Case",   toStatus: "cancelled",   tone: "danger", requiresNote: true },
  ],
  scan_review:      [
    { label: "Begin Segmentation", toStatus: "segmentation", tone: "primary" },
    { label: "Back to Draft",      toStatus: "draft",        tone: "secondary" },
    { label: "Cancel Case",        toStatus: "cancelled",    tone: "danger", requiresNote: true },
  ],
  segmentation:     [
    { label: "Start Planning", toStatus: "planning",     tone: "primary" },
    { label: "Re-scan",        toStatus: "scan_review",  tone: "secondary" },
    { label: "Cancel Case",    toStatus: "cancelled",    tone: "danger", requiresNote: true },
  ],
  planning:         [
    { label: "Submit for Review", toStatus: "clinical_review", tone: "primary" },
    { label: "Back to Segmentation", toStatus: "segmentation", tone: "secondary" },
    { label: "Cancel Case",       toStatus: "cancelled",       tone: "danger", requiresNote: true },
  ],
  clinical_review:  [
    { label: "Approve Treatment", toStatus: "approved",         tone: "success" },
    { label: "Request Revision",  toStatus: "planning",         tone: "secondary", requiresNote: true },
  ],
  approved:         [{ label: "Start Treatment", toStatus: "active_treatment", tone: "primary" }],
  active_treatment: [
    { label: "Move to Monitoring", toStatus: "monitoring", tone: "primary" },
    { label: "Begin Retention",    toStatus: "retention",  tone: "primary" },
    { label: "Complete",           toStatus: "completed",  tone: "success" },
  ],
  monitoring:       [
    { label: "Begin Retention",    toStatus: "retention",        tone: "primary" },
    { label: "Resume Treatment",   toStatus: "active_treatment", tone: "secondary" },
    { label: "Complete",           toStatus: "completed",        tone: "success" },
  ],
  retention:        [{ label: "Complete Case", toStatus: "completed", tone: "success" }],
  completed:        [{ label: "Archive",       toStatus: "archived",  tone: "secondary" }],
  archived:         [],
  cancelled:        [],
};

function StatusPill({ status }: { status: CaseStatus }) {
  const meta = STATUS_META[status];
  return (
    <StatusBadge tone={meta.tone}>
      <span className="flex items-center gap-1">
        {meta.icon}
        {meta.label}
      </span>
    </StatusBadge>
  );
}

function StatusTimeline({ current }: { current: CaseStatus }) {
  const currentOrder = STATUS_META[current].order;
  return (
    <ol className="flex items-center gap-0">
      {ORDERED_STATUSES.map((s, i) => {
        const meta = STATUS_META[s];
        const done = meta.order < currentOrder;
        const active = s === current;
        return (
          <React.Fragment key={s}>
            <li className="flex flex-col items-center">
              <div
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-full border text-[11px] font-bold transition",
                  done
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                    : active
                    ? "border-teal-500/60 bg-teal-500/20 text-teal-300 ring-2 ring-teal-500/30"
                    : "border-border bg-card text-secondary",
                ].join(" ")}
                aria-current={active ? "step" : undefined}
              >
                {done ? <CheckCircle2 size={13} /> : i + 1}
              </div>
              <span className={["mt-1 hidden text-[9px] font-semibold uppercase tracking-wide sm:block", active ? "text-teal-300" : done ? "text-emerald-400" : "text-secondary"].join(" ")}>
                {meta.label}
              </span>
            </li>
            {i < ORDERED_STATUSES.length - 1 && (
              <div className={["h-px flex-1 mx-1", done ? "bg-emerald-500/40" : "bg-border"].join(" ")} aria-hidden />
            )}
          </React.Fragment>
        );
      })}
    </ol>
  );
}

function WorkflowEventRow({ event }: { event: WorkflowEvent }) {
  return (
    <li className="flex gap-3">
      <div className="mt-0.5 flex flex-col items-center">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-secondary">
          {STATUS_META[event.toStatus]?.icon ?? <Clock size={11} />}
        </span>
        <div className="mt-1 h-full w-px bg-border/50" />
      </div>
      <div className="pb-4">
        <p className="text-sm font-semibold text-foreground">{event.action}</p>
        <p className="mt-0.5 text-xs text-secondary">
          {event.actor} · {event.actorRole} · {event.timestamp}
        </p>
        {event.notes && (
          <p className="mt-2 rounded-lg border border-border bg-card/60 px-3 py-2 text-xs leading-5 text-secondary">
            {event.notes}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-1.5">
          {event.fromStatus && <StatusPill status={event.fromStatus} />}
          {event.fromStatus && <ChevronRight size={11} className="text-secondary" />}
          <StatusPill status={event.toStatus} />
        </div>
      </div>
    </li>
  );
}

interface ClinicalWorkflowProps {
  caseId?: string;
  caseName?: string;
  initialStatus?: CaseStatus;
  initialHistory?: WorkflowEvent[];
  currentActor?: string;
  currentActorRole?: string;
}

export default function ClinicalWorkflow({
  caseId = "DEMO-001",
  caseName = "Sample Case",
  initialStatus = "clinical_review",
  initialHistory,
  currentActor = "Dr. Demo",
  currentActorRole = "Clinical Director",
}: ClinicalWorkflowProps) {
  const [status, setStatus] = useState<CaseStatus>(initialStatus);
  const [history, setHistory] = useState<WorkflowEvent[]>(initialHistory ?? []);
  const [noteInput, setNoteInput] = useState("");
  const [pendingAction, setPendingAction] = useState<AllowedAction | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const actions = TRANSITIONS[status] ?? [];

  const handleAction = async (action: AllowedAction) => {
    if (action.requiresNote && !pendingAction) {
      setPendingAction(action);
      return;
    }
    setSubmitting(true);
    const notes = noteInput.trim() || undefined;
    const event: WorkflowEvent = {
      id: `evt-${Date.now()}`,
      timestamp: new Date().toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" }).replace(",", ""),
      actor: currentActor,
      actorRole: currentActorRole,
      action: action.label,
      fromStatus: status,
      toStatus: action.toStatus,
      notes,
    };

    try {
      await api.patch(`/api/cases/${caseId}/status`, { status: action.toStatus, notes });
    } catch (err) {
      console.error("[ClinicalWorkflow] status transition failed:", err);
      setSubmitting(false);
      return;
    }

    setStatus(action.toStatus);
    setHistory((prev) => [event, ...prev]);
    setNoteInput("");
    setPendingAction(null);
    setSubmitting(false);
  };

  const cancelNote = () => { setPendingAction(null); setNoteInput(""); };

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Case {caseId}</p>
            <h2 className="mt-0.5 text-lg font-semibold text-foreground">{caseName}</h2>
          </div>
          <StatusPill status={status} />
        </div>

        <div className="mt-4 overflow-x-auto pb-1">
          <StatusTimeline current={status} />
        </div>
      </Card>

      {actions.length > 0 && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground">Available Actions</h3>
          <p className="mt-1 text-xs text-secondary">
            Acting as <span className="font-medium text-foreground">{currentActor}</span> · {currentActorRole}
          </p>

          {pendingAction ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                {pendingAction.label} — add a note (required):
              </p>
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                rows={3}
                placeholder="Describe the reason for this action…"
                className="w-full resize-none rounded-lg border border-border bg-card/60 px-3 py-2 text-sm text-foreground placeholder:text-secondary focus-ring"
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!noteInput.trim() || submitting}
                  onClick={() => void handleAction(pendingAction)}
                >
                  {submitting ? "Saving…" : "Confirm"}
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelNote}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {actions.map((action) => (
                <Button
                  key={action.label}
                  variant={action.tone === "success" ? "primary" : action.tone === "danger" ? "danger" : action.tone === "secondary" ? "secondary" : "primary"}
                  size="sm"
                  disabled={submitting}
                  onClick={() => void handleAction(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </Card>
      )}

      {status === "completed" && (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="text-emerald-400" size={20} />
            <div>
              <p className="text-sm font-semibold text-foreground">Case completed</p>
              <p className="text-xs text-secondary">All clinical steps are complete. Ready to archive.</p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground">Approval Timeline</h3>
        <p className="mt-0.5 text-xs text-secondary">{history.length} event{history.length !== 1 ? "s" : ""}</p>
        <ul className="mt-4 space-y-0">
          {history.map((event) => (
            <WorkflowEventRow key={event.id} event={event} />
          ))}
        </ul>
      </Card>

      {caseId === "DEMO-001" && (
        <p className="text-center text-[10px] text-secondary">
          Representative workflow demo · Status transitions will persist to the backend when connected via{" "}
          <code className="font-mono">PATCH /api/cases/:id/status</code>
        </p>
      )}
    </div>
  );
}
