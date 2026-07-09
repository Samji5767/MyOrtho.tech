'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  createExportPackage,
  listExportPackages,
  validateExportPackage,
  approveExportPackage,
  markExported,
  ExportPackage,
  ExportType,
  ChecklistItem,
  EXPORT_TYPE_LABELS,
} from '@/lib/api/export-package';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  draft:     'bg-[color:var(--card)] text-[color:var(--muted-foreground)] border-[color:var(--border)]',
  validated: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-300/50',
  approved:  'bg-[color:var(--primary-glow)] text-[color:var(--primary)] border-[color:var(--primary)]/30',
  exported:  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300/50',
  failed:    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-300/50',
};

const CHECK_STATUS_ICON: Record<string, string> = {
  passed:  '✓',
  failed:  '✗',
  warning: '⚠',
  skipped: '—',
  pending: '·',
};

const CHECK_STATUS_COLOR: Record<string, string> = {
  passed:  'text-[color:var(--clinical-safe)]',
  failed:  'text-[color:var(--clinical-danger)]',
  warning: 'text-[color:var(--clinical-warn)]',
  skipped: 'text-[color:var(--muted-foreground)]',
  pending: 'text-[color:var(--muted-foreground)]',
};

const MODULE_ORDER = [
  'treatment_plans', 'prescriptions', 'aligner_generation', 'segmentation',
  'attachments', 'ipr', 'simulation', 'pdl', 'retention', 'arch_coordination', 'copilot',
];

const MODULE_LABELS: Record<string, string> = {
  treatment_plans:   'Treatment Plan',
  prescriptions:     'Movement Prescriptions',
  aligner_generation:'Aligner Generation',
  segmentation:      'Segmentation',
  attachments:       'Attachments',
  ipr:               'IPR',
  simulation:        'Simulation',
  pdl:               'PDL Analysis',
  retention:         'Retention',
  arch_coordination: 'Arch Coordination',
  copilot:           'Clinical Copilot',
};

const EXPORT_TYPES: ExportType[] = [
  'lab_full', 'aligner_stl', 'treatment_summary', 'patient_instructions', 'insurance_report',
];

// ─── Checklist component ──────────────────────────────────────────────────────

function ChecklistView({ items }: { items: ChecklistItem[] }) {
  const byModule = new Map<string, ChecklistItem[]>();
  for (const item of items) {
    const list = byModule.get(item.module) ?? [];
    list.push(item);
    byModule.set(item.module, list);
  }

  const orderedModules = [
    ...MODULE_ORDER.filter(m => byModule.has(m)),
    ...Array.from(byModule.keys()).filter(m => !MODULE_ORDER.includes(m)),
  ];

  return (
    <div className="space-y-3">
      {orderedModules.map(mod => (
        <div key={mod}>
          <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide mb-1">
            {MODULE_LABELS[mod] ?? mod}
          </p>
          <ul className="space-y-0.5">
            {(byModule.get(mod) ?? []).map(item => (
              <li key={item.id} className="flex items-start gap-2 text-xs">
                <span className={`font-mono font-bold shrink-0 w-4 text-center ${CHECK_STATUS_COLOR[item.status]}`}>
                  {CHECK_STATUS_ICON[item.status]}
                </span>
                <span className={item.isBlocking && item.status === 'failed' ? 'font-semibold text-[color:var(--clinical-danger)]' : 'text-[color:var(--foreground)]'}>
                  {item.checkLabel}
                  {item.isBlocking && (
                    <span className="ml-1 text-[10px] text-[color:var(--clinical-danger)]">(blocking)</span>
                  )}
                </span>
                {item.message && (
                  <span className="text-[color:var(--muted-foreground)] text-[10px] shrink-0 ml-auto">{item.message}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// ─── Package card ─────────────────────────────────────────────────────────────

function PackageCard({
  pkg,
  caseId,
  planId,
  onUpdate,
}: {
  pkg: ExportPackage;
  caseId: string;
  planId: string;
  onUpdate: (updated: ExportPackage) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const passCount  = pkg.validationResults.filter(i => i.status === 'passed').length;
  const failCount  = pkg.validationResults.filter(i => i.status === 'failed').length;
  const warnCount  = pkg.validationResults.filter(i => i.status === 'warning').length;
  const totalCount = pkg.validationResults.length;

  const act = async (fn: () => Promise<ExportPackage>) => {
    setLoading(true); setError(null);
    try {
      onUpdate(await fn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]">
      <div className="p-3 flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[color:var(--foreground)]">
              {EXPORT_TYPE_LABELS[pkg.exportType]}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold capitalize ${STATUS_STYLE[pkg.status]}`}>
              {pkg.status}
            </span>
            {pkg.exportedAt && (
              <span className="text-[10px] text-gray-400">
                Exported {new Date(pkg.exportedAt).toLocaleDateString()}
              </span>
            )}
          </div>

          {totalCount > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-[color:var(--clinical-safe)]">{passCount} passed</span>
              {failCount > 0 && <span className="text-[10px] text-[color:var(--clinical-danger)]">{failCount} failed</span>}
              {warnCount > 0 && <span className="text-[10px] text-[color:var(--clinical-warn)]">{warnCount} warnings</span>}
              <span className="text-[10px] text-[color:var(--muted-foreground)]">of {totalCount} checks</span>
            </div>
          )}

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="flex h-1.5 gap-0.5 mt-1.5 rounded-full overflow-hidden bg-[color:var(--border)]">
              <div className="h-full bg-[color:var(--clinical-safe)]" style={{ width: `${(passCount / totalCount) * 100}%` }} />
              <div className="h-full bg-[color:var(--clinical-warn)]" style={{ width: `${(warnCount / totalCount) * 100}%` }} />
              <div className="h-full bg-[color:var(--clinical-danger)]" style={{ width: `${(failCount / totalCount) * 100}%` }} />
            </div>
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          {pkg.status === 'draft' && (
            <button
              onClick={() => act(() => validateExportPackage(caseId, planId, pkg.id))}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                </svg>
              )}
              {loading ? 'Validating…' : 'Validate'}
            </button>
          )}
          {pkg.status === 'validated' && (
            <button
              onClick={() => act(() => approveExportPackage(caseId, planId, pkg.id))}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-[color:var(--clinical-safe)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                </svg>
              )}
              {loading ? 'Approving…' : 'Approve'}
            </button>
          )}
          {pkg.status === 'approved' && (
            <button
              onClick={() => act(() => markExported(caseId, planId, pkg.id, 'zip', 1024 * 1024))}
              disabled={loading}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && (
                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                </svg>
              )}
              {loading ? 'Exporting…' : 'Mark Exported'}
            </button>
          )}
          {totalCount > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="px-2 py-1 text-xs border border-[color:var(--border)] text-[color:var(--muted-foreground)] rounded-lg hover:text-[color:var(--foreground)] hover:bg-[color:var(--card)]"
            >
              {expanded ? 'Hide' : 'Details'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-3 mb-2 text-xs text-[color:var(--clinical-danger)] bg-[color:var(--clinical-danger-tint)]/20 rounded-lg p-2 border border-[color:var(--clinical-danger)]/20">
          {error}
        </div>
      )}

      {expanded && totalCount > 0 && (
        <div className="border-t border-[color:var(--border)] p-3">
          <ChecklistView items={pkg.validationResults} />
        </div>
      )}

      {pkg.checksumSha256 && (
        <div className="border-t border-[color:var(--border)] px-3 py-1.5">
          <p className="text-[10px] text-[color:var(--muted-foreground)] font-mono truncate">SHA-256: {pkg.checksumSha256}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

export default function ExportPackagePanel({ caseId, planId }: Props) {
  const [packages, setPackages] = useState<ExportPackage[]>([]);
  const [selectedType, setSelectedType] = useState<ExportType>('lab_full');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPackages = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const pkgs = await listExportPackages(caseId, planId);
      setPackages(pkgs);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  useEffect(() => { loadPackages(); }, [loadPackages]);

  const handleCreate = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const pkg = await createExportPackage(caseId, planId, selectedType);
      setPackages(prev => [pkg, ...prev]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId, selectedType]);

  const handleUpdate = useCallback((updated: ExportPackage) => {
    setPackages(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, []);

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-[var(--shadow-sm)]">
      {/* Header */}
      <div className="border-b border-[color:var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Clinical Export Package</h2>
        <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">
          Structured export bundles with 14-check validation gate and clinician approval
        </p>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="text-xs text-[color:var(--clinical-danger)] bg-rose-500/10 rounded-xl p-3 border border-rose-500/20">
            {error}
          </div>
        )}

        {/* Create new package */}
        <div className="flex items-center gap-3">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value as ExportType)}
            className="text-xs border border-[color:var(--border)] rounded-lg px-2 py-1.5 bg-[color:var(--card)] text-[color:var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
          >
            {EXPORT_TYPES.map(t => (
              <option key={t} value={t}>{EXPORT_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-[color:var(--primary)] text-[color:var(--primary-foreground)] rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Package'}
          </button>
          <button
            onClick={loadPackages}
            disabled={loading}
            className="px-3 py-1.5 text-xs border border-[color:var(--border)] text-[color:var(--muted-foreground)] rounded-lg hover:text-[color:var(--foreground)] disabled:opacity-50"
          >
            {loading ? '…' : 'Refresh'}
          </button>
        </div>

        {/* Package list */}
        {packages.length > 0 && (
          <div className="space-y-2">
            {packages.map(pkg => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                caseId={caseId}
                planId={planId}
                onUpdate={handleUpdate}
              />
            ))}
          </div>
        )}

        {loading && packages.length === 0 && (
          <div className="space-y-2" aria-busy="true" aria-label="Loading export packages">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-14 w-full rounded-xl bg-[color:var(--border)] animate-pulse"
              />
            ))}
          </div>
        )}

        {packages.length === 0 && !loading && (
          <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center space-y-1.5">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">No export packages yet</p>
            <p className="text-xs text-[color:var(--muted-foreground)]">
              Select an export type above and click <strong>Create Package</strong> to start the validation workflow.
            </p>
          </div>
        )}

        {/* Workflow explanation */}
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--primary-glow)] p-3 text-xs text-[color:var(--muted-foreground)] space-y-1">
          <p className="font-semibold text-[color:var(--foreground)]">Export workflow</p>
          <p>1. <strong>Create</strong> — select export type and create checklist</p>
          <p>2. <strong>Validate</strong> — run all checks against current plan data</p>
          <p>3. <strong>Approve</strong> — clinician signs off (requires validated status)</p>
          <p>4. <strong>Export</strong> — mark as exported with format and checksum</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border-t border-[color:var(--border)] px-4 py-2">
        <p className="text-xs text-[color:var(--clinical-warn)]">
          Clinician approval is required before export. Validated packages with blocking failures cannot be approved until issues are resolved.
        </p>
      </div>
    </div>
  );
}
