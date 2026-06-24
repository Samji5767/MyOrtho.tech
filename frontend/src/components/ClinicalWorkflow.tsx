"use client";

import React, { useState } from "react";
import { CheckCircle2, ChevronRight, Clock, FileEdit, Send, ShieldCheck, Truck, XCircle } from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";

export type CaseStatus =
  | "draft"
  | "submitted"
  | "clinical-review"
  | "approved"
  | "revision-requested"
  | "manufacturing"
  | "completed";

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
  draft:              { label: "Draft",            tone: "neutral",  icon: <FileEdit size={13} />,    order: 0 },
  submitted:          { label: "Submitted",        tone: "info",     icon: <Send size={13} />,        order: 1 },
  "clinical-review":  { label: "Clinical Review",  tone: "primary",  icon: <ShieldCheck size={13} />, order: 2 },
  approved:           { label: "Approved",         tone: "success",  icon: <CheckCircle2 size={13} />,order: 3 },
  "revision-requested": { label: "Revision Requested", tone: "warning", icon: <FileEdit size={13} />, order: 2 },
  manufacturing:      { label: "Manufacturing",    tone: "info",     icon: <Truck size={13} />,       order: 4 },
  completed:          { label: "Completed",        tone: "success",  icon: <CheckCircle2 size={13} />,order: 5 },
};

const ORDERED_STATUSES: CaseStatus[] = [
  "draft", "submitted", "clinical-review", "approved", "manufacturing", "completed",
];

type AllowedAction = {
  label: string;
  toStatus: CaseStatus;
  tone: "primary" | "success" | "danger" | "secondary";
  requiresNote?: boolean;
};

const TRANSITIONS: Record<CaseStatus, AllowedAction[]> = {
  draft:              [{ label: "Submit for Review", toStatus: "submitted",    tone: "primary" }],
  submitted:          [{ label: "Begin Review",      toStatus: "clinical-review", tone: "primary" }],
  "clinical-review":  [
    { label: "Approve",           toStatus: "approved",           tone: "success" },
    { label: "Request Revision",  toStatus: "revision-requested", tone: "secondary", requiresNote: true },
    { label: "Reject",            toStatus: "draft",              tone: "danger",  requiresNote: true },
  ],
  approved:           [{ label: "Send to Manufacturing", toStatus: "manufacturing", tone: "primary" }],
  "revision-requested": [{ label: "Resubmit",         toStatus: "submitted",    tone: "primary" }],
  manufacturing:      [{ label: "Mark Completed",    toStatus: "completed",    tone: "success" }],
  completed:          [],
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
  initialStatus = "clinical-review",
  initialHistory,
  currentActor = "Dr. Demo",
  currentActorRole = "Clinical Director",
}: ClinicalWorkflowProps) {
  const [status, setStatus] = useState<CaseStatus>(initialStatus);
  const [history, setHistory] = useState<WorkflowEvent[]>(
    initialHistory ?? [
      {
        id: "evt-seed-2",
        timestamp: "2026-06-23 09:14",
        actor: "T. Coordinator",
        actorRole: "Treatment Coordinator",
        action: "Case submitted for clinical review",
        fromStatus: "draft",
        toStatus: "submitted",
      },
      {
        id: "evt-seed-1",
        timestamp: "2026-06-23 08:55",
        actor: "T. Coordinator",
        actorRole: "Treatment Coordinator",
        action: "Case created",
        toStatus: "draft",
      },
    ]
  );
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
      if (caseId !== "DEMO-001") {
        await fetch(`/api/cases/${caseId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action.toStatus, notes }),
        });
      }
    } catch {
      // backend not connected — UI-only update
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
              <p className="text-xs text-secondary">All clinical and manufacturing steps are done.</p>
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
