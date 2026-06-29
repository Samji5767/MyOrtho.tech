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

interface Props { token: string }

export default function PlatformHealthPanel({ token }: Props) {
  const [report, setReport] = useState<PlatformHealthReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/platform-health', { headers: { Authorization: `Bearer ${token}` } });
      if (r.ok) setReport(await r.json());
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!report) return <p className="text-sm text-red-500">Failed to load platform health</p>;

  const okModules = report.modules.filter(m => m.status === 'ok');
  const errorModules = report.modules.filter(m => m.status === 'error');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <Server size={16} />
            Platform Health Dashboard
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Last checked: {new Date(report.timestamp).toLocaleTimeString()}
          </p>
        </div>
        <button onClick={load} className="p-1.5 text-gray-500 hover:text-gray-700 rounded border">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Core status */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className={`p-4 border rounded-lg text-center ${report.databaseConnected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <Database size={20} className={`mx-auto mb-1 ${report.databaseConnected ? 'text-green-600' : 'text-red-500'}`} />
          <p className="text-xs font-medium text-gray-700">PostgreSQL</p>
          <p className={`text-xs mt-0.5 font-semibold ${report.databaseConnected ? 'text-green-700' : 'text-red-600'}`}>
            {report.databaseConnected ? 'Connected' : 'Disconnected'}
          </p>
        </div>
        <div className={`p-4 border rounded-lg text-center ${report.redisConnected ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <Zap size={20} className={`mx-auto mb-1 ${report.redisConnected ? 'text-green-600' : 'text-gray-400'}`} />
          <p className="text-xs font-medium text-gray-700">Redis</p>
          <p className={`text-xs mt-0.5 font-semibold ${report.redisConnected ? 'text-green-700' : 'text-gray-500'}`}>
            {report.redisConnected ? 'Connected' : 'Not configured'}
          </p>
        </div>
        <div className="p-4 border rounded-lg text-center bg-indigo-50 border-indigo-200">
          <Activity size={20} className="mx-auto mb-1 text-indigo-600" />
          <p className="text-xs font-medium text-gray-700">Phases</p>
          <p className="text-lg font-bold text-indigo-700">{report.phasesCovered}</p>
        </div>
        <div className={`p-4 border rounded-lg text-center ${report.maturityScore >= 80 ? 'bg-green-50 border-green-200' : report.maturityScore >= 50 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200'}`}>
          <CheckCircle size={20} className={`mx-auto mb-1 ${report.maturityScore >= 80 ? 'text-green-600' : report.maturityScore >= 50 ? 'text-yellow-600' : 'text-red-500'}`} />
          <p className="text-xs font-medium text-gray-700">Maturity</p>
          <p className={`text-lg font-bold ${report.maturityScore >= 80 ? 'text-green-700' : report.maturityScore >= 50 ? 'text-yellow-700' : 'text-red-700'}`}>
            {report.maturityScore}%
          </p>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-3 border rounded-lg bg-white">
          <p className="text-2xl font-bold text-gray-900">{report.totalTables}</p>
          <p className="text-xs text-gray-500 mt-0.5">Database Tables</p>
        </div>
        <div className="p-3 border rounded-lg bg-white">
          <p className="text-2xl font-bold text-gray-900">{report.totalRecords.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Records</p>
        </div>
      </div>

      {/* Maturity progress */}
      <div className="border rounded-lg p-4 bg-white">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700">Platform Coverage</p>
          <p className="text-sm font-bold text-gray-900">{okModules.length} / {report.modules.length} modules active</p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-indigo-500 to-green-500 transition-all"
            style={{ width: `${report.maturityScore}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {report.maturityScore}% of platform modules verified operational
        </p>
      </div>

      {/* Module table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <div className="px-4 py-3 border-b bg-gray-50">
          <p className="text-sm font-medium text-gray-700">Module Status</p>
        </div>
        <div className="divide-y max-h-96 overflow-y-auto">
          {report.modules.map(m => (
            <div key={m.module} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                {m.status === 'ok' ? (
                  <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle size={14} className="text-red-400 flex-shrink-0" />
                )}
                <p className="text-sm text-gray-900 truncate">{m.module}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                {m.status === 'ok' ? (
                  <p className="text-xs text-gray-500">{m.recordCount} record{m.recordCount !== 1 ? 's' : ''}</p>
                ) : (
                  <p className="text-xs text-red-500">Table missing</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {errorModules.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-700 mb-1">
            {errorModules.length} module{errorModules.length !== 1 ? 's' : ''} need database migration
          </p>
          <p className="text-xs text-red-600">
            Run migrations 026 and 027 to provision all tables for full platform coverage.
          </p>
        </div>
      )}
    </div>
  );
}
