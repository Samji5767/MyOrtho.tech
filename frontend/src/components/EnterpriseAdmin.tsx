"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Flag,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  UserCog,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  getPlatformStats,
  listAdminUsers,
  listAdminOrgs,
  listAdminAudit,
  updateUserRole,
  setUserActive,
  grantCredits,
  getRevenueDashboard,
  listFeatureFlags,
  upsertFeatureFlag,
  type AdminUser,
  type AdminOrg,
  type AdminAuditEvent,
  type PlatformStats,
  type FeatureFlag,
  type RevenueDashboard,
} from "@/lib/api/admin";
import type { OrthoRole } from "@/types/orthodontic";

// ─── Role configs ─────────────────────────────────────────────────────────────

const ROLE_CONFIGS: Record<OrthoRole, { label: string; color: string; bg: string; permissions: string[] }> = {
  super_admin:       { label: "Super Admin",        color: "text-rose-600",    bg: "bg-rose-500/10",    permissions: ["All platform permissions", "Manage organizations", "Manage billing"] },
  clinic_admin:      { label: "Clinic Admin",       color: "text-orange-600",  bg: "bg-orange-500/10",  permissions: ["Manage clinic settings", "Add/remove users", "View all cases"] },
  orthodontist:      { label: "Orthodontist",       color: "text-violet-600",  bg: "bg-violet-500/10",  permissions: ["Approve treatment plans", "Review segmentation", "View all cases", "Create cases"] },
  dentist:           { label: "Dentist",            color: "text-blue-600",    bg: "bg-blue-500/10",    permissions: ["Create cases", "Upload scans", "View own cases"] },
  treatment_planner: { label: "Treatment Planner",  color: "text-teal-600",    bg: "bg-teal-500/10",    permissions: ["Create treatment plans", "Edit CAD designs", "View assigned cases"] },
  lab_technician:    { label: "Lab Technician",     color: "text-sky-600",     bg: "bg-sky-500/10",     permissions: ["Manage print jobs", "QC inspection", "View manufacturing queue"] },
  reviewer:          { label: "Reviewer",           color: "text-indigo-600",  bg: "bg-indigo-500/10",  permissions: ["Review and comment on plans", "View all cases (read)", "Cannot approve"] },
  read_only:         { label: "Read Only",          color: "text-slate-500",   bg: "bg-slate-500/10",   permissions: ["View reports and analytics", "No edit permissions"] },
};

const PERMISSIONS = [
  { key: "create_case",    label: "Create Cases" },
  { key: "upload_scan",    label: "Upload Scans" },
  { key: "approve_plan",   label: "Approve Plans" },
  { key: "run_ai",         label: "Run AI Segmentation" },
  { key: "edit_cad",       label: "Edit CAD Design" },
  { key: "manage_mfg",     label: "Manage Manufacturing" },
  { key: "qc_inspect",     label: "QC Inspection" },
  { key: "view_analytics", label: "View Analytics" },
  { key: "manage_users",   label: "Manage Users" },
  { key: "billing",        label: "Billing Access" },
];

const ROLE_PERMISSION_MATRIX: Record<OrthoRole, string[]> = {
  super_admin:       ["create_case", "upload_scan", "approve_plan", "run_ai", "edit_cad", "manage_mfg", "qc_inspect", "view_analytics", "manage_users", "billing"],
  clinic_admin:      ["create_case", "upload_scan", "approve_plan", "run_ai", "edit_cad", "manage_mfg", "qc_inspect", "view_analytics", "manage_users"],
  orthodontist:      ["create_case", "upload_scan", "approve_plan", "run_ai", "edit_cad", "view_analytics"],
  dentist:           ["create_case", "upload_scan", "view_analytics"],
  treatment_planner: ["create_case", "upload_scan", "run_ai", "edit_cad"],
  lab_technician:    ["manage_mfg", "qc_inspect"],
  reviewer:          ["view_analytics"],
  read_only:         ["view_analytics"],
};

// ─── RBAC Matrix ──────────────────────────────────────────────────────────────

function RBACMatrix() {
  const roles: OrthoRole[] = ["super_admin", "clinic_admin", "orthodontist", "dentist", "treatment_planner", "lab_technician", "reviewer", "read_only"];
  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <KeyRound size={15} className="text-[color:var(--primary)]" />
        <h3 className="font-bold text-[color:var(--foreground)]">Role-Based Access Control Matrix</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-[color:var(--card)] px-3 py-2 text-left font-bold text-[color:var(--muted-foreground)] min-w-[160px]">Permission</th>
              {roles.map(role => (
                <th key={role} className="px-2 py-2 text-center font-bold text-[color:var(--muted-foreground)] min-w-[90px]">
                  <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${ROLE_CONFIGS[role].bg} ${ROLE_CONFIGS[role].color}`}>
                    {ROLE_CONFIGS[role].label.split(" ")[0]}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((perm, i) => (
              <tr key={perm.key} className={i % 2 === 0 ? "bg-[color:var(--background)]" : ""}>
                <td className="sticky left-0 px-3 py-2 font-semibold text-[color:var(--foreground)]" style={{ background: i % 2 === 0 ? "var(--background)" : "var(--card)" }}>
                  {perm.label}
                </td>
                {roles.map(role => {
                  const has = ROLE_PERMISSION_MATRIX[role].includes(perm.key);
                  return (
                    <td key={role} className="px-2 py-2 text-center">
                      {has
                        ? <CheckCircle2 size={14} className="mx-auto text-emerald-500" />
                        : <X size={12} className="mx-auto text-slate-300 dark:text-slate-600" />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Users tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listAdminUsers({ limit: 200 })
      .then(setUsers)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchR = roleFilter === "all" || u.role === roleFilter;
    return matchQ && matchR;
  });

  async function handleRoleChange(userId: string, role: string) {
    setUpdating(userId);
    try {
      await updateUserRole(userId, role);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  }

  async function handleToggleActive(userId: string, current: boolean) {
    setUpdating(userId);
    try {
      await setUserActive(userId, !current);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !current } : u));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-[color:var(--primary)]" /></div>;
  if (error) return <div className="rounded-xl border border-red-200/60 bg-red-50/60 p-4 text-sm text-red-600 dark:border-red-700/30 dark:bg-red-900/10 dark:text-red-400">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="flex h-10 flex-1 items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 min-w-[200px]">
          <Search size={14} className="text-[color:var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Search users…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] outline-none"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-sm text-[color:var(--foreground)] outline-none"
        >
          <option value="all">All roles</option>
          {(Object.keys(ROLE_CONFIGS) as OrthoRole[]).map(r => (
            <option key={r} value={r}>{ROLE_CONFIGS[r].label}</option>
          ))}
        </select>
        <button onClick={load} className="flex h-10 items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      <div className="space-y-2">
        {filtered.length === 0 && <p className="py-10 text-center text-sm text-[color:var(--muted-foreground)]">No users found.</p>}
        {filtered.map(u => {
          const roleCfg = ROLE_CONFIGS[u.role as OrthoRole] ?? { label: u.role, color: "text-slate-500", bg: "bg-slate-500/10" };
          const isUpdating = updating === u.id;
          return (
            <div key={u.id} className={`flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3.5 ${!u.is_active ? "opacity-50" : ""}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--primary-glow)] text-sm font-black text-[color:var(--primary)]">
                {(u.full_name || u.email).slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="font-bold text-[color:var(--foreground)]">{u.full_name || u.email}</span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${roleCfg.bg} ${roleCfg.color}`}>
                    {roleCfg.label}
                  </span>
                  {!u.is_active && <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-500">Inactive</span>}
                </div>
                <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">
                  {u.email} · {u.organization_name ?? "No org"}
                </p>
                {u.last_login_at && (
                  <p className="text-[10px] text-[color:var(--muted-foreground)]">
                    Last login: {new Date(u.last_login_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {isUpdating ? (
                  <Loader2 size={14} className="animate-spin text-[color:var(--muted-foreground)]" />
                ) : (
                  <>
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u.id, e.target.value)}
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-xs text-[color:var(--foreground)] outline-none"
                    >
                      {(Object.keys(ROLE_CONFIGS) as OrthoRole[]).map(r => (
                        <option key={r} value={r}>{ROLE_CONFIGS[r].label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(u.id, u.is_active)}
                      title={u.is_active ? "Deactivate user" : "Activate user"}
                      className={`rounded-lg border px-2 py-1 text-xs font-bold transition-colors ${u.is_active
                        ? "border-red-300/50 text-red-500 hover:bg-red-50 dark:border-red-700/40 dark:hover:bg-red-900/10"
                        : "border-emerald-300/50 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-700/40 dark:hover:bg-emerald-900/10"}`}
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Orgs tab ─────────────────────────────────────────────────────────────────

function OrgsTab() {
  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [granting, setGranting] = useState<string | null>(null);
  const [grantAmount, setGrantAmount] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listAdminOrgs({ limit: 100 })
      .then(setOrgs)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleGrant(orgId: string) {
    const amt = parseInt(grantAmount[orgId] ?? "0", 10);
    if (!amt || amt <= 0) return;
    setGranting(orgId);
    try {
      await grantCredits(orgId, amt, `Admin manual grant`);
      setOrgs(prev => prev.map(o => o.id === orgId ? { ...o, credit_balance: o.credit_balance + amt } : o));
      setGrantAmount(prev => ({ ...prev, [orgId]: "" }));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Grant failed");
    } finally {
      setGranting(null);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-[color:var(--primary)]" /></div>;
  if (error) return <div className="rounded-xl border border-red-200/60 bg-red-50/60 p-4 text-sm text-red-600 dark:border-red-700/30 dark:bg-red-900/10 dark:text-red-400">{error}</div>;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
      {orgs.length === 0 && <p className="col-span-2 py-10 text-center text-sm text-[color:var(--muted-foreground)]">No organizations found.</p>}
      {orgs.map(org => (
        <div key={org.id} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
                <Building2 size={18} />
              </span>
              <div>
                <p className="font-bold text-[color:var(--foreground)]">{org.name}</p>
                <p className="text-xs text-[color:var(--muted-foreground)] capitalize">{org.type} · {org.user_count} users</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">Credits</p>
              <p className="text-xl font-black text-[color:var(--primary)]">{org.credit_balance}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              placeholder="Amount"
              value={grantAmount[org.id] ?? ""}
              onChange={e => setGrantAmount(prev => ({ ...prev, [org.id]: e.target.value }))}
              className="flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1.5 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] outline-none"
            />
            <button
              onClick={() => handleGrant(org.id)}
              disabled={granting === org.id || !grantAmount[org.id]}
              className="flex items-center gap-1.5 rounded-lg bg-[color:var(--primary)] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            >
              {granting === org.id ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
              Grant
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Audit tab ────────────────────────────────────────────────────────────────

function AuditTab() {
  const [events, setEvents] = useState<AdminAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listAdminAudit({ limit: 100 })
      .then(setEvents)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-[color:var(--primary)]" /></div>;
  if (error) return <div className="rounded-xl border border-red-200/60 bg-red-50/60 p-4 text-sm text-red-600 dark:border-red-700/30 dark:bg-red-900/10 dark:text-red-400">{error}</div>;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {events.length === 0 && <p className="py-10 text-center text-sm text-[color:var(--muted-foreground)]">No audit events yet.</p>}
      <div className="divide-y divide-[color:var(--border)] rounded-xl border border-[color:var(--border)] overflow-hidden">
        {events.map(ev => (
          <div key={ev.id} className="flex items-start gap-3 bg-[color:var(--card)] px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="rounded-full bg-[color:var(--primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[color:var(--primary)]">
                  {ev.resource_type}
                </span>
                <span className="text-sm font-semibold text-[color:var(--foreground)]">{ev.action}</span>
                {ev.org_name && <span className="text-xs text-[color:var(--muted-foreground)]">· {ev.org_name}</span>}
              </div>
              <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                {ev.actor_name ?? ev.actor_email ?? "system"} · {new Date(ev.created_at).toLocaleString()}
                {ev.ip_address && ` · ${ev.ip_address}`}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Revenue tab ─────────────────────────────────────────────────────────────

function RevenueTab() {
  const [data, setData] = useState<RevenueDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    getRevenueDashboard()
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-[color:var(--primary)]" /></div>;
  if (error || !data) return <div className="rounded-xl border border-red-200/60 bg-red-50/60 p-4 text-sm text-red-600 dark:border-red-700/30 dark:bg-red-900/10 dark:text-red-400">{error ?? "No data"}</div>;

  const fmt = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "MRR",         value: fmt(data.mrrCents),         icon: DollarSign,  color: "text-emerald-600" },
          { label: "ARR",         value: fmt(data.arrCents),         icon: TrendingUp,  color: "text-blue-600" },
          { label: "PAYG Revenue",value: fmt(data.paygRevenueCents), icon: Zap,         color: "text-amber-500" },
          { label: "Total Exports",value: String(data.totalExports), icon: ArrowUpRight,color: "text-violet-600" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={s.color} />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">{s.label}</p>
              </div>
              <p className={`text-xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Plans */}
      <div className="ios-card p-5">
        <h3 className="font-bold text-[color:var(--foreground)] mb-3">Subscription Plans</h3>
        <div className="space-y-2">
          {data.plans.length === 0 && <p className="text-sm text-[color:var(--muted-foreground)]">No active subscriptions.</p>}
          {data.plans.map(p => (
            <div key={p.slug} className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{p.name}</p>
                <p className="text-xs text-[color:var(--muted-foreground)]">{p.subscriberCount} subscribers · {fmt(p.priceCents)}/mo</p>
              </div>
              <p className="text-sm font-bold text-emerald-600">{fmt(p.mrrCents)} MRR</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top orgs */}
      <div className="ios-card p-5">
        <h3 className="font-bold text-[color:var(--foreground)] mb-3">Top Organisations by Case Volume</h3>
        <div className="space-y-2">
          {data.topOrgs.length === 0 && <p className="text-sm text-[color:var(--muted-foreground)]">No data yet.</p>}
          {data.topOrgs.map((o, i) => (
            <div key={o.name} className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5">
              <span className="text-[10px] font-black text-[color:var(--muted-foreground)] w-4 text-center">#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[color:var(--foreground)] truncate">{o.name}</p>
                <p className="text-xs text-[color:var(--muted-foreground)]">{o.credits} credits</p>
              </div>
              <p className="text-sm font-bold text-[color:var(--primary)]">{o.case_count} cases</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Feature flags tab ────────────────────────────────────────────────────────

function FlagsTab() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    listFeatureFlags()
      .then(setFlags)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (flag: FeatureFlag) => {
    setUpdating(flag.flagKey);
    try {
      const updated = await upsertFeatureFlag(flag.flagKey, { enabled: !flag.enabled });
      setFlags(prev => prev.map(f => f.flagKey === flag.flagKey ? updated : f));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  };

  const setRollout = async (flag: FeatureFlag, pct: number) => {
    setUpdating(flag.flagKey);
    try {
      const updated = await upsertFeatureFlag(flag.flagKey, { rolloutPercentage: pct });
      setFlags(prev => prev.map(f => f.flagKey === flag.flagKey ? updated : f));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={22} className="animate-spin text-[color:var(--primary)]" /></div>;
  if (error) return <div className="rounded-xl border border-red-200/60 bg-red-50/60 p-4 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {flags.length === 0 && <p className="py-10 text-center text-sm text-[color:var(--muted-foreground)]">No feature flags defined yet.</p>}
      {flags.map(flag => {
        const busy = updating === flag.flagKey;
        return (
          <div key={flag.flagKey} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => toggle(flag)}
                disabled={busy}
                className="mt-0.5 shrink-0 disabled:opacity-50"
                title={flag.enabled ? "Disable flag" : "Enable flag"}
              >
                {busy
                  ? <Loader2 size={20} className="animate-spin text-[color:var(--muted-foreground)]" />
                  : flag.enabled
                    ? <ToggleRight size={22} className="text-emerald-500" />
                    : <ToggleLeft size={22} className="text-slate-400" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="text-sm font-bold text-[color:var(--foreground)]">{flag.flagKey}</code>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${flag.enabled ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"}`}>
                    {flag.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                {flag.description && (
                  <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">{flag.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <label className="text-xs text-[color:var(--muted-foreground)]">Rollout %</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={flag.rolloutPercentage}
                    onChange={e => setRollout(flag, parseInt(e.target.value, 10))}
                    disabled={busy}
                    className="flex-1 h-1.5 accent-[color:var(--primary)]"
                  />
                  <span className="w-10 text-right text-xs font-bold text-[color:var(--foreground)] tabular-nums">
                    {flag.rolloutPercentage}%
                  </span>
                </div>
                {flag.allowedOrgIds.length > 0 && (
                  <p className="text-[10px] text-[color:var(--muted-foreground)] mt-1">
                    Org allowlist: {flag.allowedOrgIds.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "users" | "orgs" | "roles" | "audit" | "revenue" | "flags" | "settings";

export function EnterpriseAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    getPlatformStats().then(setStats).catch(() => null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Enterprise Administration</p>
        <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Platform Administration</h2>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Manage users, organizations, credits, roles, and audit logs.</p>
      </div>

      {/* Live stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Organizations",  value: stats?.orgs.total,            icon: Building2,     color: "text-[color:var(--primary)]" },
          { label: "Active Users",   value: stats?.users.active,          icon: Users,         color: "text-emerald-600" },
          { label: "Total Cases",    value: stats?.cases.total,           icon: ClipboardList, color: "text-violet-600" },
          { label: "Credits Held",   value: stats?.credits.total,         icon: Zap,           color: "text-amber-500" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={13} className={s.color} />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">{s.label}</p>
              </div>
              <p className={`text-2xl font-black tabular-nums ${s.color}`}>
                {s.value === undefined ? <Loader2 size={18} className="animate-spin" /> : s.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {([
          { id: "users",    label: "Users",    icon: Users },
          { id: "orgs",     label: "Orgs",     icon: Building2 },
          { id: "roles",    label: "RBAC",     icon: KeyRound },
          { id: "audit",    label: "Audit Log", icon: Activity },
          { id: "revenue",  label: "Revenue",  icon: DollarSign },
          { id: "flags",    label: "Flags",    icon: Flag },
          { id: "settings", label: "Settings", icon: ShieldCheck },
        ] as const).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${activeTab === tab.id ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
            >
              <Icon size={13} /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "users"    && <UsersTab />}
      {activeTab === "orgs"     && <OrgsTab />}
      {activeTab === "roles"    && (
        <div className="space-y-5">
          <RBACMatrix />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {(Object.entries(ROLE_CONFIGS) as [OrthoRole, typeof ROLE_CONFIGS[OrthoRole]][]).map(([role, cfg]) => (
              <div key={role} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold mb-2 ${cfg.bg} ${cfg.color}`}>
                  {cfg.label}
                </span>
                <ul className="space-y-1">
                  {cfg.permissions.map(p => (
                    <li key={p} className="flex items-start gap-1.5 text-xs text-[color:var(--muted-foreground)]">
                      <CheckCircle2 size={11} className="mt-0.5 shrink-0 text-emerald-500" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
      {activeTab === "audit"    && <AuditTab />}
      {activeTab === "revenue"  && <RevenueTab />}
      {activeTab === "flags"    && <FlagsTab />}
      {activeTab === "settings" && (
        <div className="grid gap-5 xl:grid-cols-2">
          {[
            {
              title: "Security",
              icon: ShieldCheck,
              items: [
                { label: "Session Token",        value: "HttpOnly cookie",         badge: "" },
                { label: "MFA Policy",           value: "Recommended for admins",  badge: "" },
                { label: "Session Timeout",      value: "JWT exp: 7 days",         badge: "" },
                { label: "PHI Export Policy",    value: "Requires doctor approval",badge: "" },
                { label: "Audit Log Retention",  value: "90 days hot / 7 yrs cold",badge: "" },
              ],
            },
            {
              title: "Clinical Defaults",
              icon: Stethoscope,
              items: [
                { label: "Default Scanner",      value: "iTero Element 5D",        badge: "" },
                { label: "Layer Height",         value: "100 µm",                  badge: "" },
                { label: "Treatment Protocol",   value: "Clear Aligner Comprehensive", badge: "" },
                { label: "Aligner Material",     value: "DentaGuard Ortho Clear",  badge: "" },
                { label: "AI Engine",            value: "MyOrtho Segment v2.1",    badge: "Active" },
              ],
            },
          ].map(section => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="ios-card p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Icon size={16} className="text-[color:var(--primary)]" />
                  <h3 className="font-bold text-[color:var(--foreground)]">{section.title}</h3>
                </div>
                <div className="space-y-2.5">
                  {section.items.map(item => (
                    <div key={item.label} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-[color:var(--muted-foreground)]">{item.label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-right text-[color:var(--foreground)]">{item.value}</span>
                        {item.badge && (
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">{item.badge}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        Admin actions are logged to the audit trail. Only super_admin accounts can access this panel.
      </div>

      {/* Manage user icon replacement */}
      <div className="hidden"><UserCog size={14} /></div>
    </div>
  );
}

export default EnterpriseAdmin;
