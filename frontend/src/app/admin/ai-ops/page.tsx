"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, RefreshCw, Brain, ShieldCheck, AlertCircle,
  CheckCircle2, ChevronDown, ChevronUp, Info,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastContext";
import { Card, SkeletonBlock } from "@/components/DesignSystem";
import { api } from "@/lib/api/client";

const ADMIN_ROLES = ["admin", "super_admin"];

interface AiModel {
  id: string;
  name: string;
  modelType: string;
  version: string;
  status: string;
  provider: string;
  isResearchOnly: boolean | null;
  intendedUse: string | null;
  deployedAt: string | null;
  deprecatedAt: string | null;
  metricsJson: Record<string, unknown>;
}

interface AiInferenceAudit {
  id: string;
  modelName: string;
  modelVersion: string;
  inferenceType: string | null;
  invokedBy: string;
  caseId: string | null;
  outcome: string | null;
  disclaimerShown: boolean;
  fallbackUsed: boolean;
  manualReviewRequired: boolean;
  auditStatus: string;
  confidenceScore: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  createdAt: string;
}

interface UtilizationStats {
  totalInferences: number;
  byModel: Record<string, number>;
  byOutcome: Record<string, number>;
  disclaimerShownRate: number;
}

const MODEL_STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  staged:      { label: "Staged",      cls: "text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300" },
  active:      { label: "Active",      cls: "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300" },
  deprecated:  { label: "Deprecated",  cls: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-400" },
  rolled_back: { label: "Rolled Back", cls: "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300" },
};

function ModelStatusBadge({ status }: { status: string }) {
  const cfg = MODEL_STATUS_CONFIG[status] ?? { label: status, cls: "text-slate-500 bg-slate-50" };
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>;
}

function AuditStatusChip({ status }: { status: string }) {
  const cls =
    status === "completed"   ? "text-emerald-700 bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-300" :
    status === "failed"      ? "text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300" :
    status === "in_progress" ? "text-blue-700 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300" :
                               "text-gray-600 bg-gray-100 dark:bg-gray-800 dark:text-gray-400";
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{status}</span>;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

export default function AdminAiOpsPage() {
  const { status, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [models, setModels] = useState<AiModel[]>([]);
  const [auditLog, setAuditLog] = useState<AiInferenceAudit[]>([]);
  const [utilization, setUtilization] = useState<UtilizationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"models" | "audit">("models");
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !user || !ADMIN_ROLES.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [user, status, router]);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    else setRefreshing(true);
    try {
      const [modelsRes, auditRes, utilRes] = await Promise.all([
        api.get<AiModel[]>("/api/mlops/models"),
        api.get<AiInferenceAudit[]>("/api/mlops/inference-audit"),
        api.get<UtilizationStats>("/api/mlops/utilization"),
      ]);
      setModels(modelsRes);
      setAuditLog(auditRes);
      setUtilization(utilRes);
    } catch (err: unknown) {
      toast({ title: "Load failed", description: (err as Error).message, type: "error" });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const updateModelStatus = async (id: string, newStatus: string) => {
    setUpdatingStatus(id);
    try {
      await api.patch(`/api/mlops/models/${id}/status`, { status: newStatus });
      toast({ title: `Model status updated to ${newStatus}`, type: "success" });
      await load(false);
    } catch (err: unknown) {
      toast({ title: "Update failed", description: (err as Error).message, type: "error" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (status === "loading" || !user) return null;

  const disclaimerRate = utilization?.disclaimerShownRate ?? 1;
  const disclaimerOk = disclaimerRate >= 0.99;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 flex items-center gap-2">
                <Brain size={22} className="text-violet-600" />
                AI Operations
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">Model registry, inference audit, and governance</p>
            </div>
          </div>
          <button
            onClick={() => load(false)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card className="text-center">
            <div className="text-3xl font-bold text-violet-700 dark:text-violet-300">
              {loading ? "—" : (utilization?.totalInferences ?? 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total Inferences</div>
          </Card>
          <Card className="text-center">
            <div className={`text-3xl font-bold ${disclaimerOk ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {loading ? "—" : pct(disclaimerRate)}
            </div>
            <div className="text-xs text-gray-500 mt-1 flex items-center justify-center gap-1">
              <ShieldCheck size={12} />
              Disclaimer Rate
            </div>
          </Card>
          <Card className="text-center">
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
              {loading ? "—" : models.filter(m => m.status === "active").length}
            </div>
            <div className="text-xs text-gray-500 mt-1">Active Models</div>
          </Card>
          <Card className="text-center">
            <div className="text-3xl font-bold text-amber-700 dark:text-amber-300">
              {loading ? "—" : auditLog.filter(a => a.manualReviewRequired).length}
            </div>
            <div className="text-xs text-gray-500 mt-1">Pending Review</div>
          </Card>
        </div>

        {!disclaimerOk && !loading && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
            <AlertCircle size={18} className="text-red-600 shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-300">
              <strong>Disclaimer compliance below threshold.</strong> {pct(disclaimerRate)} of inferences showed a clinician disclaimer.
              Target is ≥99%. Immediate investigation required.
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
          {(["models", "audit"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === tab
                  ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-50 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab === "models" ? "Model Registry" : "Inference Audit"}
            </button>
          ))}
        </div>

        {/* Model Registry */}
        {activeTab === "models" && (
          <div className="space-y-3">
            {loading ? (
              [...Array(3)].map((_, i) => <SkeletonBlock key={i} className="h-20 rounded-lg" />)
            ) : models.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Brain size={32} className="mx-auto mb-3 opacity-40" />
                <p>No models registered</p>
              </div>
            ) : (
              models.map(model => (
                <div key={model.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    onClick={() => setExpandedModel(prev => prev === model.id ? null : model.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <ModelStatusBadge status={model.status} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900 dark:text-gray-50">{model.name}</span>
                          <span className="font-mono text-xs text-gray-500">v{model.version}</span>
                          <span className="text-xs text-gray-400">{model.modelType}</span>
                          {model.isResearchOnly && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded">
                              RESEARCH ONLY
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">Provider: {model.provider}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {model.deployedAt && (
                        <span className="text-xs text-gray-400 hidden sm:block">Deployed {fmtDate(model.deployedAt)}</span>
                      )}
                      {expandedModel === model.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                    </div>
                  </button>

                  {expandedModel === model.id && (
                    <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 bg-gray-50/50 dark:bg-gray-800/30">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                        <div>
                          <p className="text-gray-400 text-xs mb-1">Model ID</p>
                          <p className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all">{model.id}</p>
                        </div>
                        {model.intendedUse && (
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Intended Use</p>
                            <p className="text-gray-700 dark:text-gray-300">{model.intendedUse}</p>
                          </div>
                        )}
                        {model.deprecatedAt && (
                          <div>
                            <p className="text-gray-400 text-xs mb-1">Deprecated</p>
                            <p className="text-gray-700 dark:text-gray-300">{fmtDate(model.deprecatedAt)}</p>
                          </div>
                        )}
                      </div>

                      {Object.keys(model.metricsJson).length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1"><Info size={12} /> Evaluation Metrics</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(model.metricsJson).map(([k, v]) => (
                              <span key={k} className="text-xs bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                                <span className="text-gray-500">{k}:</span>{" "}
                                <span className="font-mono text-gray-800 dark:text-gray-200">{String(v)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        {model.status === "staged" && (
                          <button
                            disabled={updatingStatus === model.id}
                            onClick={() => updateModelStatus(model.id, "active")}
                            className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                        {model.status === "active" && (
                          <>
                            <button
                              disabled={updatingStatus === model.id}
                              onClick={() => updateModelStatus(model.id, "deprecated")}
                              className="text-xs px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg disabled:opacity-50"
                            >
                              Deprecate
                            </button>
                            <button
                              disabled={updatingStatus === model.id}
                              onClick={() => updateModelStatus(model.id, "rolled_back")}
                              className="text-xs px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                            >
                              Roll Back
                            </button>
                          </>
                        )}
                        {(model.status === "deprecated" || model.status === "rolled_back") && (
                          <button
                            disabled={updatingStatus === model.id}
                            onClick={() => updateModelStatus(model.id, "staged")}
                            className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                          >
                            Re-stage
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Inference Audit */}
        {activeTab === "audit" && (
          <div>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <SkeletonBlock key={i} className="h-14 rounded-lg" />)}
              </div>
            ) : auditLog.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <ShieldCheck size={32} className="mx-auto mb-3 opacity-40" />
                <p>No inference audit records</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Model</th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Outcome</th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Disclaimer</th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fallback</th>
                      <th className="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Latency</th>
                      <th className="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {auditLog.map(record => (
                      <tr
                        key={record.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${record.manualReviewRequired ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}
                      >
                        <td className="py-3 pr-4">
                          <span className="font-medium text-gray-800 dark:text-gray-200">{record.modelName}</span>
                          <span className="text-gray-400 text-xs ml-1">v{record.modelVersion}</span>
                        </td>
                        <td className="py-3 pr-4 text-gray-500">{record.inferenceType ?? "—"}</td>
                        <td className="py-3 pr-4"><AuditStatusChip status={record.auditStatus} /></td>
                        <td className="py-3 pr-4 text-gray-600 dark:text-gray-400">{record.outcome ?? "—"}</td>
                        <td className="py-3 pr-4">
                          {record.disclaimerShown
                            ? <CheckCircle2 size={14} className="text-emerald-600" />
                            : <AlertCircle size={14} className="text-red-600" />}
                        </td>
                        <td className="py-3 pr-4">
                          {record.fallbackUsed
                            ? <span className="text-[11px] text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 px-1.5 py-0.5 rounded">Fallback</span>
                            : <span className="text-gray-300 dark:text-gray-600">—</span>}
                        </td>
                        <td className="py-3 pr-4 font-mono text-gray-700 dark:text-gray-300">
                          {record.latencyMs != null ? `${record.latencyMs}ms` : "—"}
                        </td>
                        <td className="py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(record.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
