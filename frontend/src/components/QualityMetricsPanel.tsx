'use client';
import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, TrendingUp } from 'lucide-react';

interface QualityMetric {
  id: string; metricName: string; value: number; target: number | null;
  unit: string | null; periodStart: string; periodEnd: string;
}

interface Props { token: string }

const METRIC_LABELS: Record<string, string> = {
  treatment_completion_rate: 'Treatment Completion Rate',
  patient_satisfaction_score: 'Patient Satisfaction',
  on_time_appointments: 'On-Time Appointments',
  aligner_accuracy_rate: 'Aligner Accuracy Rate',
  refinement_rate: 'Refinement Rate',
  average_treatment_duration: 'Avg Treatment Duration',
  new_case_starts: 'New Case Starts',
};

export default function QualityMetricsPanel({ token }: Props) {
  const [metrics, setMetrics] = useState<QualityMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/quality-metrics', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setMetrics(await r.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const compute = async () => {
    setComputing(true);
    try {
      await fetch('/api/quality-metrics/compute', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await load();
    } finally { setComputing(false); }
  };

  const pct = (value: number, target: number | null) => {
    if (!target) return null;
    return Math.min(Math.round((value / target) * 100), 150);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Activity size={16} />
          Quality Metrics
        </h3>
        <div className="flex gap-2">
          <button onClick={compute} disabled={computing} className="flex items-center gap-1 text-sm px-3 py-1.5 border rounded-md hover:bg-gray-50 text-gray-700 disabled:opacity-50">
            <RefreshCw size={13} className={computing ? 'animate-spin' : ''} />
            Compute
          </button>
          <button onClick={load} className="p-1.5 text-gray-500 hover:text-gray-700 rounded border">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : metrics.length === 0 ? (
        <div className="text-center py-6">
          <Activity size={32} className="mx-auto text-gray-300 mb-2" />
          <p className="text-sm text-gray-500 mb-3">No quality metrics computed yet.</p>
          <button onClick={compute} disabled={computing} className="text-sm px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
            Compute Now
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {metrics.map(metric => {
            const percentage = pct(metric.value, metric.target);
            const label = METRIC_LABELS[metric.metricName] ?? metric.metricName.replace(/_/g, ' ');
            const isGood = metric.target ? metric.value >= metric.target * 0.9 : true;
            return (
              <div key={metric.id} className="p-3 border rounded-lg bg-white">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">{label}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(metric.periodStart).toLocaleDateString()} – {new Date(metric.periodEnd).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                      {metric.value.toFixed(1)}{metric.unit ?? ''}
                    </p>
                    {metric.target && (
                      <p className="text-xs text-gray-400">Target: {metric.target}{metric.unit ?? ''}</p>
                    )}
                  </div>
                </div>
                {percentage !== null && (
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full ${percentage >= 100 ? 'bg-green-500' : percentage >= 80 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <TrendingUp size={12} />
        Metrics are computed from case and outcome data across your organization
      </div>
    </div>
  );
}
