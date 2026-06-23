"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  Stethoscope,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/auth";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const ROLES = [
  "orthodontist",
  "dentist",
  "resident",
  "lab_technician",
  "lab_manager",
  "clinical_director",
  "executive",
];

const ORG_TYPES = [
  { value: "clinic", label: "Orthodontic Clinic" },
  { value: "lab",    label: "Dental Lab" },
  { value: "enterprise", label: "DSO / Enterprise Group" },
];

// ─── Step indicators ──────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={[
            "h-1.5 rounded-full transition-all duration-300",
            i < step ? "w-5 bg-[color:var(--primary)]" : i === step ? "w-3 bg-[color:var(--primary)]/60" : "w-1.5 bg-[color:var(--border)]",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState(user?.role ?? "orthodontist");
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("clinic");
  const [enableDemo, setEnableDemo] = useState(false);
  const [saving, setSaving] = useState(false);

  const TOTAL_STEPS = 5;

  async function finish() {
    setSaving(true);
    try {
      await fetch(`${API}/api/auth/onboarding`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: selectedRole, orgName, orgType, enableDemo }),
      });
    } catch {}
    await refresh();
    router.replace("/dashboard");
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[color:var(--background)] px-4 pb-12 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-[20px] bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--clinical-highlight)] shadow-[0_6px_20px_rgba(15,159,143,0.25)]">
            <Stethoscope size={24} strokeWidth={2.2} className="text-white" />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
              MY ORTHO
            </p>
            <h1 className="mt-0.5 text-lg font-bold tracking-tight text-[color:var(--foreground)]">
              Welcome to your workspace
            </h1>
          </div>
          <StepDots step={step} total={TOTAL_STEPS} />
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-7 shadow-[var(--shadow-md)]">

          {/* Step 0 — Account confirmation */}
          {step === 0 && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <UserCheck size={18} className="text-[color:var(--primary)]" />
                <h2 className="text-base font-semibold text-[color:var(--foreground)]">
                  Account confirmed
                </h2>
              </div>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                You&apos;re signed in as:
              </p>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[color:var(--muted-foreground)]">Name</span>
                  <span className="text-sm font-semibold text-[color:var(--foreground)]">{user?.name ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[color:var(--muted-foreground)]">Email</span>
                  <span className="text-sm text-[color:var(--foreground)]">{user?.email ?? "—"}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-[color:var(--muted-foreground)]">Role</span>
                  <span className="text-sm font-semibold text-[color:var(--primary)]">{roleLabel(user?.role ?? "")}</span>
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Professional role */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Stethoscope size={18} className="text-[color:var(--primary)]" />
                <h2 className="text-base font-semibold text-[color:var(--foreground)]">
                  Your professional role
                </h2>
              </div>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Choose the role that best describes your responsibilities.
              </p>
              <div className="grid gap-2">
                {ROLES.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRole(r)}
                    className={[
                      "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-all",
                      selectedRole === r
                        ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]"
                        : "border-[color:var(--border)] bg-[color:var(--background)] text-[color:var(--foreground)] hover:border-[color:var(--primary)]/50",
                    ].join(" ")}
                  >
                    {roleLabel(r)}
                    {selectedRole === r && <CheckCircle2 size={16} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Clinic / Lab details */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-[color:var(--primary)]" />
                <h2 className="text-base font-semibold text-[color:var(--foreground)]">
                  Clinic or lab details
                </h2>
              </div>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Tell us about your organization.
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[color:var(--foreground)]">
                    Organization name
                  </label>
                  <input
                    type="text"
                    value={orgName}
                    onChange={e => setOrgName(e.target.value)}
                    placeholder="e.g. Bright Smiles Orthodontics"
                    className="h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[color:var(--foreground)]">
                    Organization type
                  </label>
                  <div className="grid gap-2">
                    {ORG_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setOrgType(t.value)}
                        className={[
                          "flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition-all text-left",
                          orgType === t.value
                            ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]"
                            : "border-[color:var(--border)] bg-[color:var(--background)] text-[color:var(--foreground)] hover:border-[color:var(--primary)]/50",
                        ].join(" ")}
                      >
                        {t.label}
                        {orgType === t.value && <CheckCircle2 size={16} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Workflow preferences */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Database size={18} className="text-[color:var(--primary)]" />
                <h2 className="text-base font-semibold text-[color:var(--foreground)]">
                  Demo data
                </h2>
              </div>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Populate your workspace with representative clinical cases, measurements, and workflow events so you can explore the platform before going live.
              </p>
              <div
                className={[
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all",
                  enableDemo
                    ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]"
                    : "border-[color:var(--border)] bg-[color:var(--background)]",
                ].join(" ")}
                onClick={() => setEnableDemo(v => !v)}
                role="checkbox"
                aria-checked={enableDemo}
                tabIndex={0}
                onKeyDown={e => e.key === " " && setEnableDemo(v => !v)}
              >
                <div className={[
                  "mt-0.5 h-5 w-5 shrink-0 rounded-md border-2 flex items-center justify-center transition-all",
                  enableDemo ? "border-[color:var(--primary)] bg-[color:var(--primary)]" : "border-[color:var(--border)]",
                ].join(" ")}>
                  {enableDemo && <CheckCircle2 size={13} className="text-white" />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${enableDemo ? "text-[color:var(--primary)]" : "text-[color:var(--foreground)]"}`}>
                    Load representative demo data
                  </p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                    Sample patients, cases, measurements, and manufacturing jobs. Clearly labelled as representative — not clinical records.
                  </p>
                </div>
              </div>
              {enableDemo && (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                  <span className="shrink-0">⚠</span>
                  Demo data is clearly marked as representative and does not contain real clinical information.
                </div>
              )}
            </div>
          )}

          {/* Step 4 — Finish */}
          {step === 4 && (
            <div className="space-y-5 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10">
                <CheckCircle2 size={32} className="text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[color:var(--foreground)]">
                  You&apos;re all set!
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  Your workspace is configured. Welcome to MyOrtho Clinical OS.
                </p>
              </div>
              <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-[color:var(--foreground)]">Your setup summary</p>
                <div className="flex justify-between text-xs">
                  <span className="text-[color:var(--muted-foreground)]">Role</span>
                  <span className="font-medium text-[color:var(--foreground)]">{roleLabel(selectedRole)}</span>
                </div>
                {orgName && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[color:var(--muted-foreground)]">Organization</span>
                    <span className="font-medium text-[color:var(--foreground)]">{orgName}</span>
                  </div>
                )}
                <div className="flex justify-between text-xs">
                  <span className="text-[color:var(--muted-foreground)]">Demo data</span>
                  <span className="font-medium text-[color:var(--foreground)]">{enableDemo ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Navigation buttons */}
          <div className="mt-6 flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                className="h-11 flex-1 rounded-xl border border-[color:var(--border)] text-sm font-semibold text-[color:var(--foreground)] transition-all hover:bg-[color:var(--muted)] active:scale-[0.97]"
              >
                Back
              </button>
            )}
            {step < TOTAL_STEPS - 1 ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] text-sm font-semibold text-[color:var(--primary-foreground)] transition-all active:scale-[0.97]"
              >
                Continue
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={saving}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {saving ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>Enter workspace <ArrowRight size={14} /></>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
