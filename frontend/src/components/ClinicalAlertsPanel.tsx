'use client';
import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Bell, CheckCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface ClinicalAlert {
  id: string; caseId: string; alertType: string; severity: string;
  title: string; description: string | null; isAcknowledged: boolean;
  acknowledgedBy: string | null; createdAt: string;
}

interface Props { caseId: string; token: string }

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-50 border-red-300 text-red-800',
  high: 'bg-orange-50 border-orange-300 text-orange-800',
  medium: 'bg-yellow-50 border-yellow-300 text-yellow-800',
  low: 'bg-blue-50 border-blue-300 text-blue-800',
};

export default function ClinicalAlertsPanel({ caseId, token }: Props) {
  const [alerts, setAlerts] = useState<ClinicalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [showAck, setShowAck] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/cds/alerts?caseId=${caseId}&acknowledged=${showAck}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) setAlerts(await r.json());
    } finally { setLoading(false); }
  }, [caseId, token, showAck]);

  useEffect(() => { load(); }, [load]);

  const runChecks = async () => {
    setRunning(true);
    try {
      await fetch(`/api/cds/run-checks`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      await load();
    } finally { setRunning(false); }
  };

  const acknowledge = async (id: string) => {
    await fetch(`/api/cds/alerts/${id}/acknowledge`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    await load();
  };

  const active = alerts.filter(a => !a.isAcknowledged);
  const acked = alerts.filter(a => a.isAcknowledged);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Bell size={16} />
          Clinical Decision Support
          {active.length > 0 && (
            <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{active.length}</span>
          )}
        </h3>
        <button
          onClick={runChecks}
          disabled={running}
          className="flex items-center gap-1 text-sm px-3 py-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
        >
          <RefreshCw size={13} className={running ? 'animate-spin' : ''} />
          Run Checks
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading alerts…</p>
      ) : active.length === 0 ? (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle size={16} />
          No active clinical alerts
        </div>
      ) : (
        <div className="space-y-2">
          {active.map(alert => (
            <div key={alert.id} className={`p-3 border rounded-lg ${SEVERITY_COLOR[alert.severity] ?? 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{alert.title}</p>
                    {alert.description && <p className="text-xs mt-0.5 opacity-80">{alert.description}</p>}
                    <p className="text-xs mt-1 opacity-60 capitalize">{alert.severity} · {alert.alertType.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={() => acknowledge(alert.id)}
                  className="text-xs px-2 py-1 bg-white bg-opacity-60 border rounded hover:bg-opacity-100 flex-shrink-0"
                >
                  Acknowledge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {acked.length > 0 && (
        <div>
          <button
            onClick={() => setShowAck(v => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {showAck ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {acked.length} acknowledged alert{acked.length !== 1 ? 's' : ''}
          </button>
          {showAck && (
            <div className="mt-2 space-y-1">
              {acked.map(alert => (
                <div key={alert.id} className="p-2 bg-gray-50 border border-gray-200 rounded text-xs text-gray-500">
                  <span className="font-medium">{alert.title}</span>
                  <span className="ml-2 capitalize">({alert.severity})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
