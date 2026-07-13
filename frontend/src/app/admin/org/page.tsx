"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  DollarSign,
  Globe,
  Languages,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldAlert,
  Slash,
  Clock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button, SkeletonBlock } from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrgProfile {
  name: string;
  type: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  timezone: string;
  currency: string;
  language: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
  "America/Vancouver", "America/Sao_Paulo", "Europe/London", "Europe/Paris",
  "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Amsterdam",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Asia/Seoul",
  "Asia/Shanghai", "Australia/Sydney", "Australia/Melbourne", "Pacific/Auckland",
];

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "BRL", label: "BRL — Brazilian Real" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "KRW", label: "KRW — South Korean Won" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
];

// ─── Field components ─────────────────────────────────────────────────────────

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

function SelectField({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { value?: string; code?: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[color:var(--muted-foreground)]">
        {icon}
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-2.5 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
      >
        {options.map(o => {
          const key = o.value ?? o.code ?? o.label;
          return <option key={key} value={key}>{o.label}</option>;
        })}
      </select>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
      <span className="text-[color:var(--primary)]">{icon}</span>
      {title}
    </h2>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EMPTY: OrgProfile = {
  name: "", type: "clinic",
  email: "", phone: "", website: "",
  address: "", city: "", state: "", postalCode: "", country: "",
  timezone: "UTC", currency: "USD", language: "en",
};

export default function AdminOrgPage() {
  const { user, status } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<OrgProfile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  useEffect(() => {
    if (status === "loading") return;
    if (!user) router.replace("/login");
    else if (!isAdmin) router.replace("/admin");
  }, [user, isAdmin, status, router]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/admin/org", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: OrgProfile) => setProfile({
        name: data.name ?? "",
        type: data.type ?? "clinic",
        email: data.email ?? "",
        phone: data.phone ?? "",
        website: data.website ?? "",
        address: data.address ?? "",
        city: data.city ?? "",
        state: data.state ?? "",
        postalCode: data.postalCode ?? "",
        country: data.country ?? "",
        timezone: data.timezone ?? "UTC",
        currency: data.currency ?? "USD",
        language: data.language ?? "en",
      }))
      .catch(() => setLoadError("Failed to load organization settings. Please refresh."))
      .finally(() => setLoading(false));
  }, [isAdmin]);

  function set(key: keyof OrgProfile) {
    return (v: string) => setProfile(p => ({ ...p, [key]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/org", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? `Save failed (${res.status})`);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save organization settings");
    } finally {
      setSaving(false);
    }
  }

  if (status === "loading" || !user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[color:var(--foreground)]">Organization</h1>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          Clinic profile, contact details, and localization.
        </p>
      </div>

      <div className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-4 py-3 text-sm text-amber-700 dark:border-amber-600/30 dark:bg-amber-900/10 dark:text-amber-400">
        <ShieldAlert size={15} className="shrink-0" />
        <span>Only <strong>admin</strong> and <strong>super_admin</strong> accounts can edit organization settings.</span>
      </div>

      {loadError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
          <AlertCircle size={15} className="shrink-0" />
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-12 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-6">

          {/* Identity */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <SectionHeader icon={<Building2 size={15} />} title="Identity" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Clinic name"
                icon={<Building2 size={11} />}
                value={profile.name}
                onChange={set("name")}
                placeholder="Smile Orthodontics"
              />
              <SelectField
                label="Type"
                icon={<Building2 size={11} />}
                value={profile.type}
                onChange={set("type")}
                options={[
                  { value: "clinic", label: "Clinic" },
                  { value: "lab", label: "Lab" },
                  { value: "enterprise", label: "Enterprise" },
                ]}
              />
            </div>
          </div>

          {/* Contact */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <SectionHeader icon={<Mail size={15} />} title="Contact" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Email"
                icon={<Mail size={11} />}
                value={profile.email}
                onChange={set("email")}
                placeholder="info@yourclinic.com"
                type="email"
              />
              <Field
                label="Phone"
                icon={<Phone size={11} />}
                value={profile.phone}
                onChange={set("phone")}
                placeholder="+1 555 000 0000"
                type="tel"
              />
              <div className="sm:col-span-2">
                <Field
                  label="Website"
                  icon={<Globe size={11} />}
                  value={profile.website}
                  onChange={set("website")}
                  placeholder="https://yourclinic.com"
                  type="url"
                />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <SectionHeader icon={<MapPin size={15} />} title="Location" />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field
                  label="Street address"
                  icon={<MapPin size={11} />}
                  value={profile.address}
                  onChange={set("address")}
                  placeholder="123 Main St, Suite 100"
                />
              </div>
              <Field
                label="City"
                icon={<Slash size={11} />}
                value={profile.city}
                onChange={set("city")}
                placeholder="San Francisco"
              />
              <Field
                label="State / Province"
                icon={<Slash size={11} />}
                value={profile.state}
                onChange={set("state")}
                placeholder="CA"
              />
              <Field
                label="Postal code"
                icon={<Slash size={11} />}
                value={profile.postalCode}
                onChange={set("postalCode")}
                placeholder="94102"
              />
              <Field
                label="Country"
                icon={<Globe size={11} />}
                value={profile.country}
                onChange={set("country")}
                placeholder="United States"
              />
            </div>
          </div>

          {/* Localization */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <SectionHeader icon={<Languages size={15} />} title="Localization" />
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Timezone"
                icon={<Clock size={11} />}
                value={profile.timezone}
                onChange={set("timezone")}
                options={TIMEZONES.map(tz => ({ value: tz, label: tz }))}
              />
              <SelectField
                label="Currency"
                icon={<DollarSign size={11} />}
                value={profile.currency}
                onChange={set("currency")}
                options={CURRENCIES.map(c => ({ value: c.code, label: c.label }))}
              />
              <SelectField
                label="Language"
                icon={<Languages size={11} />}
                value={profile.language}
                onChange={set("language")}
                options={LANGUAGES.map(l => ({ value: l.code, label: l.label }))}
              />
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400">
              <AlertCircle size={15} className="shrink-0" />
              {saveError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={14} />
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
