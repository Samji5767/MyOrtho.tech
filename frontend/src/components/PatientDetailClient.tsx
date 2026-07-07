"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FolderKanban,
  Layers,
  Plus,
  TrendingUp,
  User,
} from "lucide-react";
import {
  Button,
  Card,
  DataRow,
  EmptyState,
  ProgressBar,
  SectionHeader,
  SkeletonBlock,
  StatusBadge,
} from "@/components/DesignSystem";
import { fetchPatient } from "@/lib/api/patients";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDob(dob: string | null): string {
  if (!dob) return "—";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return dob;
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatGender(g: string | null): string {
  if (!g) return "—";
  return g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function caseStatusTone(status: string): "primary" | "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "active_treatment": return "success";
    case "planning":
    case "clinical_review":
    case "scan_review":      return "warning";
    case "completed":
    case "approved":         return "primary";
    case "cancelled":
    case "archived":         return "neutral";
    default:                 return "info";
  }
}

function statusToProgress(status: string): number {
  const map: Record<string, number> = {
    draft: 10, scan_review: 25, segmentation: 40, planning: 55,
    clinical_review: 70, approved: 85, active_treatment: 90,
    monitoring: 95, retention: 98, completed: 100, archived: 100, cancelled: 0,
  };
  return map[status] ?? 50;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = diff / 3600000;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PatientDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const [patient, setPatient] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string | null;
    gender: string | null;
    caseCount: number;
    createdAt: string;
  } | null>(null);
  const [patientCases, setPatientCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [patRes, casesRes] = await Promise.allSettled([
        fetchPatient(id),
        fetchCases(),
      ]);

      if (patRes.status === "fulfilled") {
        const p = patRes.value.data;
        setPatient({
          id: p.id,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth ?? null,
          gender: p.gender ?? null,
          caseCount: p.caseCount ?? 0,
          createdAt: p.createdAt,
        });
      } else {
        setNotFound(true);
      }

      if (casesRes.status === "fulfilled") {
        const matched = casesRes.value.cases.filter((c) => c.patient.id === id);
        setPatientCases(matched);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = patientCases.length;
    const active = patientCases.filter((c) =>
      ["active_treatment", "planning", "clinical_review", "scan_review", "approved", "segmentation"].includes(c.status),
    ).length;
    const completed = patientCases.filter((c) => c.status === "completed").length;
    const activeCase = patientCases.find((c) => c.status === "active_treatment")
      ?? patientCases.find((c) => ["planning", "clinical_review", "scan_review", "approved"].includes(c.status));
    return { total, active, completed, activeCase };
  }, [patientCases]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 pt-4 sm:px-5">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-20 w-full" />
        <SkeletonBlock className="h-48 w-full" />
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (notFound || !patient) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-5">
        <EmptyState
          icon={User}
          title="Patient not found"
          body="This patient record may have been removed or you may not have access."
        />
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={14} /> Go back
          </Button>
        </div>
      </div>
    );
  }

  const initials = `${patient.firstName[0] ?? ""}${patient.lastName[0] ?? ""}`.toUpperCase();
  const fullName = `${patient.firstName} ${patient.lastName}`;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+2rem)] pt-4 sm:px-5">

      {/* ── Back nav ── */}
      <Link
        href="/patients"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
      >
        <ArrowLeft size={14} />
        All Patients
      </Link>

      {/* ── Patient header ── */}
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-xl font-bold text-[color:var(--primary)]">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
            {fullName}
          </h1>
          <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
            Patient since {new Date(patient.createdAt).toLocaleDateString("en-AU", { month: "short", year: "numeric" })}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {stats.active > 0 && (
              <StatusBadge tone="success">{stats.active} active</StatusBadge>
            )}
            {stats.completed > 0 && (
              <StatusBadge tone="neutral">{stats.completed} completed</StatusBadge>
            )}
            {stats.total === 0 && (
              <StatusBadge tone="neutral">No cases</StatusBadge>
            )}
          </div>
        </div>
      </div>

      {/* ── Quick stat cards ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Cases", value: stats.total, icon: FolderKanban, cls: "text-[color:var(--primary)]", bg: "bg-[color:var(--primary-glow)]" },
          { label: "Active",      value: stats.active,    icon: TrendingUp,  cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Completed",   value: stats.completed, icon: CheckCircle2, cls: "text-slate-600 dark:text-slate-400", bg: "bg-slate-500/10" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="flex flex-col items-center gap-2 p-3 text-center">
              <span className={`grid h-8 w-8 place-items-center rounded-xl ${s.bg} ${s.cls}`}>
                <Icon size={15} />
              </span>
              <span className={`text-2xl font-bold tabular-nums ${s.cls}`}>{s.value}</span>
              <span className="text-[10px] font-medium text-[color:var(--muted-foreground)]">{s.label}</span>
            </Card>
          );
        })}
      </div>

      {/* ── Active treatment progress ── */}
      {stats.activeCase && (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[color:var(--muted-foreground)]">
                Active Treatment
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-[color:var(--foreground)]">
                {stats.activeCase.chiefComplaint ?? "Ongoing treatment"}
              </p>
              {stats.activeCase.malocclusionClass && (
                <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                  {stats.activeCase.malocclusionClass}
                </p>
              )}
            </div>
            <StatusBadge tone={caseStatusTone(stats.activeCase.status)}>
              {stats.activeCase.status.replace(/_/g, " ")}
            </StatusBadge>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar
                value={statusToProgress(stats.activeCase.status)}
                tone="primary"
              />
            </div>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-[color:var(--muted-foreground)]">
              {statusToProgress(stats.activeCase.status)}%
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="flex items-center gap-1 text-xs text-[color:var(--muted-foreground)]">
              <Clock size={11} />
              Updated {relativeTime(stats.activeCase.updatedAt)}
            </span>
            <Link href={`/cases?id=${stats.activeCase.id}`}>
              <Button variant="ghost" size="sm">View Case</Button>
            </Link>
          </div>
        </Card>
      )}

      {/* ── Quick actions ── */}
      <div className="flex flex-wrap gap-2">
        <Link href={stats.activeCase ? `/studio?caseId=${encodeURIComponent(stats.activeCase.id)}` : "/studio"}>
          <Button variant="secondary" size="sm">
            <Layers size={14} /> Open Studio
          </Button>
        </Link>
        <Link href={`/cases/new?patientId=${patient.id}`}>
          <Button variant="primary" size="sm">
            <Plus size={14} /> New Case
          </Button>
        </Link>
      </div>

      {/* ── Patient details ── */}
      <Card className="p-4">
        <SectionHeader eyebrow="Patient" title="Details" />
        <div className="mt-4 space-y-0">
          <DataRow label="Full name"    value={fullName} />
          <DataRow label="Date of birth" value={formatDob(patient.dateOfBirth)} />
          <DataRow label="Gender"       value={formatGender(patient.gender)} />
          <DataRow
            label="Registered"
            value={new Date(patient.createdAt).toLocaleDateString("en-AU", {
              day: "numeric", month: "short", year: "numeric",
            })}
          />
        </div>
      </Card>

      {/* ── Treatment history ── */}
      <div className="space-y-3">
        <SectionHeader
          eyebrow="Clinical"
          title="Treatment History"
          action={
            patientCases.length > 0 ? (
              <Link href="/cases">
                <Button variant="ghost" size="sm">View all</Button>
              </Link>
            ) : undefined
          }
        />

        {patientCases.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No cases yet"
            body="Create a new case to start the clinical workflow for this patient."
          />
        ) : (
          <div className="relative">
            {/* Timeline spine */}
            <div
              aria-hidden
              className="absolute left-[19px] top-6 w-px bg-[color:var(--border)]"
              style={{ bottom: 20 }}
            />
            <div className="space-y-3">
              {patientCases.map((c, idx) => {
                const progress = statusToProgress(c.status);
                return (
                  <Link key={c.id} href={`/cases?id=${c.id}`} className="block">
                    <div className="relative flex items-start gap-3">
                      {/* Timeline dot */}
                      <span
                        className={[
                          "relative z-10 mt-3.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                          idx === 0
                            ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]"
                            : "border-[color:var(--border)] bg-[color:var(--card)]",
                        ].join(" ")}
                      >
                        {c.status === "completed" && (
                          <CheckCircle2 size={10} className="text-emerald-500" />
                        )}
                        {c.status === "active_treatment" && (
                          <span className="h-2 w-2 rounded-full bg-[color:var(--primary)]" />
                        )}
                      </span>

                      <Card className="flex-1 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                              {c.chiefComplaint ?? "No chief complaint"}
                            </p>
                            {c.malocclusionClass && (
                              <p className="mt-0.5 truncate text-xs text-[color:var(--muted-foreground)]">
                                {c.malocclusionClass}
                              </p>
                            )}
                            <div className="mt-2">
                              <ProgressBar
                                value={progress}
                                tone={progress >= 80 ? "success" : progress >= 50 ? "primary" : "warning"}
                              />
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            <StatusBadge tone={caseStatusTone(c.status)}>
                              {c.status.replace(/_/g, " ")}
                            </StatusBadge>
                            <span className="flex items-center gap-1 text-[10px] text-[color:var(--muted-foreground)]">
                              <CalendarDays size={9} />
                              {new Date(c.updatedAt).toLocaleDateString("en-AU", {
                                day: "numeric", month: "short", year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
