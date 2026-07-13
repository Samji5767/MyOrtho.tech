"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, BellOff, CheckCircle2 } from "lucide-react";
import { safeStorage } from "@/lib/safeStorage";

// ─── Notification preference definitions ──────────────────────────────────────

const PREF_GROUPS = [
  {
    label: "Cases",
    items: [
      { key: "notif_case_assigned",     label: "Case assigned to me",          desc: "When a case is assigned to your name." },
      { key: "notif_case_status",       label: "Case status changes",          desc: "Transitions such as planning → review → approved." },
      { key: "notif_case_comment",      label: "New case comments",            desc: "When a colleague adds a note to your case." },
    ],
  },
  {
    label: "SLA & Alerts",
    items: [
      { key: "notif_sla_warning",       label: "SLA warning (24 h)",           desc: "Cases approaching their turnaround deadline." },
      { key: "notif_sla_breach",        label: "SLA breach",                   desc: "Cases that have exceeded their turnaround target." },
      { key: "notif_approval_required", label: "Approval required",            desc: "Treatment plans awaiting doctor sign-off." },
    ],
  },
  {
    label: "Manufacturing",
    items: [
      { key: "notif_print_complete",    label: "Print job complete",           desc: "When a lab print job finishes successfully." },
      { key: "notif_print_failed",      label: "Print job failed",             desc: "When a print job encounters an error." },
      { key: "notif_export_ready",      label: "Export package ready",         desc: "When a case export is ready to download." },
    ],
  },
  {
    label: "Administration",
    items: [
      { key: "notif_new_user",          label: "New team member joined",       desc: "When someone accepts an invitation to your clinic." },
      { key: "notif_credit_low",        label: "Credit balance low",           desc: "When your organization's credit balance drops below 10." },
    ],
  },
] as const;

type PrefKey = typeof PREF_GROUPS[number]["items"][number]["key"];

const ALL_KEYS = PREF_GROUPS.flatMap(g => g.items.map(i => i.key)) as PrefKey[];

function loadPrefs(): Record<PrefKey, boolean> {
  const defaults: Record<string, boolean> = {};
  ALL_KEYS.forEach(k => { defaults[k] = true; });
  ALL_KEYS.forEach(k => {
    const stored = safeStorage.get(k);
    if (stored !== null) defaults[k] = stored !== "0";
  });
  return defaults as Record<PrefKey, boolean>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={[
        "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] focus-visible:ring-offset-2",
        checked ? "bg-[color:var(--primary)]" : "bg-[color-mix(in_srgb,var(--border)_80%,transparent)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Record<PrefKey, boolean>>(loadPrefs);
  const [saved, setSaved] = useState(false);

  function toggle(key: PrefKey) {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] };
      safeStorage.set(key, next[key] ? "1" : "0");
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  const enabledCount = ALL_KEYS.filter(k => prefs[k]).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] transition-opacity hover:opacity-80"
          aria-label="Back to settings"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-[color:var(--foreground)]">Notifications</h1>
          <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
            Choose which events send you alerts.
          </p>
        </div>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} />
            Saved
          </span>
        )}
      </div>

      {/* Summary */}
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3 text-sm">
        {enabledCount > 0
          ? <Bell size={15} className="shrink-0 text-[color:var(--primary)]" />
          : <BellOff size={15} className="shrink-0 text-[color:var(--muted-foreground)]" />}
        <span className="text-[color:var(--foreground)]">
          <strong>{enabledCount}</strong> of <strong>{ALL_KEYS.length}</strong> notification types enabled
        </span>
      </div>

      {/* Preference groups */}
      <div className="space-y-5">
        {PREF_GROUPS.map(group => (
          <div key={group.label} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
            <div className="border-b border-[color:var(--border)] px-5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
                {group.label}
              </p>
            </div>
            <div className="divide-y divide-[color:var(--border)]">
              {group.items.map(item => (
                <div key={item.key} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{item.label}</p>
                    <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{item.desc}</p>
                  </div>
                  <Toggle
                    checked={prefs[item.key]}
                    onChange={() => toggle(item.key)}
                    label={item.label}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-xs text-[color:var(--muted-foreground)]">
        Preferences are stored locally on this device. In-app alerts are always active for critical clinical events.
      </p>
    </div>
  );
}
