'use client';

import React, { useState, useCallback } from 'react';
import {
  generateRetentionProtocol,
  getWearSchedule,
  approveRetentionProtocol,
  RetentionProtocol,
  WearPhase,
  RelapseFactor,
} from '@/lib/api/retention';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RISK_STYLE: Record<string, string> = {
  low:       'bg-green-100 text-green-800 border-green-300',
  moderate:  'bg-amber-100 text-amber-800 border-amber-300',
  high:      'bg-orange-100 text-orange-800 border-orange-300',
  very_high: 'bg-red-100 text-red-800 border-red-300',
};

const RISK_LABEL: Record<string, string> = {
  low:       'Low Risk',
  moderate:  'Moderate Risk',
  high:      'High Risk',
  very_high: 'Very High Risk',
};

const RETAINER_LABELS: Record<string, string> = {
  essix_full:    'Essix Full-Coverage',
  essix_partial: 'Essix Partial',
  hawley:        'Hawley Retainer',
  fixed_lingual: 'Fixed Lingual Wire',
  vivera:        'Vivera Retainer',
  combo:         'Combo (Fixed + Removable)',
  none:          'None',
};

const FACTOR_LABELS: Record<string, string> = {
  severe_crowding:     'Severe Crowding',
  large_expansion:     'Large Expansion',
  rotation_correction: 'Multiple Rotations',
  class_ii_correction: 'Class II Correction',
  class_iii_correction:'Class III Correction',
  open_bite_correction:'Open Bite Correction',
  deep_bite_correction:'Deep Bite Correction',
  midline_shift:       'Midline Shift',
  skeletal_discrepancy:'Skeletal Discrepancy',
  bolton_discrepancy:  'Bolton Discrepancy',
  young_patient:       'Young Patient',
  compliance_risk:     'Compliance Risk',
};

function riskBar(score: number | null): JSX.Element {
  const pct = score != null ? Math.min(score * 100, 100) : 0;
  const color = pct < 25 ? 'bg-green-500' : pct < 50 ? 'bg-amber-400' : pct < 75 ? 'bg-orange-500' : 'bg-red-600';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-600">Relapse Risk Score</span>
        <span className="font-mono font-semibold">{score != null ? `${(score * 100).toFixed(0)}%` : '—'}</span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>Low</span><span>Moderate</span><span>High</span><span>Very High</span>
      </div>
    </div>
  );
}

// ─── Wear schedule timeline ───────────────────────────────────────────────────

function WearTimeline({ phases, totalMonths }: { phases: WearPhase[]; totalMonths: number }) {
  const COLORS = ['bg-blue-500', 'bg-blue-400', 'bg-blue-300', 'bg-blue-200'];
  return (
    <div className="space-y-2">
      <div className="relative h-8 rounded-lg overflow-hidden bg-gray-100">
        {phases.map((p, i) => {
          const left  = (p.startMonth / totalMonths) * 100;
          const width = ((p.endMonth - p.startMonth) / totalMonths) * 100;
          return (
            <div
              key={p.id}
              className={`absolute top-0 h-full ${COLORS[i] ?? 'bg-blue-100'} flex items-center justify-center text-[10px] text-white font-semibold`}
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`Phase ${p.phaseNum}: ${p.wearLabel} (month ${p.startMonth}–${p.endMonth})`}
            >
              {width > 10 ? `Ph ${p.phaseNum}` : ''}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>Month 0</span>
        {phases.map(p => (
          <span key={p.id}>M{p.endMonth}</span>
        ))}
      </div>

      {/* Phase detail list */}
      <div className="space-y-2 mt-2">
        {phases.map((p, i) => (
          <div key={p.id} className="flex gap-3 text-xs">
            <div className={`w-2 h-full rounded-sm mt-0.5 shrink-0 ${COLORS[i] ?? 'bg-blue-100'}`} style={{ minHeight: '1rem' }} />
            <div>
              <span className="font-semibold text-gray-800">Phase {p.phaseNum}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span className="text-gray-600">Month {p.startMonth}–{p.endMonth}</span>
              <span className="text-gray-400 mx-1">·</span>
              <span className="font-medium">{p.wearLabel}</span>
              {p.clinicalInstruction && (
                <p className="text-gray-500 mt-0.5">{p.clinicalInstruction}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Risk factor list ─────────────────────────────────────────────────────────

function RiskFactorList({ factors }: { factors: RelapseFactor[] }) {
  if (factors.length === 0) {
    return (
      <p className="text-xs text-green-700 bg-green-50 rounded p-3 border border-green-200">
        No significant relapse risk factors detected in this plan.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {factors.map(f => (
        <li key={f.id} className="text-xs rounded border border-amber-200 bg-amber-50 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-amber-900">
              {FACTOR_LABELS[f.factorType] ?? f.factorType.replace(/_/g, ' ')}
            </span>
            <span className="font-mono text-amber-700 shrink-0">
              +{(f.factorWeight * 100).toFixed(0)}% risk
            </span>
          </div>
          <p className="text-amber-800 mt-0.5">{f.description}</p>
          {f.detectedValue && (
            <p className="text-amber-600 italic mt-0.5">Detected: {f.detectedValue}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

type Tab = 'protocol' | 'schedule' | 'factors';

export default function RetentionProtocolPanel({ caseId, planId }: Props) {
  const [tab, setTab] = useState<Tab>('protocol');
  const [protocol, setProtocol] = useState<RetentionProtocol | null>(null);
  const [schedule, setSchedule] = useState<WearPhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runGenerate = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [proto, sched] = await Promise.all([
        generateRetentionProtocol(caseId, planId),
        getWearSchedule(caseId, planId).catch(() => [] as WearPhase[]),
      ]);
      setProtocol(proto);
      // Load schedule after protocol exists
      const s = await getWearSchedule(caseId, planId);
      setSchedule(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const loadSchedule = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const s = await getWearSchedule(caseId, planId);
      setSchedule(s);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const handleApprove = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const updated = await approveRetentionProtocol(caseId, planId);
      setProtocol(updated);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [caseId, planId]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'protocol', label: 'Protocol' },
    { id: 'schedule', label: 'Wear Schedule' },
    { id: 'factors',  label: `Risk Factors${protocol ? ` (${protocol.riskFactors.length})` : ''}` },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Retention Protocol Engine</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Evidence-based relapse risk scoring, retainer selection, wear schedules
          </p>
        </div>
        {protocol?.relapseRiskLevel && (
          <span className={`text-xs px-2 py-1 rounded border font-semibold ${RISK_STYLE[protocol.relapseRiskLevel]}`}>
            {RISK_LABEL[protocol.relapseRiskLevel]}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              if (t.id === 'schedule' && schedule.length === 0 && protocol) loadSchedule();
            }}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 rounded p-3 border border-red-200">
            {error}
          </div>
        )}

        {/* Protocol tab */}
        {tab === 'protocol' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                onClick={runGenerate}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Generating…' : protocol ? 'Re-Generate' : 'Generate Protocol'}
              </button>
              {protocol && !protocol.approvedAt && (
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Approve Protocol
                </button>
              )}
              {protocol?.approvedAt && (
                <span className="text-xs text-green-700 font-medium">
                  ✓ Clinician Approved
                </span>
              )}
            </div>

            {protocol && (
              <div className="space-y-4">
                {riskBar(protocol.relapseRiskScore)}

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">Upper Retainer</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {RETAINER_LABELS[protocol.primaryRetainerType] ?? protocol.primaryRetainerType}
                    </p>
                  </div>
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">Lower Retainer</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {protocol.lowerRetainerType
                        ? (RETAINER_LABELS[protocol.lowerRetainerType] ?? protocol.lowerRetainerType)
                        : '—'}
                    </p>
                  </div>
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">Total Retention</p>
                    <p className="text-sm font-semibold text-gray-900">{protocol.totalRetentionMonths} months</p>
                  </div>
                  <div className="rounded border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-1">Night-Only Begins</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {protocol.nightOnlyStartsMonth != null
                        ? `Month ${protocol.nightOnlyStartsMonth}`
                        : '—'}
                    </p>
                  </div>
                </div>

                {protocol.clinicalNotes && (
                  <div className="text-xs text-gray-700 bg-gray-50 rounded p-3 border border-gray-200">
                    {protocol.clinicalNotes}
                  </div>
                )}
              </div>
            )}

            {!protocol && !loading && (
              <p className="text-xs text-gray-500 italic">
                Generate protocol to analyze relapse risk from movement prescriptions and assign evidence-based retention.
              </p>
            )}
          </div>
        )}

        {/* Wear schedule tab */}
        {tab === 'schedule' && (
          <div className="space-y-3">
            <button
              onClick={loadSchedule}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load Schedule'}
            </button>
            {schedule.length > 0 && (
              <WearTimeline phases={schedule} totalMonths={protocol?.totalRetentionMonths ?? 24} />
            )}
            {schedule.length === 0 && !loading && (
              <p className="text-xs text-gray-500 italic">
                Generate the protocol first to populate the wear schedule.
              </p>
            )}
          </div>
        )}

        {/* Risk factors tab */}
        {tab === 'factors' && (
          <div className="space-y-3">
            {protocol ? (
              <>
                {protocol.riskFactors.length > 0 && (
                  <div className="text-xs text-gray-600 bg-blue-50 rounded p-2 border border-blue-200">
                    Risk factors are weighted per Littlewood 2016 (Cochrane) and Edman-Wallén 2019. Sum is capped at 1.0.
                  </div>
                )}
                <RiskFactorList factors={protocol.riskFactors} />
              </>
            ) : (
              <p className="text-xs text-gray-500 italic">
                Generate protocol to see detected relapse risk factors.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="border-t border-gray-200 px-4 py-2">
        <p className="text-xs text-amber-700">
          Retention protocol is a clinical recommendation only. Clinician must review, adjust based on patient-specific factors, and approve before delivery.
        </p>
      </div>
    </div>
  );
}
