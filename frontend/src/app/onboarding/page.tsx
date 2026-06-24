"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Box,
  Brain,
  Building2,
  CheckCircle2,
  ChevronRight,
  Database,
  Factory,
  FolderKanban,
  LayoutDashboard,
  MessageCircle,
  Stethoscope,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getRoleConfig, getPrimaryWorkspace, type RoleKey } from "@/lib/roles";

// ─── Role catalogue ───────────────────────────────────────────────────────────

interface RoleOption {
  value: RoleKey;
  label: string;
  category: string;
  description: string;
}

const ROLE_OPTIONS: RoleOption[] = [
  // Clinical
  { value: "orthodontist",     label: "Orthodontist",          category: "Clinical",  description: "Treatment planning, CAD design, approvals" },
  { value: "dentist",          label: "Dentist / GP",          category: "Clinical",  description: "Case submission and treatment monitoring" },
  { value: "resident",         label: "Resident / Trainee",    category: "Clinical",  description: "Supervised observation and learning" },
  { value: "clinical_director",label: "Clinical Director",     category: "Clinical",  description: "Clinical quality, approvals, and audit oversight" },
  // Lab
  { value: "lab_technician",   label: "Lab Technician",        category: "Lab",       description: "Model prep, production jobs, QC" },
  { value: "lab_technician",   label: "Digital Designer",      category: "Lab",       description: "CAD design and digital workflows" },
  { value: "lab_manager",      label: "Lab Manager",           category: "Lab",       description: "Production management and SLA compliance" },
  { value: "lab_manager",      label: "Manufacturing Manager", category: "Lab",       description: "Manufacturing operations and capacity planning" },
  // Executive
  { value: "executive",        label: "Practice Owner",        category: "Executive", description: "Business overview and performance metrics" },
  { value: "executive",        label: "DSO Executive",         category: "Executive", description: "Group-level clinical and operational analytics" },
  { value: "vp_clinical",      label: "VP Clinical Operations",category: "Executive", description: "Clinical strategy and provider performance" },
  { value: "vp_manufacturing", label: "VP Manufacturing",      category: "Executive", description: "Manufacturing strategy and capacity" },
  { value: "executive",        label: "CEO",                   category: "Executive", description: "Enterprise performance and strategy" },
  // Admin
  { value: "admin",            label: "Organization Admin",    category: "Admin",     description: "User management and configuration" },
  { value: "super_admin",      label: "Super Admin",           category: "Admin",     description: "Full platform access" },
];

const ORG_TYPES = [
  { value: "clinic",     label: "Orthodontic Practice",    icon: Stethoscope },
  { value: "lab",        label: "Dental Lab",              icon: Factory     },
  { value: "enterprise", label: "DSO / Enterprise Group",  icon: Building2   },
];

const CAD_LEVELS = [
  { value: "none",         label: "No CAD experience",           description: "I work with physical models and traditional methods" },
  { value: "basic",        label: "Basic",                        description: "Familiar with 3D viewing; limited design experience" },
  { value: "intermediate", label: "Intermediate",                 description: "Use CAD software for case review and adjustments" },
  { value: "advanced",     label: "Advanced",                     description: "Full digital workflow with CAD design and export" },
];

const AI_READINESS_LEVELS = [
  { value: "exploring",  label: "Exploring AI",            description: "Want to understand what AI can do for my practice" },
  { value: "pilot",      label: "Ready for pilot features", description: "Open to AI decision support with full human review" },
  { value: "production", label: "Production ready",         description: "AI tools integrated into clinical workflows today" },
];

const WORKFLOW_PRIMARIES = [
  "Clear aligner treatment",
  "Fixed appliance treatment",
  "Removable appliances",
  "Restorative / prosthetics",
  "Mixed modalities",
  "Lab-only (no direct clinical)",
];

const VOLUME_RANGES = [
  "< 10 cases / month",
  "10–25 cases / month",
  "25–50 cases / month",
  "50–100 cases / month",
  "> 100 cases / month",
];

// ─── Step dots ────────────────────────────────────────────────────────────────

function StepDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={[
            "rounded-full transition-all duration-300",
            i < step  ? "h-1.5 w-5 bg-[color:var(--primary)]"        :
            i === step ? "h-1.5 w-3 bg-[color:var(--primary)]/60"    :
                         "h-1.5 w-1.5 bg-[color:var(--border)]",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// ─── Radio pill ───────────────────────────────────────────────────────────────

function RadioPill({
  selected, onClick, children,
}: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-all w-full",
        selected
          ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]"
          : "border-[color:var(--border)] bg-[color:var(--background)] text-[color:var(--foreground)] hover:border-[color:var(--primary)]/50",
      ].join(" ")}
    >
      {children}
      {selected && <CheckCircle2 size={16} className="shrink-0" />}
    </button>
  );
}

// ─── Role-specific success workspace routes ───────────────────────────────────

function getSuccessRoutes(role: RoleKey) {
  const config = getRoleConfig(role);
  return config.recommendedRoutes.slice(0, 3);
}

const ROUTE_ICONS: Record<string, React.ReactNode> = {
  "/":              <MessageCircle size={16} />,
  "/cases":         <FolderKanban size={16} />,
  "/dashboard":     <LayoutDashboard size={16} />,
  "/studio":        <Box size={16} />,
  "/manufacturing": <Factory size={16} />,
  "/analytics":     <BarChart3 size={16} />,
  "/workflow":      <Stethoscope size={16} />,
  "/patients":      <Users size={16} />,
  "/settings":      <Building2 size={16} />,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 7;

export default function OnboardingPage() {
  const router = useRouter();
  const { user, refresh } = useAuth();

  const [step, setStep]             = useState(0);
  const [roleOption, setRoleOption] = useState<RoleOption | null>(null);
  const [orgType, setOrgType]       = useState("clinic");
  const [orgName, setOrgName]       = useState("");
  const [numDoctors, setNumDoctors] = useState("");
  const [numClinics, setNumClinics] = useState("");
  const [caseVolume, setCaseVolume] = useState("");
  const [primaryFlow, setPrimaryFlow]     = useState("");
  const [cadLevel, setCadLevel]           = useState("");
  const [aiReadiness, setAiReadiness]     = useState("");
  const [enableDemo, setEnableDemo]       = useState(false);
  const [saving, setSaving] = useState(false);

  const resolvedRole = (roleOption?.value ?? user?.role ?? "orthodontist") as RoleKey;
  const roleConfig   = getRoleConfig(resolvedRole);

  async function finish() {
    setSaving(true);
    try {
      await fetch(`/api/auth/onboarding`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: resolvedRole,
          displayRole: roleOption?.label,
          orgName, orgType,
          numDoctors, numClinics, caseVolume,
          primaryFlow, cadLevel, aiReadiness, enableDemo,
        }),
      });
    } catch {}
    await refresh();
    router.replace(getPrimaryWorkspace(resolvedRole));
  }

  const canAdvance = (() => {
    if (step === 1 && !roleOption) return false;
    if (step === 2 && !orgType)    return false;
    return true;
  })();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[color:var(--background)] px-4 pb-12 pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-lg">

        {/* Header */}
        <div className="mb-7 flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-[20px] bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--clinical-highlight)] shadow-[0_6px_20px_rgba(15,159,143,0.25)]">
            <Stethoscope size={24} strokeWidth={2.2} className="text-white" />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--muted-foreground)]">
              MY ORTHO — SETUP
            </p>
            <h1 className="mt-0.5 text-lg font-bold tracking-tight text-[color:var(--foreground)]">
              Configure your workspace
            </h1>
          </div>
          <StepDots step={step} total={TOTAL_STEPS} />
          <p className="text-xs text-[color:var(--muted-foreground)]">Step {step + 1} of {TOTAL_STEPS}</p>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-[var(--shadow-md)]">

          {/* ── Step 0: Account confirmation ─────────────────────────────────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-[color:var(--foreground)]">Account confirmed</h2>
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Welcome. Let&apos;s set up your workspace in a few quick steps.
              </p>
              <div className="divide-y divide-[color:var(--border)] rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
                {[
                  { label: "Name",  value: user?.name  ?? "—" },
                  { label: "Email", value: user?.email ?? "—" },
                  { label: "Role",  value: user?.role  ?? "—" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-xs text-[color:var(--muted-foreground)]">{row.label}</span>
                    <span className="text-sm font-semibold text-[color:var(--foreground)]">{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[color:var(--muted-foreground)]">
                We&apos;ll personalize your experience based on your professional role. You can change this later in Settings.
              </p>
            </div>
          )}

          {/* ── Step 1: Role selection ────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--foreground)]">Your professional role</h2>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  This determines your default workspace, navigation, and recommended actions.
                </p>
              </div>
              {(["Clinical", "Lab", "Executive", "Admin"] as const).map(cat => {
                const catRoles = ROLE_OPTIONS.filter(r => r.category === cat);
                return (
                  <div key={cat}>
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">{cat}</p>
                    <div className="space-y-1.5">
                      {catRoles.map((r, i) => (
                        <button
                          key={`${r.value}-${i}`}
                          type="button"
                          onClick={() => setRoleOption(r)}
                          className={[
                            "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                            roleOption?.label === r.label
                              ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]"
                              : "border-[color:var(--border)] bg-[color:var(--background)] hover:border-[color:var(--primary)]/40",
                          ].join(" ")}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold ${roleOption?.label === r.label ? "text-[color:var(--primary)]" : "text-[color:var(--foreground)]"}`}>
                              {r.label}
                            </p>
                            <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{r.description}</p>
                          </div>
                          {roleOption?.label === r.label && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[color:var(--primary)]" />}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Step 2: Organization type ─────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--foreground)]">Organization type</h2>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  This shapes how your workspace is organized.
                </p>
              </div>
              <div className="space-y-2">
                {ORG_TYPES.map(t => {
                  const Icon = t.icon;
                  return (
                    <RadioPill key={t.value} selected={orgType === t.value} onClick={() => setOrgType(t.value)}>
                      <span className="flex items-center gap-3">
                        <Icon size={16} className="shrink-0 text-[color:var(--primary)]" />
                        {t.label}
                      </span>
                    </RadioPill>
                  );
                })}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[color:var(--foreground)]">Organization name</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="e.g. Bright Smiles Orthodontics"
                  className="h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* ── Step 3: Practice scale ────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--foreground)]">Practice scale</h2>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  Helps us size dashboards, SLA targets, and capacity estimates correctly.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[color:var(--foreground)]">Number of doctors</label>
                  <select
                    value={numDoctors}
                    onChange={e => setNumDoctors(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
                  >
                    <option value="">Select</option>
                    {["1", "2–5", "6–10", "11–25", "26–50", "50+"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[color:var(--foreground)]">Number of locations</label>
                  <select
                    value={numClinics}
                    onChange={e => setNumClinics(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
                  >
                    <option value="">Select</option>
                    {["1", "2–3", "4–10", "11–25", "25+"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[color:var(--foreground)]">Monthly aligner case volume</label>
                <div className="space-y-1.5">
                  {VOLUME_RANGES.map(v => (
                    <RadioPill key={v} selected={caseVolume === v} onClick={() => setCaseVolume(v)}>
                      {v}
                    </RadioPill>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Workflow preferences ──────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--foreground)]">Workflow preferences</h2>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  Tell us about your primary workflow and CAD experience.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[color:var(--foreground)]">Primary workflow</label>
                <div className="space-y-1.5">
                  {WORKFLOW_PRIMARIES.map(w => (
                    <RadioPill key={w} selected={primaryFlow === w} onClick={() => setPrimaryFlow(w)}>
                      {w}
                    </RadioPill>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[color:var(--foreground)]">CAD experience level</label>
                <div className="space-y-1.5">
                  {CAD_LEVELS.map(l => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setCadLevel(l.value)}
                      className={[
                        "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                        cadLevel === l.value
                          ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]"
                          : "border-[color:var(--border)] bg-[color:var(--background)] hover:border-[color:var(--primary)]/40",
                      ].join(" ")}
                    >
                      <div>
                        <p className={`text-sm font-semibold ${cadLevel === l.value ? "text-[color:var(--primary)]" : "text-[color:var(--foreground)]"}`}>
                          {l.label}
                        </p>
                        <p className="text-xs text-[color:var(--muted-foreground)]">{l.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: AI readiness + demo data ─────────────────────────────────── */}
          {step === 5 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--foreground)]">AI readiness &amp; data</h2>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  MyOrtho includes AI decision support tools. All AI outputs require clinician review — no autonomous decisions.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[color:var(--foreground)]">AI readiness preference</label>
                <div className="space-y-1.5">
                  {AI_READINESS_LEVELS.map(l => (
                    <button
                      key={l.value}
                      type="button"
                      onClick={() => setAiReadiness(l.value)}
                      className={[
                        "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all",
                        aiReadiness === l.value
                          ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]"
                          : "border-[color:var(--border)] bg-[color:var(--background)] hover:border-[color:var(--primary)]/40",
                      ].join(" ")}
                    >
                      <Brain size={15} className={`mt-0.5 shrink-0 ${aiReadiness === l.value ? "text-[color:var(--primary)]" : "text-[color:var(--muted-foreground)]"}`} />
                      <div>
                        <p className={`text-sm font-semibold ${aiReadiness === l.value ? "text-[color:var(--primary)]" : "text-[color:var(--foreground)]"}`}>
                          {l.label}
                        </p>
                        <p className="text-xs text-[color:var(--muted-foreground)]">{l.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div
                role="checkbox"
                aria-checked={enableDemo}
                tabIndex={0}
                onClick={() => setEnableDemo(v => !v)}
                onKeyDown={e => e.key === " " && setEnableDemo(v => !v)}
                className={[
                  "flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-all",
                  enableDemo
                    ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]"
                    : "border-[color:var(--border)] bg-[color:var(--background)]",
                ].join(" ")}
              >
                <div className={[
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
                  enableDemo ? "border-[color:var(--primary)] bg-[color:var(--primary)]" : "border-[color:var(--border)]",
                ].join(" ")}>
                  {enableDemo && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${enableDemo ? "text-[color:var(--primary)]" : "text-[color:var(--foreground)]"}`}>
                    Load representative demo data
                  </p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                    Sample cases, measurements, and audit events — clearly labelled as representative. No real patient data.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                <Database size={12} className="mt-0.5 shrink-0" />
                All AI capabilities in MyOrtho are decision support tools. Every AI result requires clinician review before any clinical action.
              </div>
            </div>
          )}

          {/* ── Step 6: Role success screen ───────────────────────────────────────── */}
          {step === 6 && (
            <div className="space-y-5">
              <div className="text-center">
                <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-500/10">
                  <CheckCircle2 size={32} className="text-emerald-500" />
                </div>
                <h2 className="text-lg font-bold text-[color:var(--foreground)]">
                  {roleOption?.label ?? user?.name ?? "Welcome"} — you&apos;re all set
                </h2>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  {roleConfig.successMessage}
                </p>
              </div>

              {/* Setup summary */}
              <div className="divide-y divide-[color:var(--border)] rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)]">
                {[
                  { label: "Role",        value: roleOption?.label ?? user?.role ?? "—"  },
                  { label: "Organization",value: orgName || "Not specified" },
                  { label: "Workflow",    value: primaryFlow || "Not specified" },
                  { label: "CAD level",   value: CAD_LEVELS.find(l => l.value === cadLevel)?.label ?? "Not specified" },
                  { label: "Demo data",   value: enableDemo ? "Enabled" : "Disabled" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-[color:var(--muted-foreground)]">{row.label}</span>
                    <span className="text-xs font-semibold text-[color:var(--foreground)]">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Recommended workspace */}
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--muted-foreground)]">
                  Your recommended workspace
                </p>
                <div className="space-y-2">
                  {getSuccessRoutes(resolvedRole).map(route => (
                    <div key={route.href} className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3">
                      <span className="text-[color:var(--primary)]">{ROUTE_ICONS[route.href] ?? <FolderKanban size={16} />}</span>
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">{route.label}</p>
                        <p className="text-xs text-[color:var(--muted-foreground)]">{route.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Navigation buttons ────────────────────────────────────────────────── */}
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
                disabled={!canAdvance}
                onClick={() => setStep(s => s + 1)}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] text-sm font-semibold text-[color:var(--primary-foreground)] transition-all active:scale-[0.97] disabled:opacity-40"
              >
                Continue <ChevronRight size={15} />
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={saving}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 text-sm font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50"
              >
                {saving
                  ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  : <> Enter workspace <ArrowRight size={14} /></>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
