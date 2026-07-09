'use client';
import { useState, useEffect, useCallback } from 'react';
import { Activity, CheckCircle, XCircle, Database, Zap, RefreshCw, Server } from 'lucide-react';

interface ModuleHealthStatus {
  module: string; tableCount: number; recordCount: number; status: 'ok' | 'empty' | 'error';
}
interface PlatformHealthReport {
  timestamp: string;
  databaseConnected: boolean;
  redisConnected: boolean;
  modules: ModuleHealthStatus[];
  totalTables: number;
  totalRecords: number;
  phasesCovered: number;
  maturityScore: number;
}

interface Props { token?: string }

export default function PlatformHealthPanel(_props: Props) {
  const [report, setReport] = useState<PlatformHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/platform-health', { credentials: 'include' });
      if (!r.ok) throw new Error(`Server returned ${r.status}`);
      setReport(await r.json() as PlatformHealthReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load platform health');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 w-48 rounded bg-[color:var(--border)] opacity-60" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 rounded-xl border border-[color:var(--border)] opacity-60" />
          ))}
        </div>
        <div className="h-24 rounded-xl border border-[color:var(--border)] opacity-50" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
        {error ?? 'Failed to load platform health'}
        <button
          onClick={load}
          className="ml-3 underline hover:no-underline text-rose-600 dark:text-rose-400"
        >
          Retry
        </button>
      </div>
    );
  }

  const okModules = report.modules.filter(m => m.status === 'ok');
  const errorModules = report.modules.filter(m => m.status === 'error');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[color:var(--foreground)] flex items-center gap-2">
            <Server size={16} className="text-[color:var(--primary)]" />
            Platform Health
          </h3>
          <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">
            Last checked: {new Date(report.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={load}
          aria-label="Refresh"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Core status tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatusTile
          icon={<Database size={18} />}
          label="PostgreSQL"
          value={report.databaseConnected ? 'Connected' : 'Disconnected'}
          tone={report.databaseConnected ? 'success' : 'danger'}
        />
        <StatusTile
          icon={<Zap size={18} />}
          label="Redis"
          value={report.redisConnected ? 'Connected' : 'Not configured'}
          tone={report.redisConnected ? 'success' : 'neutral'}
        />
        <StatusTile
          icon={<Activity size={18} />}
          label="Phases"
          value={String(report.phasesCovered)}
          tone="primary"
        />
        <StatusTile
          icon={<CheckCircle size={18} />}
          label="Maturity"
          value={`${report.maturityScore}%`}
          tone={report.maturityScore >= 80 ? 'success' : report.maturityScore >= 50 ? 'warning' : 'danger'}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
          <p className="text-2xl font-bold text-[color:var(--foreground)]">{report.totalTables}</p>
          <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">Database Tables</p>
        </div>
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
          <p className="text-2xl font-bold text-[color:var(--foreground)]">{report.totalRecords.toLocaleString()}</p>
          <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">Total Records</p>
        </div>
      </div>

      {/* Coverage progress bar */}
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-[color:var(--foreground)]">Platform Coverage</p>
          <p className="text-sm font-bold text-[color:var(--foreground)]">
            {okModules.length} / {report.modules.length} modules
          </p>
        </div>
        <div className="w-full bg-[color-mix(in_srgb,var(--border)_60%,transparent)] rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full bg-gradient-to-r from-[color:var(--primary)] to-emerald-500 transition-all duration-700"
            style={{ width: `${report.maturityScore}%` }}
          />
        </div>
        <p className="text-xs text-[color:var(--muted-foreground)] mt-2">
          {report.maturityScore}% of platform modules verified operational
        </p>
      </div>

      {/* Module table */}
      <div className="rounded-xl border border-[color:var(--border)] overflow-hidden bg-[color:var(--card)]">
        <div className="px-4 py-3 border-b border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_40%,var(--background)_60%)]">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">Module Status</p>
        </div>
        <div className="divide-y divide-[color:var(--border)] max-h-96 overflow-y-auto">
          {report.modules.map(m => (
            <div key={m.module} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                {m.status === 'ok' ? (
                  <CheckCircle size={13} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <XCircle size={13} className="text-rose-400 flex-shrink-0" />
                )}
                <p className="text-sm text-[color:var(--foreground)] truncate">{m.module}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                {m.status === 'ok' ? (
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {m.recordCount} record{m.recordCount !== 1 ? 's' : ''}
                  </p>
                ) : (
                  <p className="text-xs text-rose-500">Table missing</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Error notice */}
      {errorModules.length > 0 && (
        <div className="rounded-xl border border-rose-200/60 bg-rose-50/60 p-4 dark:border-rose-700/30 dark:bg-rose-900/10">
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-400 mb-1">
            {errorModules.length} module{errorModules.length !== 1 ? 's' : ''} need database migration
          </p>
          <p className="text-xs text-rose-600 dark:text-rose-500">
            Run migrations 026 and 027 to provision all tables for full platform coverage.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Stat tile helper ──────────────────────────────────────────────────────────

function StatusTile({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'success' | 'danger' | 'warning' | 'primary' | 'neutral';
}) {
  const colors: Record<string, string> = {
    success: 'border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-700/30 dark:bg-emerald-900/10',
    danger:  'border-rose-200/60 bg-rose-50/60 dark:border-rose-700/30 dark:bg-rose-900/10',
    warning: 'border-amber-200/60 bg-amber-50/60 dark:border-amber-700/30 dark:bg-amber-900/10',
    primary: 'border-[color:var(--primary)]/20 bg-[color:var(--primary-glow)]',
    neutral: 'border-[color:var(--border)] bg-[color:var(--card)]',
  };
  const iconColors: Record<string, string> = {
    success: 'text-emerald-600 dark:text-emerald-400',
    danger:  'text-rose-500',
    warning: 'text-amber-600 dark:text-amber-400',
    primary: 'text-[color:var(--primary)]',
    neutral: 'text-[color:var(--muted-foreground)]',
  };
  const valueColors: Record<string, string> = {
    success: 'text-emerald-700 dark:text-emerald-300',
    danger:  'text-rose-700 dark:text-rose-400',
    warning: 'text-amber-700 dark:text-amber-300',
    primary: 'text-[color:var(--primary)]',
    neutral: 'text-[color:var(--muted-foreground)]',
  };
  return (
    <div className={`rounded-xl border p-4 text-center ${colors[tone]}`}>
      <span className={`mx-auto mb-1 block w-fit ${iconColors[tone]}`}>{icon}</span>
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{label}</p>
      <p className={`text-base font-bold mt-0.5 ${valueColors[tone]}`}>{value}</p>
    </div>
  );
}
