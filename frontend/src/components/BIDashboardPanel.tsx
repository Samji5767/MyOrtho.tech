'use client';
import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, Users, CheckCircle, DollarSign, RefreshCw } from 'lucide-react';

interface DashboardMetrics {
  totalCases: number; activeCases: number; completedCases: number;
  totalPatients: number; avgTreatmentMonths: number; completionRate: number;
  avgSatisfaction: number;
}
interface TrendPoint { week: string; count: number }

interface Props { token: string }

export default function BIDashboardPanel({ token }: Props) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, tRes] = await Promise.all([
        fetch('/api/bi/dashboard', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/bi/case-trend', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (tRes.ok) setTrend(await tRes.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-sm text-gray-500">Loading dashboard…</p>;
  if (!metrics) return <p className="text-sm text-red-500">Failed to load metrics</p>;

  const maxCount = trend.length > 0 ? Math.max(...trend.map(t => t.count), 1) : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <BarChart2 size={16} />
          Business Intelligence
        </h3>
        <button onClick={load} className="p-1.5 text-gray-500 hover:text-gray-700 rounded">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Cases', value: metrics.totalCases, icon: BarChart2, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Active Cases', value: metrics.activeCases, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
          { label: 'Total Patients', value: metrics.totalPatients, icon: Users, color: 'text-blue-600 bg-blue-50' },
          { label: 'Completion Rate', value: `${metrics.completionRate}%`, icon: CheckCircle, color: 'text-purple-600 bg-purple-50' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-3 border rounded-lg bg-white">
            <div className={`inline-flex p-1.5 rounded-md ${color} mb-2`}>
              <Icon size={14} />
            </div>
            <p className="text-xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3 border rounded-lg bg-white">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={13} className="text-gray-400" />
            <p className="text-xs text-gray-500">Avg Treatment Duration</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{metrics.avgTreatmentMonths.toFixed(1)} <span className="text-sm font-normal text-gray-500">months</span></p>
        </div>
        <div className="p-3 border rounded-lg bg-white">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={13} className="text-gray-400" />
            <p className="text-xs text-gray-500">Avg Patient Satisfaction</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{metrics.avgSatisfaction > 0 ? metrics.avgSatisfaction.toFixed(1) : '—'} <span className="text-sm font-normal text-gray-500">/ 5</span></p>
        </div>
      </div>

      {trend.length > 0 && (
        <div className="border rounded-lg p-4 bg-white">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp size={14} />
            Case Volume (12-Week Trend)
          </h4>
          <div className="flex items-end gap-1 h-24">
            {trend.slice(-12).map((point, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-indigo-400 rounded-t"
                  style={{ height: `${Math.round((point.count / maxCount) * 80)}px`, minHeight: point.count > 0 ? '2px' : '0' }}
                  title={`${new Date(point.week).toLocaleDateString()}: ${point.count} cases`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>{trend.length > 12 ? new Date(trend[trend.length - 12].week).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}</span>
            <span>{trend.length > 0 ? new Date(trend[trend.length - 1].week).toLocaleDateString('en', { month: 'short', day: 'numeric' }) : ''}</span>
          </div>
        </div>
      )}
    </div>
  );
}
