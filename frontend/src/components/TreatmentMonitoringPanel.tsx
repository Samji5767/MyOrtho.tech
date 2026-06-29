'use client';

import React, { useState, useCallback } from 'react';
import {
  submitCheckIn, listCheckIns, listAlerts, resolveAlert, computeQualityScore, getQualityScore,
  CheckIn, OffTrackAlert, QualityScore, CheckInPayload, CheckInType, QualityGrade,
} from '@/lib/api/treatment-monitoring';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_STYLE: Record<string, string> = {
  info:     'bg-blue-100 text-blue-700 border-blue-300',
  warning:  'bg-amber-100 text-amber-700 border-amber-300',
  critical: 'bg-red-100 text-red-700 border-red-300',
};

const STATUS_STYLE: Record<string, string> = {
  open:      'text-red-600',
  reviewed:  'text-blue-600',
  resolved:  'text-green-600',
  escalated: 'text-purple-600',
};

const GRADE_COLOR: Record<QualityGrade, string> = {
  A: 'text-green-700 bg-green-100',
  B: 'text-teal-700 bg-teal-100',
  C: 'text-amber-700 bg-amber-100',
  D: 'text-orange-700 bg-orange-100',
  F: 'text-red-700 bg-red-100',
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  aligner_not_seating:   'Aligner Not Seating',
  movement_lagging:      'Movement Lagging',
  patient_non_compliance:'Non-Compliance',
  unexpected_relapse:    'Unexpected Relapse',
  attachment_detached:   'Attachment Detached',
  bite_opening:          'Bite Opening',
  midline_shift:         'Midline Shift',
};

const CHECK_IN_TYPES: Array<{ value: CheckInType; label: string }> = [
  { value: 'photo_review',        label: 'Photo Review' },
  { value: 'scan_comparison',     label: 'Scan Comparison' },
  { value: 'clinical_exam',       label: 'Clinical Exam' },
  { value: 'patient_self_report', label: 'Patient Self-Report' },
];

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  if (score == null) {
    return (
      <div>
        <div className="flex justify-between text-[10px] text-gray-400 mb-0.5">
          <span>{label}</span><span>N/A</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full" />
      </div>
    );
  }
  const pct = Math.round(score * 100);
  const color = pct >= 90 ? 'bg-green-500' : pct >= 75 ? 'bg-teal-500' : pct >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div>
      <div className="flex justify-between text-[10px] text-gray-600 mb-0.5">
        <span>{label}</span><span className="font-mono">{pct}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── Quality Score Card ───────────────────────────────────────────────────────

function QualityCard({ score, caseId, planId, onRefresh }: {
  score: QualityScore; caseId: string; planId: string; onRefresh: () => void;
}) {
  return (
    <div className="rounded border border-gray-200 bg-white p-4 space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold ${GRADE_COLOR[score.grade]}`}>
          {score.grade}
        </div>
        <div>
          <p className="text-lg font-bold text-gray-900">{(score.overallScore * 100).toFixed(0)}/100</p>
          <p className="text-xs text-gray-500">Treatment Quality Score</p>
          {score.hasCriticalIssues && (
            <p className="text-xs text-red-700 font-semibold">
              {score.criticalIssueCount} critical issue(s) — resolve before export
            </p>
          )}
        </div>
        <div className="ml-auto text-right">
          {score.warningCount > 0 && (
            <p className="text-xs text-amber-700">{score.warningCount} warning(s)</p>
          )}
          <p className="text-[10px] text-gray-400">
            Scored {new Date(score.scoredAt).toLocaleString()}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <ScoreBar label="Movement Safety"    score={score.movementSafetyScore} />
        <ScoreBar label="PDL Safety"         score={score.pdlSafetyScore} />
        <ScoreBar label="IPR Safety"         score={score.iprSafetyScore} />
        <ScoreBar label="Attachments"        score={score.attachmentScore} />
        <ScoreBar label="Simulation"         score={score.simulationScore} />
        <ScoreBar label="Arch Coordination"  score={score.archCoordScore} />
        <ScoreBar label="Retention"          score={score.retentionScore} />
        <ScoreBar label="Export Readiness"   score={score.exportReadinessScore} />
      </div>

      {score.recommendations.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-3 space-y-1">
          <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide">Recommendations</p>
          {score.recommendations.map((rec, i) => (
            <p key={i} className="text-xs text-amber-700">• {rec}</p>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Alert Card ───────────────────────────────────────────────────────────────

function AlertCard({
  alert, caseId, onUpdate,
}: {
  alert: OffTrackAlert; caseId: string; onUpdate: (updated: OffTrackAlert) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [expanded, setExpanded] = useState(alert.severity === 'critical');

  const resolve = async (status: 'reviewed' | 'resolved' | 'escalated') => {
    setLoading(true);
    try {
      const updated = await resolveAlert(caseId, alert.id, status, note || undefined);
      onUpdate(updated);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded border p-3 space-y-2 ${SEVERITY_STYLE[alert.severity]}`}>
      <div className="flex items-start gap-2">
        <span className="text-[10px] font-bold uppercase">{alert.severity}</span>
        <span className="text-xs font-semibold flex-1">
          {ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}
        </span>
        <span className={`text-[10px] font-semibold ${STATUS_STYLE[alert.status]}`}>
          {alert.status}
        </span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[10px] underline opacity-70 hover:opacity-100"
        >
          {expanded ? 'Less' : 'More'}
        </button>
      </div>

      {expanded && (
        <>
          <p className="text-xs">{alert.description}</p>
          <p className="text-xs font-semibold">Action: {alert.recommendedAction}</p>
          {alert.affectedStage != null && (
            <p className="text-[10px] opacity-70">Stage {alert.affectedStage}</p>
          )}

          {alert.status === 'open' && (
            <div className="space-y-1.5">
              <input
                type="text"
                placeholder="Resolution note (optional)…"
                value={note}
                onChange={e => setNote(e.target.value)}
                className="w-full text-xs border border-current border-opacity-30 rounded px-2 py-1 bg-white bg-opacity-60 placeholder-current placeholder-opacity-40"
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => resolve('resolved')}
                  disabled={loading}
                  className="px-2 py-1 text-[10px] bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50"
                >
                  Resolve
                </button>
                <button
                  onClick={() => resolve('reviewed')}
                  disabled={loading}
                  className="px-2 py-1 text-[10px] bg-blue-700 text-white rounded hover:bg-blue-800 disabled:opacity-50"
                >
                  Reviewed
                </button>
                <button
                  onClick={() => resolve('escalated')}
                  disabled={loading}
                  className="px-2 py-1 text-[10px] bg-purple-700 text-white rounded hover:bg-purple-800 disabled:opacity-50"
                >
                  Escalate
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface Props {
  caseId: string;
  planId: string;
}

type TabId = 'check-in' | 'alerts' | 'quality';

export default function TreatmentMonitoringPanel({ caseId, planId }: Props) {
  const [tab, setTab] = useState<TabId>('quality');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check-in form
  const [ciType, setCiType] = useState<CheckInType>('photo_review');
  const [ciStage, setCiStage] = useState(1);
  const [ciTotal, setCiTotal] = useState(20);
  const [ciNotes, setCiNotes] = useState('');
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [newAlerts, setNewAlerts] = useState<OffTrackAlert[]>([]);

  // Alerts
  const [alerts, setAlerts] = useState<OffTrackAlert[]>([]);

  // Quality
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setLoading(true); setError(null);
    try { await fn(); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  const handleCheckIn = useCallback(() => run(async () => {
    const payload: CheckInPayload = {
      planId, currentStage: ciStage, totalStages: ciTotal,
      checkInType: ciType, notes: ciNotes || undefined,
    };
    const { checkIn, alerts: triggered } = await submitCheckIn(caseId, payload);
    setRecentCheckIns(prev => [checkIn, ...prev]);
    setNewAlerts(triggered);
    setCiNotes('');
    if (triggered.length > 0) setTab('alerts');
  }), [caseId, planId, ciType, ciStage, ciTotal, ciNotes, run]);

  const TABS: Array<{ id: TabId; label: string }> = [
    { id: 'quality',  label: 'Quality Score' },
    { id: 'check-in', label: 'Check-In' },
    { id: 'alerts',   label: `Alerts${alerts.filter(a => a.status === 'open').length > 0 ? ` (${alerts.filter(a => a.status === 'open').length})` : ''}` },
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">Treatment Monitoring</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Off-track detection, compliance monitoring, and multi-component quality scoring
        </p>
      </div>

      <div className="border-b border-gray-200 flex">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              tab === t.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded p-3">{error}</div>
        )}

        {/* Quality Score Tab */}
        {tab === 'quality' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => run(async () => setQualityScore(await computeQualityScore(caseId, planId)))}
                disabled={loading}
                className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Scoring…' : 'Compute Quality Score'}
              </button>
              <button
                onClick={() => run(async () => setQualityScore(await getQualityScore(caseId, planId)))}
                disabled={loading}
                className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Load Saved
              </button>
            </div>
            {qualityScore
              ? <QualityCard score={qualityScore} caseId={caseId} planId={planId} onRefresh={() => {}} />
              : <p className="text-xs text-gray-400 italic">Click "Compute Quality Score" to evaluate this treatment plan.</p>
            }
            <p className="text-[10px] text-amber-700">
              Quality scores are automated assessments. Clinician review is required before clinical decisions.
            </p>
          </div>
        )}

        {/* Check-In Tab */}
        {tab === 'check-in' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Type</label>
                <select
                  value={ciType}
                  onChange={e => setCiType(e.target.value as CheckInType)}
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
                >
                  {CHECK_IN_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">
                  Stage {ciStage} / {ciTotal}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number" min={1} max={ciTotal} value={ciStage}
                    onChange={e => setCiStage(parseInt(e.target.value, 10))}
                    className="w-16 text-xs border border-gray-300 rounded px-2 py-1.5"
                  />
                  <span className="text-gray-400 self-center">/</span>
                  <input
                    type="number" min={1} value={ciTotal}
                    onChange={e => setCiTotal(parseInt(e.target.value, 10))}
                    className="w-16 text-xs border border-gray-300 rounded px-2 py-1.5"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-gray-500 uppercase block mb-1">Clinical Notes</label>
              <textarea
                value={ciNotes}
                onChange={e => setCiNotes(e.target.value)}
                rows={3}
                placeholder="Describe any issues: aligner not seating, attachment detached, patient non-compliant…"
                className="w-full text-xs border border-gray-300 rounded px-2 py-2 resize-none"
              />
            </div>
            <button
              onClick={handleCheckIn}
              disabled={loading}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Submitting…' : 'Submit Check-In'}
            </button>

            {newAlerts.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-amber-800">
                  {newAlerts.length} alert(s) generated from this check-in:
                </p>
                {newAlerts.map(a => (
                  <AlertCard key={a.id} alert={a} caseId={caseId} onUpdate={updated => {
                    setNewAlerts(prev => prev.map(x => x.id === updated.id ? updated : x));
                  }} />
                ))}
              </div>
            )}

            {recentCheckIns.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-gray-400 uppercase">Recent Check-Ins</p>
                {recentCheckIns.map(ci => (
                  <div key={ci.id} className="text-xs border border-gray-100 rounded p-2 flex gap-3">
                    <span className="text-gray-500">Stage {ci.currentStage}/{ci.totalStages}</span>
                    <span className="text-gray-600 capitalize">{ci.checkInType.replace('_', ' ')}</span>
                    <span className="text-gray-400 ml-auto text-[10px]">
                      {new Date(ci.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {tab === 'alerts' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => run(async () => setAlerts(await listAlerts(caseId, planId)))}
                disabled={loading}
                className="px-3 py-1.5 text-xs border border-gray-300 text-gray-600 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                {loading ? 'Loading…' : 'Load Alerts'}
              </button>
              {alerts.filter(a => a.status === 'open').length > 0 && (
                <span className="text-xs text-red-700 self-center">
                  {alerts.filter(a => a.status === 'open').length} open alert(s) require attention
                </span>
              )}
            </div>
            {alerts.length === 0 && (
              <p className="text-xs text-gray-400 italic">No alerts found. Submit a check-in to detect off-track issues.</p>
            )}
            {alerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                caseId={caseId}
                onUpdate={updated => setAlerts(prev => prev.map(a => a.id === updated.id ? updated : a))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
