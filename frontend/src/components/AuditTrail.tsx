"use client";

import React, { useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  FilePlus2,
  Gauge,
  Pencil,
  ShieldAlert,
  Truck,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Button, Card, SkeletonBlock, StatusBadge } from "@/components/DesignSystem";

export type AuditEventType =
  | "case_created"
  | "file_uploaded"
  | "measurement_created"
  | "treatment_modified"
  | "approved"
  | "approval_revoked"
  | "revision_requested"
  | "export_ready"
  | "treatment_completed"
  | "status_changed"
  | "note_added";

export type AuditEntry = {
  id: string;
  timestamp: string;
  actor: string;
  actorRole: string;
  eventType: AuditEventType;
  description: string;
  metadata?: Record<string, unknown>;
};

const EVENT_META: Record<
  AuditEventType,
  {
    label: string;
    icon: React.ReactNode;
    tone: "neutral" | "primary" | "success" | "warning" | "danger" | "info";
  }
> = {
  case_created:           { label: "Case Created",            icon: <FilePlus2 size={13} />,   tone: "info"    },
  file_uploaded:          { label: "File Uploaded",           icon: <UploadCloud size={13} />, tone: "info"    },
  measurement_created:    { label: "Measurement",             icon: <Gauge size={13} />,       tone: "primary" },
  treatment_modified:     { label: "Treatment Modified",      icon: <Pencil size={13} />,      tone: "warning" },
  approved:               { label: "Approved",                icon: <CheckCircle2 size={13} />,tone: "success" },
  approval_revoked:       { label: "Approval Revoked",        icon: <XCircle size={13} />,     tone: "danger"  },
  revision_requested:     { label: "Revision Requested",      icon: <FileCheck2 size={13} />,  tone: "warning" },
  export_ready:           { label: "Export Ready",           icon: <Truck size={13} />,       tone: "info"    },
  treatment_completed:    { label: "Treatment Completed",    icon: <Truck size={13} />,        tone: "success" },
  status_changed:         { label: "Status Changed",          icon: <Activity size={13} />,    tone: "neutral" },
  note_added:             { label: "Note Added",              icon: <Pencil size={13} />,      tone: "neutral" },
};

const ALL_EVENT_TYPES = Object.keys(EVENT_META) as AuditEventType[];

const SEED_ENTRIES: AuditEntry[] = [
  {
    id: "aud-007",
    timestamp: "2026-06-23T11:42:00Z",
    actor: "Dr. Lee",
    actorRole: "Clinical Director",
    eventType: "approved",
    description: "Treatment plan approved. Ready for active treatment.",
    metadata: { caseStatus: "approved", reviewDurationMin: 18 },
  },
  {
    id: "aud-006",
    timestamp: "2026-06-23T11:24:00Z",
    actor: "Dr. Lee",
    actorRole: "Clinical Director",
    eventType: "status_changed",
    description: "Case moved to Clinical Review.",
    metadata: { from: "scan_review", to: "clinical_review" },
  },
  {
    id: "aud-005",
    timestamp: "2026-06-23T10:55:00Z",
    actor: "T. Williams",
    actorRole: "Treatment Coordinator",
    eventType: "status_changed",
    description: "Case submitted for clinical review.",
    metadata: { from: "draft", to: "scan_review" },
  },
  {
    id: "aud-004",
    timestamp: "2026-06-23T10:41:00Z",
    actor: "T. Williams",
    actorRole: "Treatment Coordinator",
    eventType: "measurement_created",
    description: "Distance measurement A→B recorded.",
    metadata: { measureType: "distance", value: "8.34 mm", points: 2 },
  },
  {
    id: "aud-003",
    timestamp: "2026-06-23T10:38:00Z",
    actor: "T. Williams",
    actorRole: "Treatment Coordinator",
    eventType: "treatment_modified",
    description: "Tooth 21 translation updated: +1.2 mm mesial.",
    metadata: { toothId: "21", axis: "mesial", delta: 1.2 },
  },
  {
    id: "aud-002",
    timestamp: "2026-06-23T10:22:00Z",
    actor: "T. Williams",
    actorRole: "Treatment Coordinator",
    eventType: "file_uploaded",
    description: "Upper arch STL scan uploaded (2.4 MB).",
    metadata: { fileName: "upper-arch-scan.stl", sizeBytes: 2516582, format: "STL" },
  },
  {
    id: "aud-001",
    timestamp: "2026-06-23T09:55:00Z",
    actor: "T. Williams",
    actorRole: "Treatment Coordinator",
    eventType: "case_created",
    description: "Case DEMO-001 created. Patient: Sample Patient.",
    metadata: { caseId: "DEMO-001", malocclusionClass: "Class I", crowding: "moderate" },
  },
];

function formatTs(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function AuditRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const meta = EVENT_META[entry.eventType];
  const hasMetadata = entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <li className="group relative flex gap-3">
      <div className="flex flex-col items-center pt-0.5">
        <span
          className={[
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px]",
            meta.tone === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
            meta.tone === "danger"  ? "border-rose-500/30 bg-rose-500/10 text-rose-400" :
            meta.tone === "warning" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" :
            meta.tone === "primary" ? "border-teal-500/30 bg-teal-500/10 text-teal-400" :
            meta.tone === "info"    ? "border-blue-500/30 bg-blue-500/10 text-blue-400" :
            "border-border bg-card text-secondary",
          ].join(" ")}
          aria-hidden
        >
          {meta.icon}
        </span>
        <div className="mt-1 h-full w-px bg-border/40 group-last:hidden" />
      </div>

      <div className="min-w-0 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          <span className="text-[10px] font-mono text-secondary">{formatTs(entry.timestamp)}</span>
        </div>
        <p className="mt-1 text-sm text-foreground">{entry.description}</p>
        <p className="mt-0.5 text-xs text-secondary">
          {entry.actor} · <span className="italic">{entry.actorRole}</span>
        </p>

        {hasMetadata && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-secondary hover:text-foreground focus-ring rounded"
              aria-expanded={expanded}
            >
              {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              Metadata
            </button>
            {expanded && (
              <pre className="mt-1.5 overflow-x-auto rounded-lg border border-border bg-slate-950/60 px-3 py-2 text-[10px] leading-5 text-slate-300">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

interface AuditTrailProps {
  caseId?: string;
  entries?: AuditEntry[];
  isLive?: boolean;
}

export default function AuditTrail({ caseId = "DEMO-001", entries, isLive = false }: AuditTrailProps) {
  const [filter, setFilter] = useState<AuditEventType | "all">("all");
  const [loading] = useState(false);

  const allEntries = entries ?? SEED_ENTRIES;
  const visible = filter === "all" ? allEntries : allEntries.filter((e) => e.eventType === filter);

  const categoryCounts = ALL_EVENT_TYPES.reduce<Record<string, number>>((acc, t) => {
    acc[t] = allEntries.filter((e) => e.eventType === t).length;
    return acc;
  }, {});

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Case {caseId}</p>
          <h3 className="mt-0.5 text-base font-semibold text-foreground">Audit Trail</h3>
          <p className="mt-0.5 text-xs text-secondary">
            FDA/MDR-style event log · {allEntries.length} event{allEntries.length !== 1 ? "s" : ""}
          </p>
        </div>
        {!isLive && (
          <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-400">
            <ShieldAlert size={10} />
            Representative data · not live
          </span>
        )}
      </div>

      {/* Event type filter */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={[
            "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition focus-ring",
            filter === "all"
              ? "border-teal-500/40 bg-teal-500/15 text-teal-300"
              : "border-border text-secondary hover:text-foreground",
          ].join(" ")}
        >
          All ({allEntries.length})
        </button>
        {ALL_EVENT_TYPES.filter((t) => (categoryCounts[t] ?? 0) > 0).map((t) => {
          const meta = EVENT_META[t];
          return (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={[
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition focus-ring",
                filter === t
                  ? "border-teal-500/40 bg-teal-500/15 text-teal-300"
                  : "border-border text-secondary hover:text-foreground",
              ].join(" ")}
            >
              {meta.label} ({categoryCounts[t]})
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <SkeletonBlock className="h-6 w-6 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonBlock className="h-4 w-28" />
                  <SkeletonBlock className="h-3 w-48" />
                  <SkeletonBlock className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-secondary">
            No events match this filter.
          </p>
        ) : (
          <ul className="space-y-0">
            {visible.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            const rows = allEntries.map(
              (e) =>
                `${e.timestamp},${e.actor},${e.actorRole},${e.eventType},${JSON.stringify(e.description)}`
            );
            const csv = `timestamp,actor,role,event_type,description\n${rows.join("\n")}`;
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `audit-trail-${caseId}.csv`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
          disabled={allEntries.length === 0}
        >
          Export CSV
        </Button>
      </div>
    </Card>
  );
}
