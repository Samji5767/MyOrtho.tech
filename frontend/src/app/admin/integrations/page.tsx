"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Plug, CheckCircle2, XCircle, AlertCircle,
  Settings, ChevronDown, ChevronUp, Lock, Shield,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastContext";
import { Card, StatusBadge, SkeletonBlock } from "@/components/DesignSystem";
import { api } from "@/lib/api/client";

const ADMIN_ROLES = ["admin", "super_admin"];

interface ScannerIntegration {
  id: string;
  vendor: string;
  apiEndpoint: string | null;
  isActive: boolean;
}

interface ConnectorDef {
  vendor: string;
  label: string;
  model: string;
  category: "scanner" | "printer" | "pms";
  description: string;
  accentColor: string;
}

const SCANNERS: ConnectorDef[] = [
  { vendor: "3shape", label: "3Shape", model: "TRIOS 5", category: "scanner", description: "Full-color intraoral scanner with AI-assisted scanning flow", accentColor: "text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400" },
  { vendor: "medit", label: "Medit", model: "i700", category: "scanner", description: "High-accuracy full-arch scanning with cloud integration", accentColor: "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400" },
  { vendor: "itero", label: "iTero", model: "Element 5D Plus", category: "scanner", description: "Real-time Invisalign outcome simulation and timeLapse", accentColor: "text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400" },
  { vendor: "carestream", label: "Carestream", model: "CS 3600", category: "scanner", description: "Fast and precise intraoral scanning system", accentColor: "text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400" },
];

const PRINTERS: ConnectorDef[] = [
  { vendor: "sprintray", label: "SprintRay", model: "Pro 95 S", category: "printer", description: "Dental 3D printing with automated post-processing", accentColor: "text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400" },
  { vendor: "formlabs", label: "Formlabs", model: "Form 4B", category: "printer", description: "Biocompatible SLA dental printing platform", accentColor: "text-pink-600 bg-pink-50 dark:bg-pink-900/20 dark:text-pink-400" },
  { vendor: "asiga", label: "Asiga", model: "MAX UV", category: "printer", description: "UV LED DLP printing for precision dental restorations", accentColor: "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-400" },
  { vendor: "carbon", label: "Carbon", model: "DLS", category: "printer", description: "Continuous liquid interface printing for elastomeric aligners", accentColor: "text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300" },
];

const PMS_CONNECTORS: ConnectorDef[] = [
  { vendor: "eaglesoft", label: "Eaglesoft", model: "Patterson", category: "pms", description: "Bi-directional patient and appointment sync", accentColor: "text-teal-600 bg-teal-50" },
  { vendor: "dentrix", label: "Dentrix", model: "Henry Schein", category: "pms", description: "Full practice management integration", accentColor: "text-cyan-600 bg-cyan-50" },
  { vendor: "opendental", label: "Open Dental", model: "Open Source", category: "pms", description: "Open-source PMS with API bridge", accentColor: "text-lime-600 bg-lime-50" },
  { vendor: "carestack", label: "CareStack", model: "Cloud PMS", category: "pms", description: "Cloud-native dental practice management", accentColor: "text-sky-600 bg-sky-50" },
];

interface ConfigFormState {
  apiEndpoint: string;
  apiKey: string;
}

function ConnectorCard({
  def,
  integration,
  onSave,
  saving,
}: {
  def: ConnectorDef;
  integration?: ScannerIntegration;
  onSave: (vendor: string, cfg: ConfigFormState) => Promise<void>;
  saving: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState<ConfigFormState>({
    apiEndpoint: integration?.apiEndpoint ?? "",
    apiKey: "",
  });

  const connected = Boolean(integration?.isActive);
  const isSaving = saving === def.vendor;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(def.vendor, form);
    setExpanded(false);
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${def.accentColor}`}>
          {def.label.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">{def.label}</p>
            <span className="text-xs text-[color:var(--muted-foreground)]">{def.model}</span>
          </div>
          <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{def.description}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {connected ? (
            <StatusBadge tone="success">Connected</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">Not configured</StatusBadge>
          )}
          {def.category !== "pms" && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 rounded-lg border border-[color:var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--border)]/40 transition-colors"
              aria-expanded={expanded}
            >
              <Settings size={12} />
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </div>
      </div>

      {expanded && def.category !== "pms" && (
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-[color:var(--border)] space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[color:var(--foreground)] mb-1">API Endpoint</label>
            <input
              type="text"
              value={form.apiEndpoint}
              onChange={(e) => setForm((f) => ({ ...f, apiEndpoint: e.target.value }))}
              placeholder="https://api.vendor.com/v1"
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[color:var(--foreground)] mb-1">API Key</label>
            <input
              type="password"
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder={connected ? "••••••••••••••••" : "Enter API key"}
              autoComplete="new-password"
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder-[color:var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/40"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-[color:var(--primary)] px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isSaving ? "Saving…" : connected ? "Update" : "Connect"}
            </button>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="rounded-lg border border-[color:var(--border)] px-4 py-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {def.category === "pms" && (
        <div className="mt-3 pt-3 border-t border-[color:var(--border)]">
          <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--border)] px-2.5 py-0.5 text-[10px] font-semibold text-[color:var(--muted-foreground)]">
            Coming Soon
          </span>
        </div>
      )}
    </Card>
  );
}

export default function AdminIntegrationsPage() {
  const { status, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [integrations, setIntegrations] = useState<ScannerIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ScannerIntegration[]>("/api/scanner/integrations");
      setIntegrations(data);
    } catch {
      // Fail silently — show all connectors as "Not configured"
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "loading") return;
    if (status === "unauthenticated" || !user || !ADMIN_ROLES.includes(user.role)) {
      router.replace("/dashboard");
      return;
    }
    void load();
  }, [status, user, router, load]);

  const handleSave = async (vendor: string, cfg: ConfigFormState) => {
    setSaving(vendor);
    try {
      const existing = integrations.find((i) => i.vendor === vendor);
      if (existing) {
        const updated = await api.patch<ScannerIntegration>(`/api/scanner/integrations/${existing.id}`, {
          apiEndpoint: cfg.apiEndpoint || null,
          authCredentials: cfg.apiKey ? { apiKey: cfg.apiKey } : undefined,
          isActive: true,
        });
        setIntegrations((prev) => prev.map((i) => (i.id === existing.id ? updated : i)));
      } else {
        const created = await api.post<ScannerIntegration>("/api/scanner/integrations", {
          vendor,
          apiEndpoint: cfg.apiEndpoint || null,
          authCredentials: cfg.apiKey ? { apiKey: cfg.apiKey } : {},
          isActive: true,
        });
        setIntegrations((prev) => [...prev, created]);
      }
      toast({ title: `${vendor} integration saved`, type: "success" });
    } catch (err) {
      toast({ title: "Failed to save integration", description: err instanceof Error ? err.message : "Unknown error", type: "error" });
    } finally {
      setSaving(null);
    }
  };

  if (status === "loading" || !user) return null;
  if (!ADMIN_ROLES.includes(user.role)) return null;

  const getIntegration = (vendor: string) =>
    integrations.find((i) => i.vendor === vendor);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/admin"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:opacity-80 transition-opacity"
          aria-label="Back to admin"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">Integration Hub</h1>
          <p className="text-sm text-[color:var(--muted-foreground)]">
            Connect scanners, printers, and practice management systems
          </p>
        </div>
      </div>

      {/* Security notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
        <Shield size={15} className="mt-0.5 shrink-0 text-[color:var(--primary)]" />
        <p className="text-xs text-[color:var(--muted-foreground)]">
          <strong className="text-[color:var(--foreground)]">Security:</strong> API credentials are
          encrypted at rest using AES-256 and are never exposed in logs or API responses.
          All communication uses TLS 1.3.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
              <SkeletonBlock className="h-10 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Intraoral Scanners */}
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Intraoral Scanners</h2>
              <span className="rounded-full bg-[color:var(--primary-glow)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--primary)]">
                {integrations.filter((i) => i.isActive).length} connected
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {SCANNERS.map((def) => (
                <ConnectorCard
                  key={def.vendor}
                  def={def}
                  integration={getIntegration(def.vendor)}
                  onSave={handleSave}
                  saving={saving}
                />
              ))}
            </div>
          </section>

          {/* 3D Printers */}
          <section className="mb-8">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-[color:var(--foreground)]">3D Printers & Manufacturing</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PRINTERS.map((def) => (
                <ConnectorCard
                  key={def.vendor}
                  def={def}
                  integration={getIntegration(def.vendor)}
                  onSave={handleSave}
                  saving={saving}
                />
              ))}
            </div>
          </section>

          {/* Practice Management */}
          <section className="mb-8">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Practice Management Systems</h2>
              <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                Bidirectional patient and appointment synchronization — coming Q1 2026
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {PMS_CONNECTORS.map((def) => (
                <ConnectorCard
                  key={def.vendor}
                  def={def}
                  integration={undefined}
                  onSave={handleSave}
                  saving={saving}
                />
              ))}
            </div>
          </section>

          {/* Diagnostics */}
          <section>
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Connection Diagnostics</h2>
            </div>
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[color:var(--foreground)]">Run connectivity test for all configured integrations</p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">Verifies API endpoints are reachable and credentials are valid</p>
                </div>
                <a
                  href="/api/scanner/diagnostics"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs font-semibold text-[color:var(--foreground)] hover:bg-[color:var(--border)]/40 transition-colors"
                >
                  <Plug size={13} /> Run Test
                </a>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
