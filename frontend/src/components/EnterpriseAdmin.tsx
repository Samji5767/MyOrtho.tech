"use client";

import { useState } from "react";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Globe,
  KeyRound,
  Layers3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  User,
  UserCheck,
  UserCog,
  Users,
  X,
} from "lucide-react";
import type { Clinic, OrthoRole, OrthoUser, Organization } from "@/types/orthodontic";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_CLINICS: Clinic[] = [
  { id: "cln-sf-01", name: "Faizal Orthodontics — SF",    organizationId: "org-01", address: "123 Market St", city: "San Francisco, CA", country: "USA",     phone: "+1 (415) 555-0101", email: "sf@faizalortho.com",     licenseNumber: "CA-OT-2219", activeCases: 82,  totalPatients: 340, isActive: true,  createdAt: "2022-01-15" },
  { id: "cln-la-01", name: "Faizal Orthodontics — LA",    organizationId: "org-01", address: "455 Wilshire Blvd", city: "Los Angeles, CA", country: "USA",  phone: "+1 (213) 555-0202", email: "la@faizalortho.com",     licenseNumber: "CA-OT-3341", activeCases: 46,  totalPatients: 182, isActive: true,  createdAt: "2023-06-01" },
  { id: "cln-ny-01", name: "Kowalski Dental Group",        organizationId: "org-01", address: "200 Park Ave", city: "New York, NY",    country: "USA",        phone: "+1 (212) 555-0303", email: "admin@kowalskidental.com", licenseNumber: "NY-OT-8821", activeCases: 124, totalPatients: 510, isActive: true,  createdAt: "2021-09-15" },
  { id: "cln-to-01", name: "Orthodontics Pro Toronto",     organizationId: "org-01", address: "100 King St W", city: "Toronto, ON",     country: "Canada",    phone: "+1 (416) 555-0404", email: "toronto@orthopro.ca",    licenseNumber: "ON-OT-1122", activeCases: 38,  totalPatients: 155, isActive: false, createdAt: "2024-01-10" },
];

const MOCK_USERS: OrthoUser[] = [
  { id: "u1", email: "aryan.faizal@faizalortho.com",   fullName: "Dr. Aryan Faizal",     role: "orthodontist",    clinicId: "cln-sf-01", clinicName: "SF Clinic",  avatarInitials: "AF", isActive: true,  lastLogin: "2024-06-21 09:12", createdAt: "2022-01-15" },
  { id: "u2", email: "kowalski@kowalskidental.com",    fullName: "Dr. Mark Kowalski",    role: "orthodontist",    clinicId: "cln-ny-01", clinicName: "NY Clinic",  avatarInitials: "MK", isActive: true,  lastLogin: "2024-06-20 17:40", createdAt: "2021-09-15" },
  { id: "u3", email: "santos@lab.faizalortho.com",     fullName: "Maria Santos",         role: "lab_technician",  clinicId: "cln-sf-01", clinicName: "SF Clinic",  avatarInitials: "MS", isActive: true,  lastLogin: "2024-06-21 10:50", createdAt: "2022-03-01" },
  { id: "u4", email: "planner@faizalortho.com",        fullName: "James Lin",            role: "treatment_planner",clinicId: "cln-sf-01", clinicName: "SF Clinic",  avatarInitials: "JL", isActive: true,  lastLogin: "2024-06-21 08:00", createdAt: "2023-01-10" },
  { id: "u5", email: "reviewer@kowalskidental.com",    fullName: "Dr. Sarah Osei",       role: "reviewer",        clinicId: "cln-ny-01", clinicName: "NY Clinic",  avatarInitials: "SO", isActive: true,  lastLogin: "2024-06-19 14:22", createdAt: "2022-11-01" },
  { id: "u6", email: "admin@faizalortho.com",          fullName: "Kevin Nguyen",         role: "clinic_admin",    clinicId: "cln-sf-01", clinicName: "SF Clinic",  avatarInitials: "KN", isActive: true,  lastLogin: "2024-06-21 07:30", createdAt: "2022-01-15" },
  { id: "u7", email: "readonly@kowalskidental.com",    fullName: "Audit Observer",       role: "read_only",       clinicId: "cln-ny-01", clinicName: "NY Clinic",  avatarInitials: "AO", isActive: false, lastLogin: "2024-05-01 11:00", createdAt: "2023-08-15" },
];

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

// ─── Clinic card ──────────────────────────────────────────────────────────────

function ClinicCard({ clinic }: { clinic: Clinic }) {
  return (
    <div className={`rounded-xl border p-5 ${!clinic.isActive ? "opacity-60 border-[color:var(--border)]" : "border-[color:var(--border)]"} bg-[color:var(--card)]`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
            <Building2 size={18} />
          </span>
          <div>
            <p className="font-bold text-[color:var(--foreground)]">{clinic.name}</p>
            <p className="text-xs text-[color:var(--muted-foreground)]">{clinic.city} · {clinic.country}</p>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${clinic.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"}`}>
          {clinic.isActive ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="flex items-center gap-1.5 text-[color:var(--muted-foreground)]"><Phone size={11} /> {clinic.phone}</div>
        <div className="flex items-center gap-1.5 text-[color:var(--muted-foreground)]"><Mail size={11} /> {clinic.email}</div>
        <div className="flex items-center gap-1.5 text-[color:var(--muted-foreground)]"><ShieldCheck size={11} /> Lic: {clinic.licenseNumber}</div>
        <div className="flex items-center gap-1.5 text-[color:var(--muted-foreground)]"><MapPin size={11} /> {clinic.address}</div>
      </div>
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] p-2 text-center">
          <p className="text-lg font-black tabular-nums text-[color:var(--primary)]">{clinic.activeCases}</p>
          <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">Active Cases</p>
        </div>
        <div className="flex-1 rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] p-2 text-center">
          <p className="text-lg font-black tabular-nums text-[color:var(--foreground)]">{clinic.totalPatients}</p>
          <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">Patients</p>
        </div>
      </div>
    </div>
  );
}

// ─── User row ─────────────────────────────────────────────────────────────────

function UserRow({ user }: { user: OrthoUser }) {
  const roleCfg = ROLE_CONFIGS[user.role];

  return (
    <div className={`flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3.5 ${!user.isActive ? "opacity-50" : ""}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--primary-glow)] text-sm font-black text-[color:var(--primary)]">
        {user.avatarInitials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="font-bold text-[color:var(--foreground)]">{user.fullName}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${roleCfg.bg} ${roleCfg.color}`}>
            {roleCfg.label}
          </span>
          {!user.isActive && <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-bold text-slate-500">Inactive</span>}
        </div>
        <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5">{user.email} · {user.clinicName}</p>
        {user.lastLogin && <p className="text-[10px] text-[color:var(--muted-foreground)]">Last login: {user.lastLogin}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button type="button" className="rounded-lg border border-[color:var(--border)] p-2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
          <UserCog size={14} />
        </button>
        <button type="button" className="rounded-lg border border-rose-300/50 p-2 text-rose-400 hover:text-rose-600 dark:border-rose-700/40">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── RBAC Matrix ──────────────────────────────────────────────────────────────

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
                        : <X size={12} className="mx-auto text-slate-300 dark:text-slate-600" />
                      }
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

// ─── Main Component ───────────────────────────────────────────────────────────

export function EnterpriseAdmin() {
  const [activeTab, setActiveTab] = useState<"clinics" | "users" | "roles" | "settings">("clinics");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<OrthoRole | "all">("all");

  const filteredUsers = MOCK_USERS.filter(u => {
    const matchSearch = u.fullName.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "all" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Enterprise Administration</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Platform Administration</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Manage clinics, doctors, labs, roles, and organizational settings.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-bold text-white">
            <Plus size={14} /> Add User
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Clinics",  value: MOCK_CLINICS.length,             color: "text-[color:var(--primary)]" },
          { label: "Active Clinics", value: MOCK_CLINICS.filter(c => c.isActive).length, color: "text-emerald-600" },
          { label: "Total Users",    value: MOCK_USERS.length,               color: "text-[color:var(--foreground)]" },
          { label: "Orthodontists",  value: MOCK_USERS.filter(u => u.role === "orthodontist").length, color: "text-violet-600" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
            <p className={`text-2xl font-black tabular-nums ${s.color}`}>{s.value}</p>
            <p className="mt-0.5 text-xs font-semibold text-[color:var(--muted-foreground)]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {(["clinics", "users", "roles", "settings"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all capitalize ${activeTab === tab ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
          >
            {tab === "roles" ? "RBAC" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Clinics */}
      {activeTab === "clinics" && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {MOCK_CLINICS.map(c => <ClinicCard key={c.id} clinic={c} />)}
          <button type="button" className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[color:var(--border)] p-8 text-[color:var(--muted-foreground)] hover:border-[color:var(--primary)]/50 hover:text-[color:var(--foreground)] transition-colors">
            <Plus size={24} />
            <span className="text-sm font-semibold">Add Clinic</span>
          </button>
        </div>
      )}

      {/* Users */}
      {activeTab === "users" && (
        <div className="space-y-4">
          {/* Filters */}
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
              onChange={e => setRoleFilter(e.target.value as OrthoRole | "all")}
              className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-sm text-[color:var(--foreground)] outline-none"
            >
              <option value="all">All roles</option>
              {(Object.keys(ROLE_CONFIGS) as OrthoRole[]).map(role => (
                <option key={role} value={role}>{ROLE_CONFIGS[role].label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            {filteredUsers.map(u => <UserRow key={u.id} user={u} />)}
          </div>
        </div>
      )}

      {/* RBAC */}
      {activeTab === "roles" && (
        <div className="space-y-5">
          <RBACMatrix />

          {/* Role descriptions */}
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

      {/* Settings */}
      {activeTab === "settings" && (
        <div className="grid gap-5 xl:grid-cols-2">
          {[
            {
              title: "Security",
              icon: ShieldCheck,
              items: [
                { label: "SSO Provider",        value: "Okta (configured)",        badge: "Active" },
                { label: "MFA Policy",           value: "Required for all users",   badge: "Enforced" },
                { label: "Session Timeout",      value: "8 hours",                  badge: "" },
                { label: "PHI Export Policy",    value: "Requires doctor approval", badge: "" },
                { label: "Audit Log Retention",  value: "90 days hot / 7 years cold", badge: "" },
              ],
            },
            {
              title: "Clinical Defaults",
              icon: Stethoscope,
              items: [
                { label: "Default Scanner",       value: "iTero Element 5D",         badge: "" },
                { label: "Layer Height",          value: "100 µm",                   badge: "" },
                { label: "Treatment Protocol",    value: "Clear Aligner Comprehensive", badge: "" },
                { label: "Aligner Material",      value: "DentaGuard Ortho Clear",   badge: "" },
                { label: "AI Engine",             value: "MyOrtho Segment v2.1",     badge: "Active" },
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
    </div>
  );
}

export default EnterpriseAdmin;
