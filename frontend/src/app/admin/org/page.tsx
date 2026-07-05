"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Save, ShieldAlert } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button, SkeletonBlock } from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgProfile {
  name: string;
  type: string;
}

// Raw shape returned by /api/admin/orgs
interface RawOrg {
  id: string;
  name: string;
  type: string;
  created_at: string;
  user_count?: number;
  credit_balance?: number;
}

// ─── Field component ──────────────────────────────────────────────────────────

function Field({
  label,
  icon,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
        {icon}
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2.5 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none"
      />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMPTY: OrgProfile = { name: "", type: "clinic" };

export default function AdminOrgPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<OrgProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    if (user && !isAdmin) router.replace("/admin");
  }, [user, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/orgs", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: RawOrg[]) => {
        const org = Array.isArray(data)
          ? data.find(o => o.id === user?.orgId) ?? data[0]
          : null;
        if (org) setProfile({ name: org.name, type: org.type });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAdmin, user?.orgId]);

  function set(key: keyof OrgProfile) {
    return (v: string) => setProfile(p => ({ ...p, [key]: v }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      await fetch("/api/admin/orgs", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  if (!user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[color:var(--foreground)]">Organization</h1>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          Clinic profile, contact details, and location.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
        <ShieldAlert size={15} className="shrink-0" />
        <span>Only <strong>admin</strong> and <strong>super_admin</strong> accounts can edit organization settings.</span>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map(i => <SkeletonBlock key={i} className="h-12 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Identity */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
              <Building2 size={15} className="text-[color:var(--primary)]" />
              Identity
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Clinic name" icon={<Building2 size={11} />} value={profile.name} onChange={set("name")} placeholder="Smile Orthodontics" />
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
                  <Building2 size={11} />
                  Type
                </label>
                <select
                  value={profile.type}
                  onChange={e => set("type")(e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2.5 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
                >
                  <option value="clinic">Clinic</option>
                  <option value="lab">Lab</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                Saved
              </span>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Save size={14} />
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
