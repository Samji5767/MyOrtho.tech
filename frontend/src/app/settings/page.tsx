"use client";

import Link from "next/link";
import { useState, Suspense } from "react";
import dynamic from "next/dynamic";

const PricingPlansPanel = dynamic(() => import("@/components/PricingPlansPanel"), { ssr: false });
import {
  Bell,
  BellRing,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Command,
  Globe,
  Keyboard,
  Lock,
  Moon,
  Printer,
  RotateCcw,
  Server,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";
import { Button, Card, LiveDot, SectionDivider, StatusBadge } from "@/components/DesignSystem";
import { useTheme } from "@/components/ThemeContext";
import { APP_VERSION, APP_BUILD, RELEASE_TITLE, RELEASE_SUBTITLE, RELEASE_HIGHLIGHTS } from "@/lib/constants";

type Mode = "doctor" | "lab";

type DashboardItem = {
  title: string;
  body: string;
  tone: "primary" | "success" | "warning" | "danger" | "info";
  icon: LucideIcon;
};

const doctorItems: DashboardItem[] = [
  { title: "Pending approvals", body: "Cases needing doctor review before release will appear here.", tone: "warning", icon: ClipboardCheck },
  { title: "Active cases", body: "Patients currently in treatment will be listed here.", tone: "primary", icon: Stethoscope },
  { title: "Recent scans", body: "Scan uploads ready for segmentation will appear here.", tone: "info", icon: Sparkles },
  { title: "Case alerts", body: "Items requiring immediate attention will appear here.", tone: "danger", icon: BellRing },
];

const labItems: DashboardItem[] = [
  { title: "Production queue", body: "Print jobs staged for printing or finishing will appear here.", tone: "primary", icon: Printer },
  { title: "Print status", body: "Jobs currently running or in QC will be listed here.", tone: "success", icon: CheckCircle2 },
  { title: "SLA alerts", body: "Jobs at risk of missing turnaround targets will appear here.", tone: "warning", icon: BellRing },
  { title: "Failed jobs", body: "Batches needing a retry or status update will appear here.", tone: "danger", icon: RotateCcw },
];

const keyboardShortcuts = [
  { key: "⌘K", label: "Open command palette" },
  { key: "H", label: "Go to Home" },
  { key: "P", label: "Go to Patients" },
  { key: "W", label: "Go to Case Workspace" },
  { key: "S", label: "Go to Settings" },
];

function isSupabaseConfigured() {
  if (typeof window === "undefined") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return !!(url && key && !url.includes("placeholder") && key !== "placeholder");
}

export default function SettingsPage() {
  const [mode, setMode] = useState<Mode>("doctor");
  const { theme, resolvedTheme, setTheme } = useTheme();
  const supabaseConnected = isSupabaseConfigured();

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5 lg:px-8 lg:pb-10">

      {/* PROFILE CARD */}
      <Card className="ios-card p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-[color:var(--primary)] to-[color:var(--clinical-highlight)] text-[color:var(--primary-foreground)] shadow-[var(--shadow-md)]">
            <User size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Profile</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
              Your Profile
            </h1>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              Complete your clinic profile to personalize the platform.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <LiveDot tone="success" />
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Platform active</span>
              </div>
              <StatusBadge tone="primary">Doctor</StatusBadge>
              <StatusBadge tone="info">HIPAA prepared</StatusBadge>
            </div>
          </div>
        </div>

        <SectionDivider className="mt-5" />

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <button type="button" className="ios-chip flex items-center gap-3 px-4 py-3 text-left transition-transform duration-150 active:scale-[0.99]">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
              <Globe size={16} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[color:var(--foreground)]">Clinic profile</span>
              <span className="text-xs text-[color:var(--muted-foreground)]">Update details</span>
            </span>
          </button>
          <button type="button" className="ios-chip flex items-center gap-3 px-4 py-3 text-left transition-transform duration-150 active:scale-[0.99]">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
              <Bell size={16} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[color:var(--foreground)]">Notifications</span>
              <span className="text-xs text-[color:var(--muted-foreground)]">SLA, alerts, cases</span>
            </span>
          </button>
          <button type="button" className="ios-chip flex items-center gap-3 px-4 py-3 text-left transition-transform duration-150 active:scale-[0.99]">
            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
              <Lock size={16} />
            </span>
            <span>
              <span className="block text-sm font-semibold text-[color:var(--foreground)]">Security</span>
              <span className="text-xs text-[color:var(--muted-foreground)]">MFA · SSO</span>
            </span>
          </button>
        </div>
      </Card>

      {/* APPEARANCE */}
      <Card className="ios-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Appearance</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">Theme mode</h2>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              Follow the iPhone system theme or lock the app to light or dark mode.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {resolvedTheme === "dark" ? <Moon size={16} className="text-[color:var(--primary)]" /> : <Sun size={16} className="text-amber-500" />}
            <StatusBadge tone="primary">{resolvedTheme === "dark" ? "Dark" : "Light"}</StatusBadge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            { value: "system", label: "System", note: "Match device theme", icon: Smartphone },
            { value: "light", label: "Light", note: "Bright clinic view", icon: Sun },
            { value: "dark", label: "Dark", note: "Low-light mode", icon: Moon },
          ].map((option) => {
            const active = theme === option.value;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value as typeof theme)}
                className={`flex flex-col gap-2 rounded-2xl border px-3 py-3 text-left transition-transform duration-200 active:scale-95 ${
                  active
                    ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--foreground)]"
                    : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"
                }`}
              >
                <Icon size={16} className={active ? "text-[color:var(--primary)]" : "text-[color:var(--muted-foreground)]"} />
                <span>
                  <span className="block text-sm font-semibold text-[color:var(--foreground)]">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-5 text-[color:var(--muted-foreground)]">{option.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* DOCTOR / LAB DASHBOARD MODE */}
      <Card className="ios-card p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Clinic controls</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {mode === "doctor" ? "Doctor dashboard" : "Lab dashboard"}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted-foreground)]">
                Switch between doctor and lab views to keep approvals, alerts, and production updates close to hand.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] p-2 shadow-[var(--shadow-sm)]">
            <ModeButton active={mode === "doctor"} onClick={() => setMode("doctor")} label="Doctor" />
            <ModeButton active={mode === "lab"} onClick={() => setMode("lab")} label="Lab" />
          </div>
        </div>
      </Card>

      {/* Dashboard metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(mode === "doctor" ? doctorItems : labItems).map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{item.body}</p>
                </div>
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${
                    item.tone === "warning"
                      ? "bg-amber-500/10 text-amber-500"
                      : item.tone === "danger"
                        ? "bg-rose-500/10 text-rose-500"
                        : item.tone === "success"
                          ? "bg-emerald-500/10 text-emerald-500"
                          : item.tone === "info"
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-teal-500/10 text-teal-500"
                  }`}
                >
                  <Icon size={18} />
                </span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Approvals / Queue — empty states */}
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">
                {mode === "doctor" ? "Approvals" : "Queue"}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {mode === "doctor" ? "Pending approvals" : "Production queue"}
              </h2>
            </div>
            <ChevronRight size={18} className="text-[color:var(--muted-foreground)]" />
          </div>

          <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
            {mode === "doctor" ? (
              <ClipboardCheck size={24} className="text-[color:var(--muted-foreground)]" />
            ) : (
              <Printer size={24} className="text-[color:var(--muted-foreground)]" />
            )}
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {mode === "doctor"
                ? "No cases pending approval."
                : "No jobs in the production queue."}
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">
                {mode === "doctor" ? "Messaging" : "Status updates"}
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                {mode === "doctor" ? "Patient communication" : "Quick lab actions"}
              </h2>
            </div>
            <BellRing size={18} className="text-[color:var(--primary)]" />
          </div>

          <div className="mt-4 space-y-3">
            <div className="ios-chip px-4 py-3">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {mode === "doctor" ? "Send review note" : "Update print status"}
              </p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                {mode === "doctor"
                  ? "Share treatment feedback, request more photos, or answer a patient message."
                  : "Mark a job as printing, cleaning, curing, or QC pending without leaving the queue."}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button variant="primary" className="flex-1">
              {mode === "doctor" ? "Open messages" : "Update status"}
            </Button>
            <Link
              href="/patients"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-sm font-semibold text-[color:var(--foreground)] transition-transform duration-200 active:scale-95"
            >
              Review cases
              <ChevronRight size={16} />
            </Link>
          </div>
        </Card>
      </div>

      {/* KEYBOARD SHORTCUTS + SECURITY */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Productivity</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                Keyboard shortcuts
              </h2>
            </div>
            <Keyboard size={18} className="text-[color:var(--primary)]" />
          </div>

          <div className="mt-4 space-y-2">
            {keyboardShortcuts.map((sc) => (
              <div key={sc.key} className="ios-chip flex items-center justify-between gap-4 px-4 py-3">
                <span className="text-sm text-[color:var(--foreground)]">{sc.label}</span>
                <kbd className="rounded-md border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_60%,transparent)] px-2.5 py-1 text-xs font-semibold text-[color:var(--muted-foreground)]">
                  {sc.key}
                </kbd>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="mt-4 inline-flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform duration-200 active:scale-95"
          >
            <Command size={16} />
            Open command palette
          </button>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Quality</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                Security and compliance
              </h2>
            </div>
            <ShieldCheck size={18} className="text-emerald-500" />
          </div>

          <div className="mt-4 space-y-2">
            {[
              { title: "HIPAA audit mode", body: "Approvals and uploads are prepared for immutable logging.", status: "Enabled" as const, tone: "success" as const },
              { title: "SSO / MFA", body: "Single sign-on and multi-factor authentication support.", status: "Configurable" as const, tone: "info" as const },
              { title: "PHI export controls", body: "All patient data exports require doctor approval.", status: "Enforced" as const, tone: "primary" as const },
              { title: "VoiceOver labels", body: "Buttons expose descriptive ARIA labels and roles.", status: "Pass" as const, tone: "success" as const },
            ].map((item) => (
              <div key={item.title} className="ios-chip flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{item.title}</p>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">{item.body}</p>
                </div>
                <StatusBadge tone={item.tone}>{item.status}</StatusBadge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* WHAT'S NEW — V2.0 RELEASE NOTES */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Release</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
              {RELEASE_TITLE}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">{RELEASE_SUBTITLE}</p>
          </div>
          <StatusBadge tone="primary">v{APP_VERSION}</StatusBadge>
        </div>

        <div className="mt-4 space-y-1.5">
          {RELEASE_HIGHLIGHTS.map((highlight) => (
            <div key={highlight} className="flex items-center gap-2.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
              <CheckCircle2 size={13} className="shrink-0 text-emerald-500" />
              <span className="text-xs text-[color:var(--foreground)]">{highlight}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* INTEGRATION STATUS */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Backend</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
              Integration status
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              Backend services must be connected before clinical data flows are active.
            </p>
          </div>
          <Server size={18} className="text-[color:var(--primary)]" />
        </div>

        <div className="mt-4 space-y-2">
          {[
            {
              name: "Supabase",
              detail: "Database, auth, and file storage",
              connected: supabaseConnected,
            },
            { name: "FastAPI AI Engine", detail: "Scan segmentation and AI predictions", connected: false },
            { name: "NestJS API", detail: "Clinical workflow orchestration", connected: false },
            { name: "Scanner Integrations", detail: "Direct intraoral scanner import", connected: false },
            { name: "Manufacturing API", detail: "Printer management and print job dispatch", connected: false },
          ].map((service) => (
            <div key={service.name} className="ios-chip flex items-start justify-between gap-4 px-4 py-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${service.connected ? "bg-emerald-500" : "bg-[color:var(--muted-foreground)]"}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{service.name}</p>
                  <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{service.detail}</p>
                </div>
              </div>
              <StatusBadge tone={service.connected ? "success" : "neutral"}>
                {service.connected ? "Connected" : "Not configured"}
              </StatusBadge>
            </div>
          ))}
        </div>
      </Card>
      {/* PLATFORM LINKS — AI Readiness + Trust Center */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Platform</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
              AI &amp; compliance
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              Review AI capability maturity and data-handling policies.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Link
            href="/ai-readiness"
            className="ios-chip flex items-center gap-3 px-4 py-3 transition-transform duration-150 active:scale-[0.99]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Brain size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[color:var(--foreground)]">AI Readiness</span>
              <span className="text-xs text-[color:var(--muted-foreground)]">Capability maturity matrix</span>
            </span>
            <ChevronRight size={15} className="ml-auto shrink-0 text-[color:var(--muted-foreground)]" />
          </Link>
          <Link
            href="/trust"
            className="ios-chip flex items-center gap-3 px-4 py-3 transition-transform duration-150 active:scale-[0.99]"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Shield size={16} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[color:var(--foreground)]">Trust Center</span>
              <span className="text-xs text-[color:var(--muted-foreground)]">PHI, compliance &amp; security</span>
            </span>
            <ChevronRight size={15} className="ml-auto shrink-0 text-[color:var(--muted-foreground)]" />
          </Link>
        </div>
      </Card>

      {/* BILLING */}
      <Suspense fallback={<div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-500">Loading billing…</div>}>
        <PricingPlansPanel />
      </Suspense>

      {/* VERSION FOOTER */}
      <div className="flex flex-col items-center gap-1 py-4 text-center">
        <div className="flex items-center gap-2">
          <img
            src="/app-icon.png"
            alt="MyOrtho"
            style={{ width: 28, height: 28, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
          <span className="text-sm font-semibold text-[color:var(--foreground)]">MyOrtho.tech</span>
        </div>
        <p className="text-xs text-[color:var(--muted-foreground)]">
          Version {APP_VERSION} · Build {APP_BUILD}
        </p>
        <p className="text-[10px] text-[color:var(--muted-foreground)]">
          Clinical Operating System for Orthodontics
        </p>
      </div>
    </section>
  );
}

function ModeButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-full px-4 py-3 text-sm font-semibold transition-transform duration-200 active:scale-95 ${
        active ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]" : "text-[color:var(--muted-foreground)]"
      }`}
    >
      {label}
    </button>
  );
}
