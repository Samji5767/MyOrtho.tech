"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, BarChart3, FileText, Shield, Download,
  RefreshCw, AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastContext";
import { Card, SkeletonBlock } from "@/components/DesignSystem";
import { getPracticeSummary, type PracticeSummaryReport } from "@/lib/api/reports";
import { api } from "@/lib/api/client";

const ADMIN_ROLES = ["admin", "super_admin"];

const PERIOD_OPTIONS = [
  { value: "last_30_days",   label: "Last 30 days" },
  { value: "last_90_days",   label: "Last 90 days" },
  { value: "last_12_months", label: "Last 12 months" },
  { value: "all",            label: "All time" },
];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft", scan_review: "Scan Review", segmentation: "Segmentation",
  planning: "Planning", clinical_review: "Clinical Review", approved: "Approved",
  active_treatment: "Active Treatment", monitoring: "Monitoring",
  retention: "Retention", completed: "Completed", archived: "Archived",
};

type TabId = "summary" | "cases" | "audit";

function SummaryTab({ period }: { period: string }) {
  const [data, setData] = useState<PracticeSummaryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const report = await getPracticeSummary(period);
      setData(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-pulse">
        {[...Array(6)].map((_, i) => <div key={i} className="h-24 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]" />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-6 text-center dark:border-amber-700/30 dark:bg-amber-900/10">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-amber-500" />
        <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{error}</p>
        <button onClick={() => void load()} className="mt-3 text-xs font-semibold underline text-amber-700 dark:text-amber-400">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const topStatuses = Object.entries(data.cases.byStatus)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* KPI tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { label: "Total Cases", value: data.cases.total, sub: "all time" },
          { label: "New Cases", value: data.cases.newThisMonth, sub: "in period" },
          { label: "Completed", value: data.cases.completedThisMonth, sub: "in period" },
          { label: "Total Patients", value: data.patients.total, sub: "all time" },
          { label: "New Patients", value: data.patients.newThisMonth, sub: "in period" },
          { label: "Active Locations", value: data.locations, sub: "clinic sites" },
        ].map((tile) => (
          <Card key={tile.label} className="p-4">
            <p className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">{tile.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-[color:var(--foreground)]">{tile.label}</p>
            <p className="text-[10px] text-[color:var(--muted-foreground)]">{tile.sub}</p>
          </Card>
        ))}
      </div>

      {/* Status breakdown */}
      {topStatuses.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-[color:var(--foreground)]">Cases by Status</h3>
          <div className="space-y-3">
            {topStatuses.map(([status, count]) => {
              const pct = Math.round((count / Math.max(data.cases.total, 1)) * 100);
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-[11px] text-[color:var(--muted-foreground)] truncate">
                    {STATUS_LABELS[status] ?? status}
                  </span>
                  <div className="flex-1 h-2 overflow-hidden rounded-full bg-[color:var(--border)]/40">
                    <div className="h-full rounded-full bg-[color:var(--primary)] transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-[11px] font-semibold tabular-nums text-[color:var(--foreground)]">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <p className="text-[11px] text-[color:var(--muted-foreground)]">
        Generated {new Date(data.generatedAt).toLocaleString()} · Period: {new Date(data.period.from).toLocaleDateString()} – {new Date(data.period.to).toLocaleDateString()}
      </p>
    </div>
  );
}

function CasesExportTab({ period, onPeriodChange }: { period: string; onPeriodChange: (p: string) => void }) {
  const { toast } = useToast();
  const [downloading, setDownloading] = useState(false);

  const downloadCSV = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/reports/cases/csv${period !== "all" ? `?period=${period}` : ""}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `myortho-cases-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV downloaded", type: "success" });
    } catch (err) {
      toast({ title: "Download failed", description: err instanceof Error ? err.message : "Unknown error", type: "error" });
    } finally {
      setDownloading(false);
    }
  };

  const downloadJSON = async () => {
    setDownloading(true);
    try {
      const data = await api.get<unknown[]>("/api/cases?limit=2000");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `myortho-cases-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "JSON downloaded", type: "success" });
    } catch (err) {
      toast({ title: "Download failed", description: err instanceof Error ? err.message : "Unknown error", type: "error" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-xs text-amber-700 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-400">
        <strong>PHI Notice:</strong> Case exports contain protected health information. Handle in accordance with your HIPAA policies. Do not share or store in unencrypted locations.
      </div>

      <Card className="p-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[color:var(--foreground)] mb-1">Export period</label>
          <select
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40"
          >
            {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => void downloadCSV()}
            disabled={downloading}
            className="flex items-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Download size={14} /> {downloading ? "Downloading…" : "Export CSV"}
          </button>
          <button
            onClick={() => void downloadJSON()}
            disabled={downloading}
            className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--border)]/40 disabled:opacity-50 transition-colors"
          >
            <FileText size={14} /> Export JSON
          </button>
        </div>
      </Card>
    </div>
  );
}

function AuditExportTab() {
  const { toast } = useToast();
  interface AuditEntry { id: string; actorEmail: string; action: string; resourceType: string; resourceId: string; createdAt: string }
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<AuditEntry[]>("/api/audit?limit=100")
      .then((data) => setEntries(data))
      .catch(() => { /* audit is non-critical */ })
      .finally(() => setLoading(false));
  }, []);

  const downloadAuditCSV = async () => {
    try {
      const res = await fetch("/api/audit/export?format=csv", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `myortho-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Audit log downloaded", type: "success" });
    } catch (err) {
      toast({ title: "Download failed", description: err instanceof Error ? err.message : "Unknown error", type: "error" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => void downloadAuditCSV()}
          className="flex items-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Download size={14} /> Download Audit Log (CSV)
        </button>
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(5)].map((_, i) => <SkeletonBlock key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-[color:var(--muted-foreground)]">No audit entries available.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
          <table className="w-full text-xs">
            <thead className="border-b border-[color:var(--border)] bg-[color:var(--card)]">
              <tr>
                {["Timestamp", "Actor", "Action", "Resource", "ID"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-[color:var(--muted-foreground)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--border)]">
              {entries.map((e) => (
                <tr key={e.id} className="bg-[color:var(--background)] hover:bg-[color:var(--card)]">
                  <td className="px-4 py-2.5 tabular-nums text-[color:var(--muted-foreground)]">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-[color:var(--foreground)]">{e.actorEmail}</td>
                  <td className="px-4 py-2.5 font-mono text-[color:var(--foreground)]">{e.action}</td>
                  <td className="px-4 py-2.5 text-[color:var(--muted-foreground)]">{e.resourceType}</td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-[color:var(--muted-foreground)] truncate max-w-[120px]">
                    {e.resourceId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminReportsPage() {
  const { status, user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [period, setPeriod] = useState("last_30_days");

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !user || !ADMIN_ROLES.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [status, user, router]);

  if (status === "loading" || !user || !ADMIN_ROLES.includes(user.role)) return null;

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "summary",  label: "Practice Summary", icon: BarChart3 },
    { id: "cases",    label: "Case Export",       icon: Download },
    { id: "audit",    label: "Audit Export",      icon: Shield },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:opacity-80 transition-opacity"
          aria-label="Back to admin"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">Reports</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">Practice reports and data exports</p>
        </div>
        {activeTab === "summary" && (
          <div className="ml-auto">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1.5 text-xs text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40"
            >
              {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
              activeTab === id
                ? "bg-[color:var(--primary)] text-white shadow-sm"
                : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--border)]/40"
            }`}
          >
            <Icon size={13} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {activeTab === "summary" && <SummaryTab period={period} />}
      {activeTab === "cases" && <CasesExportTab period={period} onPeriodChange={setPeriod} />}
      {activeTab === "audit" && <AuditExportTab />}
    </div>
  );
}
