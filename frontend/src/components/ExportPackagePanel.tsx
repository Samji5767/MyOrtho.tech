'use client';

import React, { useState, useCallback } from 'react';
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
  draft:     'bg-gray-100 text-gray-700 border-gray-300',
  validated: 'bg-blue-100 text-blue-700 border-blue-300',
  approved:  'bg-green-100 text-green-700 border-green-300',
  exported:  'bg-emerald-100 text-emerald-700 border-emerald-300',
  failed:    'bg-red-100 text-red-700 border-red-300',
};

const CHECK_STATUS_ICON: Record<string, string> = {
  passed:  '✓',
  failed:  '✗',
  warning: '⚠',
  skipped: '—',
  pending: '·',
};

const CHECK_STATUS_COLOR: Record<string, string> = {
  passed:  'text-green-700',
  failed:  'text-red-700',
  warning: 'text-amber-600',
  skipped: 'text-gray-400',
  pending: 'text-gray-400',
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
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
            {MODULE_LABELS[mod] ?? mod}
          </p>
          <ul className="space-y-0.5">
            {(byModule.get(mod) ?? []).map(item => (
              <li key={item.id} className="flex items-start gap-2 text-xs">
                <span className={`font-mono font-bold shrink-0 w-4 text-center ${CHECK_STATUS_COLOR[item.status]}`}>
                  {CHECK_STATUS_ICON[item.status]}
                </span>
                <span className={item.isBlocking && item.status === 'failed' ? 'font-semibold text-red-800' : 'text-gray-700'}>
                  {item.checkLabel}
                  {item.isBlocking && (
                    <span className="ml-1 text-[10px] text-red-600">(blocking)</span>
                  )}
                </span>
                {item.message && (
                  <span className="text-gray-400 text-[10px] shrink-0 ml-auto">{item.message}</span>
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
    <div className="rounded border border-gray-200 bg-white">
      <div className="p-3 flex items-start gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-900">
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
              <span className="text-[10px] text-green-700">{passCount} passed</span>
              {failCount > 0 && <span className="text-[10px] text-red-700">{failCount} failed</span>}
              {warnCount > 0 && <span className="text-[10px] text-amber-600">{warnCount} warnings</span>}
              <span className="text-[10px] text-gray-400">of {totalCount} checks</span>
            </div>
          )}

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="flex h-1.5 gap-0.5 mt-1.5 rounded-full overflow-hidden bg-gray-100">
              <div className="bg-green-500 h-full" style={{ width: `${(passCount / totalCount) * 100}%` }} />
              <div className="bg-amber-400 h-full" style={{ width: `${(warnCount / totalCount) * 100}%` }} />
              <div className="bg-red-500 h-full" style={{ width: `${(failCount / totalCount) * 100}%` }} />
            </div>
          )}
        </div>

        <div className="flex gap-1 shrink-0">
          {pkg.status === 'draft' && (
            <button
              onClick={() => act(() => validateExportPackage(caseId, planId, pkg.id))}
              disabled={loading}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Validate
            </button>
          )}
          {pkg.status === 'validated' && (
            <button
              onClick={() => act(() => approveExportPackage(caseId, planId, pkg.id))}
              disabled={loading}
              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Approve
            </button>
          )}
          {pkg.status === 'approved' && (
            <button
              onClick={() => act(() => markExported(caseId, planId, pkg.id, 'zip', 1024 * 1024))}
              disabled={loading}
              className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50"
            >
              Mark Exported
            </button>
          )}
          {totalCount > 0 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="px-2 py-1 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50"
            >
              {expanded ? 'Hide' : 'Details'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-3 mb-2 text-xs text-red-700 bg-red-50 rounded p-2 border border-red-200">
          {error}
        </div>
      )}

      {expanded && totalCount > 0 && (
        <div className="border-t border-gray-100 p-3">
          <ChecklistView items={pkg.validationResults} />
        </div>
      )}

      {pkg.checksumSha256 && (
        <div className="border-t border-gray-100 px-3 py-1.5">
          <p className="text-[10px] text-gray-400 font-mono truncate">SHA-256: {pkg.checksumSha256}</p>
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
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Clinical Export Package</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Structured export bundles with 14-check validation gate and clinician approval
        </p>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 rounded p-3 border border-red-200">
            {error}
          </div>
        )}

        {/* Create new package */}
        <div className="flex items-center gap-3">
          <select
            value={selectedType}
            onChange={e => setSelectedType(e.target.value as ExportType)}
            className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white text-gray-800"
          >
            {EXPORT_TYPES.map(t => (
              <option key={t} value={t}>{EXPORT_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating…' : 'Create Package'}
          </button>
          <button
            onClick={loadPackages}
            disabled={loading}
            className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
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

        {packages.length === 0 && !loading && (
          <p className="text-xs text-gray-500 italic">
            Select an export type and click "Create Package" to begin the validation workflow.
          </p>
        )}

        {/* Workflow explanation */}
        <div className="rounded border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
          <p className="font-semibold text-gray-700">Export workflow</p>
          <p>1. <strong>Create</strong> — select export type and create checklist</p>
          <p>2. <strong>Validate</strong> — run all checks against current plan data</p>
          <p>3. <strong>Approve</strong> — clinician signs off (requires validated status)</p>
          <p>4. <strong>Export</strong> — mark as exported with format and checksum</p>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border-t border-gray-200 px-4 py-2">
        <p className="text-xs text-amber-700">
          Clinician approval is required before export. Validated packages with blocking failures cannot be approved until issues are resolved.
        </p>
      </div>
    </div>
  );
}
