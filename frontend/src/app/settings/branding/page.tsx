"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Globe, Image, Palette, Save, Type } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface OrgBranding {
  organization_id: string;
  clinic_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  custom_domain: string | null;
  footer_text: string | null;
  updated_at: string;
}

const ALLOWED_ROLES = ["super_admin", "admin", "clinical_director"];

export default function BrandingSettingsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [branding, setBranding] = useState<OrgBranding | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [clinicName, setClinicName]       = useState("");
  const [logoUrl, setLogoUrl]             = useState("");
  const [primaryColor, setPrimaryColor]   = useState("#0F9F8F");
  const [secondaryColor, setSecondaryColor] = useState("#1a1f2e");
  const [accentColor, setAccentColor]     = useState("#f59e0b");
  const [customDomain, setCustomDomain]   = useState("");
  const [footerText, setFooterText]       = useState("");

  useEffect(() => {
    if (!user) return;
    if (!ALLOWED_ROLES.includes(user.role)) {
      router.replace("/settings");
      return;
    }
    fetch("/api/org-branding", { credentials: "include" })
      .then(r => r.json())
      .then((data: OrgBranding) => {
        setBranding(data);
        setClinicName(data.clinic_name ?? "");
        setLogoUrl(data.logo_url ?? "");
        setPrimaryColor(data.primary_color ?? "#0F9F8F");
        setSecondaryColor(data.secondary_color ?? "#1a1f2e");
        setAccentColor(data.accent_color ?? "#f59e0b");
        setCustomDomain(data.custom_domain ?? "");
        setFooterText(data.footer_text ?? "");
      })
      .catch(() => setError("Could not load branding settings."))
      .finally(() => setLoading(false));
  }, [user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/org-branding", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clinic_name:     clinicName || undefined,
          logo_url:        logoUrl || undefined,
          primary_color:   primaryColor,
          secondary_color: secondaryColor,
          accent_color:    accentColor,
          custom_domain:   customDomain || undefined,
          footer_text:     footerText || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { message?: string };
        throw new Error(d.message ?? "Save failed.");
      }
      const updated: OrgBranding = await res.json();
      setBranding(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-[color:var(--primary)] border-t-transparent" />
      </div>
    );
  }

  const inputClass =
    "h-10 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none transition-colors";

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div>
        <h1 className="text-xl font-bold text-[color:var(--foreground)]">Clinic Branding</h1>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          Customize how your clinic appears across the platform and to your patients.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-400">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400">
          Branding saved successfully.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Identity */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <Building2 size={15} className="text-[color:var(--primary)]" />
            Clinic Identity
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[color:var(--foreground)]">Clinic name</label>
            <input
              type="text"
              value={clinicName}
              onChange={e => setClinicName(e.target.value)}
              placeholder="Alameda Orthodontics"
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[color:var(--foreground)]">
              <span className="flex items-center gap-1.5"><Image size={13} />Logo URL</span>
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="https://your-clinic.com/logo.png"
              className={inputClass}
            />
            {logoUrl && (
              <img
                src={logoUrl}
                alt="Logo preview"
                className="mt-2 h-12 w-auto rounded-lg border border-[color:var(--border)] object-contain p-1"
                onError={e => (e.currentTarget.style.display = "none")}
              />
            )}
          </div>
        </section>

        {/* Colors */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <Palette size={15} className="text-[color:var(--primary)]" />
            Brand Colors
          </div>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Primary", value: primaryColor, set: setPrimaryColor },
              { label: "Secondary", value: secondaryColor, set: setSecondaryColor },
              { label: "Accent", value: accentColor, set: setAccentColor },
            ].map(({ label, value, set }) => (
              <div key={label} className="space-y-1.5">
                <label className="text-xs font-semibold text-[color:var(--foreground)]">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={value}
                    onChange={e => set(e.target.value)}
                    className="h-10 w-10 cursor-pointer rounded-lg border border-[color:var(--border)] bg-transparent p-0.5"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder="#000000"
                    maxLength={7}
                    className="h-10 flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-2 text-xs font-mono text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Domain & Footer */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[color:var(--foreground)]">
            <Globe size={15} className="text-[color:var(--primary)]" />
            White Label
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[color:var(--foreground)]">Custom domain</label>
            <input
              type="text"
              value={customDomain}
              onChange={e => setCustomDomain(e.target.value)}
              placeholder="ortho.alamedaclinic.com"
              className={inputClass}
            />
            <p className="text-[10px] text-[color:var(--muted-foreground)]">
              Point a CNAME to your MyOrtho subdomain after saving.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[color:var(--foreground)]">
              <span className="flex items-center gap-1.5"><Type size={13} />Footer text</span>
            </label>
            <input
              type="text"
              value={footerText}
              onChange={e => setFooterText(e.target.value)}
              placeholder="© 2025 Alameda Orthodontics. Powered by MyOrtho.tech"
              className={inputClass}
            />
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] text-sm font-semibold text-[color:var(--primary-foreground)] transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Saving…
            </>
          ) : (
            <>
              <Save size={15} />
              Save branding
            </>
          )}
        </button>
      </form>
    </div>
  );
}
