"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Users, Mail, Clock, MoreVertical, Search, UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button, SkeletonBlock } from "@/components/DesignSystem";
import { roleLabel, roleTone } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgMember {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  lastLogin: string | null;
}

// Raw shape returned by /api/admin/users (flat array, snake_case)
interface RawMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
}

function normalizeMember(r: RawMember): OrgMember {
  return {
    id: r.id,
    email: r.email,
    name: r.full_name,
    role: r.role,
    createdAt: r.created_at,
    lastLogin: r.last_login_at,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toneCls(tone: ReturnType<typeof roleTone>): string {
  const map: Record<string, string> = {
    danger:  "bg-rose-100 text-rose-700 dark:bg-rose-900/20 dark:text-rose-400",
    primary: "bg-[color:var(--primary)]/10 text-[color:var(--primary)]",
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
    warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
    info:    "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400",
    neutral: "bg-[color:var(--border)] text-[color:var(--muted-foreground)]",
  };
  return map[tone] ?? map.neutral;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES = ['admin', 'orthodontist', 'dentist', 'lab_manager', 'lab_technician', 'resident', 'executive'];

// ─── InviteUserModal ──────────────────────────────────────────────────────────

function InviteUserModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('orthodontist');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? 'Invite failed');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Invite Team Member</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[color:var(--muted-foreground)] mb-1.5">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="colleague@clinic.com"
              required
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[color:var(--muted-foreground)] mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
            >
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
            >
              {saving ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── RoleChangeModal ──────────────────────────────────────────────────────────

function RoleChangeModal({
  member,
  onClose,
  onSuccess,
}: {
  member: OrgMember;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [role, setRole] = useState(member.role);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (role === member.role) { onClose(); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${member.id}/role`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(data.message ?? 'Update failed');
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-2xl">
        <h2 className="text-base font-semibold text-[color:var(--foreground)] mb-4">Change Role</h2>
        <p className="text-sm text-[color:var(--muted-foreground)] mb-4">{member.name || member.email}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <select
            value={role}
            onChange={e => setRole(e.target.value)}
            className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
          >
            {ROLES.map(r => (
              <option key={r} value={r}>
                {r.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[color:var(--border)] px-4 py-2.5 text-sm font-semibold text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Update Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [roleTarget, setRoleTarget] = useState<OrgMember | null>(null);
  const [tick, setTick] = useState(0);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const reload = () => setTick(t => t + 1);

  useEffect(() => {
    if (user && !isAdmin) router.replace("/admin");
  }, [user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    fetch("/api/admin/users", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: RawMember[] | { members: RawMember[] }) => {
        const raw = Array.isArray(data) ? data : (data.members ?? []);
        setMembers(raw.map(normalizeMember));
      })
      .catch(() => setMembers([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, tick]);

  const filtered = members.filter(m =>
    search === "" ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase())
  );

  if (!user) return null;
  if (!isAdmin) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">Users &amp; Roles</h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Manage organization members and their access levels.
          </p>
        </div>
        <Button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          <UserPlus size={15} />
          Invite user
        </Button>
      </div>

      {/* Admin notice */}
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
        <ShieldAlert size={15} className="shrink-0" />
        <span>Changes to user roles are logged in the audit trail and take effect immediately.</span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
        <input
          type="search"
          placeholder="Search by name, email, or role…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] py-2.5 pl-9 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 border-b border-[color:var(--border)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
          <span>Member</span>
          <span className="hidden sm:block">Role</span>
          <span className="hidden md:block">Last login</span>
          <span />
        </div>

        {loading ? (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <Users size={32} className="text-[color:var(--muted-foreground)]/40" />
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {search ? "No members match your search." : "No members found."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--border)]">
            {filtered.map(member => (
              <li
                key={member.id}
                className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-5 py-3.5 hover:bg-[color:var(--border)]/20"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{member.name}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-[color:var(--muted-foreground)]">
                    <Mail size={10} className="shrink-0" />
                    {member.email}
                  </p>
                </div>
                <span className={`hidden rounded-full px-2.5 py-0.5 text-xs font-semibold sm:block ${toneCls(roleTone(member.role))}`}>
                  {roleLabel(member.role)}
                </span>
                <span className="hidden items-center gap-1 text-xs text-[color:var(--muted-foreground)] md:flex">
                  <Clock size={11} className="shrink-0" />
                  {formatDate(member.lastLogin)}
                </span>
                <button
                  aria-label={`Options for ${member.name}`}
                  onClick={() => setRoleTarget(member)}
                  className="rounded-lg p-1.5 text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)] hover:text-[color:var(--foreground)] focus-visible:outline-[color:var(--primary)]"
                >
                  <MoreVertical size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-[color:var(--muted-foreground)]">
        {filtered.length} {filtered.length === 1 ? "member" : "members"}
        {search && " matching search"} · Joined from{" "}
        {members.length > 0 ? formatDate(members[members.length - 1]?.createdAt) : "—"}
      </p>

      {showInvite && (
        <InviteUserModal
          onClose={() => setShowInvite(false)}
          onSuccess={reload}
        />
      )}
      {roleTarget && (
        <RoleChangeModal
          member={roleTarget}
          onClose={() => setRoleTarget(null)}
          onSuccess={reload}
        />
      )}
    </div>
  );
}
