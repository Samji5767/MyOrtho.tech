"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, CheckCircle2, Clock, MessageSquare,
  CheckCheck, ChevronDown,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastContext";
import { EmptyState, SkeletonBlock } from "@/components/DesignSystem";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";
import { api } from "@/lib/api/client";

const APPROVER_ROLES = ["clinical_director", "admin", "super_admin", "orthodontist"];

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

interface NotesRowState {
  open: boolean;
  text: string;
}

function ApprovalRow({
  item,
  onApprove,
  onNotes,
  processing,
}: {
  item: CaseListItem;
  onApprove: (id: string) => Promise<void>;
  onNotes: (id: string, notes: string) => Promise<void>;
  processing: string | null;
}) {
  const [notesState, setNotesState] = useState<NotesRowState>({ open: false, text: "" });
  const waiting = daysSince(item.updatedAt);
  const busy = processing === item.id;

  return (
    <li className="border-b border-[color:var(--border)] last:border-0">
      <div className="flex items-center gap-4 px-4 py-4">
        {/* Patient info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[color:var(--foreground)] truncate">
            {item.patient ? `${item.patient.firstName} ${item.patient.lastName}` : "Unknown Patient"}
          </p>
          {item.chiefComplaint && (
            <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)] truncate">{item.chiefComplaint}</p>
          )}
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[color:var(--muted-foreground)]">
            <Clock size={10} />
            Waiting {waiting === 0 ? "today" : `${waiting}d`}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void onApprove(item.id)}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            <CheckCheck size={13} />
            {busy ? "…" : "Approve"}
          </button>
          <button
            onClick={() => setNotesState((s) => ({ ...s, open: !s.open }))}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20 disabled:opacity-50 transition-colors"
          >
            <MessageSquare size={13} />
            Request Info
            {notesState.open ? <ChevronDown size={11} className="rotate-180" /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {notesState.open && (
        <div className="px-4 pb-4 space-y-2">
          <textarea
            rows={3}
            value={notesState.text}
            onChange={(e) => setNotesState((s) => ({ ...s, text: e.target.value }))}
            placeholder="Describe what additional information is needed…"
            className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder-[color:var(--muted-foreground)] resize-none focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => void onNotes(item.id, notesState.text)}
              disabled={busy || !notesState.text.trim()}
              className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {busy ? "Sending…" : "Send Request"}
            </button>
            <button
              onClick={() => setNotesState({ open: false, text: "" })}
              className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function ApprovalQueuePage() {
  const { status, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [queue, setQueue] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { cases } = await fetchCases();
      setQueue(cases.filter((c) => c.status === "clinical_review"));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !user) { router.replace("/login"); return; }
    if (!APPROVER_ROLES.includes(user.role)) { router.replace("/cases"); return; }
    void load();
  }, [status, user, router, load]);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      await api.post(`/api/cases/${id}/transition`, { toStatus: "approved" });
      setQueue((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Case approved", type: "success" });
    } catch (err) {
      toast({ title: "Approval failed", description: err instanceof Error ? err.message : "Unknown error", type: "error" });
    } finally {
      setProcessing(null);
    }
  };

  const handleRequestInfo = async (id: string, notes: string) => {
    setProcessing(id);
    try {
      await api.post(`/api/cases/${id}/transition`, { toStatus: "planning", notes });
      setQueue((prev) => prev.filter((c) => c.id !== id));
      toast({ title: "Request sent — case moved back to planning", type: "info" });
    } catch (err) {
      toast({ title: "Failed to send request", description: err instanceof Error ? err.message : "Unknown error", type: "error" });
    } finally {
      setProcessing(null);
    }
  };

  if (status === "loading") return null;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/cases"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:opacity-80 transition-opacity"
          aria-label="Back to cases"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">Approval Queue</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">Cases awaiting clinical review and approval</p>
        </div>
        {!loading && (
          <div className="ml-auto">
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {queue.length} pending
            </span>
          </div>
        )}
      </div>

      {loadError && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
          <span>{loadError}</span>
          <button onClick={() => void load()} className="ml-auto text-xs font-semibold underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] divide-y divide-[color:var(--border)]">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-4 animate-pulse">
              <div className="flex-1 space-y-2">
                <SkeletonBlock className="h-4 w-40" />
                <SkeletonBlock className="h-3 w-56" />
                <SkeletonBlock className="h-3 w-24" />
              </div>
              <SkeletonBlock className="h-8 w-20 rounded-lg" />
              <SkeletonBlock className="h-8 w-28 rounded-lg" />
            </div>
          ))}
        </div>
      ) : queue.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] py-16">
          <EmptyState
            icon={CheckCircle2}
            title="No cases pending approval"
            message="All cases in clinical review have been processed. Check back later or view all cases."
          />
        </div>
      ) : (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color:var(--card)]">
            <p className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">
              Patient — Chief Complaint — Days Waiting
            </p>
          </div>
          <ul role="list">
            {queue
              .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
              .map((item) => (
                <ApprovalRow
                  key={item.id}
                  item={item}
                  onApprove={handleApprove}
                  onNotes={handleRequestInfo}
                  processing={processing}
                />
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
