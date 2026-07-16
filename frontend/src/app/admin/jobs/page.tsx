"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, RefreshCw, XCircle, Clock, CheckCircle2,
  AlertCircle, Loader2, SkipBack, Filter, Activity,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastContext";
import { Card, StatusBadge, SkeletonBlock } from "@/components/DesignSystem";
import { api } from "@/lib/api/client";

const ADMIN_ROLES = ["admin", "super_admin"];

interface BackgroundJob {
  id: string;
  jobType: string;
  status: string;
  priority: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  lastErrorCode: string | null;
  workerId: string | null;
  runAt: string;
  startedAt: string | null;
  completedAt: string | null;
  retryScheduledAt: string | null;
  createdAt: string;
}

interface JobStats {
  pending?: number;
  running?: number;
  completed?: number;
  failed?: number;
  dead_letter?: number;
  retry_scheduled?: number;
  cancelled?: number;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
  pending:          { label: "Pending",         icon: <Clock size={12} />,         cls: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300" },
  running:          { label: "Running",          icon: <Loader2 size={12} className="animate-spin" />, cls: "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300" },
  completed:        { label: "Completed",        icon: <CheckCircle2 size={12} />,  cls: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300" },
  failed:           { label: "Failed",           icon: <XCircle size={12} />,       cls: "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300" },
  dead_letter:      { label: "Dead Letter",      icon: <AlertCircle size={12} />,   cls: "text-red-900 bg-red-200 dark:bg-red-900/40 dark:text-red-200" },
  retry_scheduled:  { label: "Retry Scheduled",  icon: <SkipBack size={12} />,      cls: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300" },
  cancelled:        { label: "Cancelled",        icon: <XCircle size={12} />,       cls: "text-slate-500 bg-slate-50 dark:bg-slate-900 dark:text-slate-400" },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, icon: null, cls: "text-slate-600 bg-slate-100" };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const endTs = end ? new Date(end).getTime() : Date.now();
  const ms = endTs - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export default function AdminJobsPage() {
  const { status, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [jobs, setJobs] = useState<BackgroundJob[]>([]);
  const [stats, setStats] = useState<JobStats>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<BackgroundJob | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !user || !ADMIN_ROLES.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, status, router]);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const [jobsRes, statsRes] = await Promise.all([
        api.get<BackgroundJob[]>(`/api/background-jobs${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
        api.get<JobStats>("/api/background-jobs/stats"),
      ]);
      setJobs(jobsRes);
      setStats(statsRes);
    } catch (err: unknown) {
      toast({ title: "Load failed", description: (err as Error).message, type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => { load(); }, [load]);

  const cancelJob = async (id: string) => {
    setCancelling(id);
    try {
      await api.post(`/api/background-jobs/${id}/cancel`, {});
      toast({ title: "Job cancelled", type: "success" });
      await load(false);
      if (selected?.id === id) setSelected(null);
    } catch (err: unknown) {
      toast({ title: "Cancel failed", description: (err as Error).message, type: "error" });
    } finally {
      setCancelling(null);
    }
  };

  if (status === "loading" || !user) return null;

  const totalDlq = stats.dead_letter ?? 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                <Activity size={22} className="text-blue-600" />
                Background Jobs
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Monitor and manage the job queue</p>
            </div>
          </div>
          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
          {[
            { key: "pending",         label: "Pending",        cls: "text-slate-700 dark:text-slate-300" },
            { key: "running",         label: "Running",        cls: "text-blue-700 dark:text-blue-300" },
            { key: "retry_scheduled", label: "Retry",          cls: "text-amber-700 dark:text-amber-300" },
            { key: "completed",       label: "Completed",      cls: "text-emerald-700 dark:text-emerald-300" },
            { key: "failed",          label: "Failed",         cls: "text-red-600 dark:text-red-400" },
            { key: "dead_letter",     label: "Dead Letter",    cls: "text-red-800 dark:text-red-300" },
            { key: "cancelled",       label: "Cancelled",      cls: "text-slate-500 dark:text-slate-400" },
          ].map(({ key, label, cls }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(prev => prev === key ? "all" : key)}
              className={`bg-white dark:bg-gray-900 border rounded-lg p-3 text-center hover:shadow-sm transition-shadow ${
                statusFilter === key ? "border-blue-400 ring-1 ring-blue-400" : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className={`text-2xl font-bold ${cls}`}>
                {loading ? "—" : (stats[key as keyof JobStats] ?? 0)}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </button>
          ))}
        </div>

        {totalDlq > 0 && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <AlertCircle size={18} className="text-red-600 shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-300">
              <strong>{totalDlq} dead-letter job{totalDlq > 1 ? "s" : ""}</strong> require manual investigation.
              Dead-letter jobs have exhausted all retry attempts.
            </div>
          </div>
        )}

        <div className={`flex gap-6 ${selected ? "flex-col lg:flex-row" : ""}`}>
          {/* Job list */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <Filter size={14} className="text-gray-400" />
              <span className="text-sm text-gray-500">
                {statusFilter === "all" ? "All statuses" : `Filtered: ${STATUS_CONFIG[statusFilter]?.label ?? statusFilter}`}
              </span>
              {statusFilter !== "all" && (
                <button onClick={() => setStatusFilter("all")} className="text-xs text-blue-600 hover:underline">
                  Clear filter
                </button>
              )}
              <span className="ml-auto text-xs text-gray-400">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <SkeletonBlock key={i} className="h-16 rounded-lg" />)}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Activity size={32} className="mx-auto mb-3 opacity-40" />
                <p>No jobs found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => setSelected(prev => prev?.id === job.id ? null : job)}
                    className={`w-full text-left bg-white dark:bg-gray-900 border rounded-lg px-4 py-3 hover:shadow-sm transition-all ${
                      selected?.id === job.id
                        ? "border-blue-400 ring-1 ring-blue-200 dark:ring-blue-800"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <StatusChip status={job.status} />
                        <span className="font-mono text-sm text-gray-800 dark:text-gray-200 truncate">
                          {job.jobType}
                        </span>
                        <span className="text-xs text-gray-400 hidden sm:block">
                          #{job.id.slice(0, 8)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-xs text-gray-400 hidden md:block">
                          {job.attempts}/{job.maxAttempts} attempts
                        </span>
                        <span className="text-xs text-gray-400">{fmtDate(job.runAt)}</span>
                      </div>
                    </div>
                    {job.error && (
                      <p className="mt-1.5 text-xs text-red-600 dark:text-red-400 truncate">{job.error}</p>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="lg:w-80 shrink-0">
              <Card className="sticky top-8">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-50">{selected.jobType}</h3>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{selected.id}</p>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400"
                  >
                    <XCircle size={16} />
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Status</span>
                    <StatusChip status={selected.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Priority</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200">{selected.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Attempts</span>
                    <span className="font-mono text-gray-800 dark:text-gray-200">{selected.attempts}/{selected.maxAttempts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Duration</span>
                    <span className="text-gray-800 dark:text-gray-200">{fmtDuration(selected.startedAt, selected.completedAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Scheduled</span>
                    <span className="text-gray-800 dark:text-gray-200">{fmtDate(selected.runAt)}</span>
                  </div>
                  {selected.startedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Started</span>
                      <span className="text-gray-800 dark:text-gray-200">{fmtDate(selected.startedAt)}</span>
                    </div>
                  )}
                  {selected.workerId && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Worker</span>
                      <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate max-w-[120px]">{selected.workerId}</span>
                    </div>
                  )}
                  {selected.lastErrorCode && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Error code</span>
                      <span className="font-mono text-xs text-red-600 dark:text-red-400">{selected.lastErrorCode}</span>
                    </div>
                  )}
                  {selected.error && (
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-xs text-gray-500 mb-1">Error</p>
                      <p className="text-xs text-red-600 dark:text-red-400 break-words">{selected.error}</p>
                    </div>
                  )}
                  {selected.retryScheduledAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Retry at</span>
                      <span className="text-amber-700 dark:text-amber-400">{fmtDate(selected.retryScheduledAt)}</span>
                    </div>
                  )}
                </div>

                {selected.status === "pending" && (
                  <button
                    onClick={() => cancelJob(selected.id)}
                    disabled={cancelling === selected.id}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50"
                  >
                    {cancelling === selected.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    Cancel Job
                  </button>
                )}
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
