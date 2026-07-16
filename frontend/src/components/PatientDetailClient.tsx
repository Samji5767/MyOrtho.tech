"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  Edit2,
  FolderKanban,
  GitBranch,
  History,
  Layers,
  LayoutDashboard,
  MessageSquarePlus,
  Plus,
  RefreshCw,
  ScanLine,
  Send,
  TrendingUp,
  User,
  X,
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
import { useToast } from "@/components/ToastContext";
import {
  fetchPatient, updatePatient, fetchPatientCases,
  fetchPatientTimeline, addPatientTimelineNote,
  type UpdatePatientDto, type TimelineEvent,
} from "@/lib/api/patients";
import { ApiError } from "@/lib/api/client";
import type { CaseListItem } from "@/lib/api/cases";

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

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientState {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  clinicalNotes: string | null;
  caseCount: number;
  createdAt: string;
}

// ─── Edit Patient Modal ───────────────────────────────────────────────────────

const GENDER_OPTIONS = [
  { value: "", label: "Not specified" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non_binary", label: "Non-binary" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

interface EditModalProps {
  patient: PatientState;
  onSave: (updated: PatientState) => void;
  onClose: () => void;
}

function EditPatientModal({ patient, onSave, onClose }: EditModalProps) {
  const [firstName, setFirstName] = useState(patient.firstName);
  const [lastName, setLastName] = useState(patient.lastName);
  const [dateOfBirth, setDateOfBirth] = useState(patient.dateOfBirth ?? "");
  const [gender, setGender] = useState(patient.gender ?? "");
  const [clinicalNotes, setClinicalNotes] = useState(patient.clinicalNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges =
    firstName !== patient.firstName ||
    lastName !== patient.lastName ||
    dateOfBirth !== (patient.dateOfBirth ?? "") ||
    gender !== (patient.gender ?? "") ||
    clinicalNotes !== (patient.clinicalNotes ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError("First name and last name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const dto: UpdatePatientDto = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(dateOfBirth ? { dateOfBirth } : {}),
        ...(gender ? { gender } : {}),
        ...(clinicalNotes.trim() ? { clinicalNotes: clinicalNotes.trim() } : {}),
      };
      const updated = await updatePatient(patient.id, dto);
      onSave({
        ...patient,
        firstName: updated.firstName,
        lastName: updated.lastName,
        dateOfBirth: updated.dateOfBirth ?? null,
        gender: updated.gender ?? null,
        clinicalNotes: updated.clinicalNotes ?? null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-patient-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg rounded-t-2xl bg-[color:var(--card)] shadow-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
          <h2 id="edit-patient-title" className="text-base font-semibold text-[color:var(--foreground)]">
            Edit Patient
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--muted-foreground)] hover:bg-[color:var(--border)]/40 hover:text-[color:var(--foreground)]"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
          {error && (
            <p className="rounded-lg bg-rose-50/80 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[color:var(--foreground)]">
                First name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[color:var(--foreground)]">
                Last name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[color:var(--foreground)]">Date of birth</label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[color:var(--foreground)]">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[color:var(--foreground)]">Clinical notes</label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={3}
              className="resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border)] pt-3">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={!hasChanges || saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type TabId = 'overview' | 'timeline';

const TIMELINE_TYPE_META: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  case_created:             { icon: FolderKanban, color: 'text-[color:var(--primary)]',              bg: 'bg-[color:var(--primary-glow)]' },
  case_transition:          { icon: GitBranch,    color: 'text-violet-600 dark:text-violet-400',    bg: 'bg-violet-500/10' },
  scan_uploaded:            { icon: ScanLine,     color: 'text-sky-600 dark:text-sky-400',          bg: 'bg-sky-500/10' },
  appointment_scheduled:    { icon: CalendarDays, color: 'text-amber-600 dark:text-amber-400',      bg: 'bg-amber-500/10' },
  appointment_completed:    { icon: CheckCircle2, color: 'text-emerald-600 dark:text-emerald-400',  bg: 'bg-emerald-500/10' },
  appointment_cancelled:    { icon: X,            color: 'text-rose-600 dark:text-rose-400',        bg: 'bg-rose-500/10' },
  note:                     { icon: ClipboardList, color: 'text-slate-600 dark:text-slate-400',     bg: 'bg-slate-500/10' },
};
const DEFAULT_TIMELINE_META = { icon: Clock, color: 'text-slate-500', bg: 'bg-slate-500/10' };

function formatTimelineDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return { date: iso, time: '' };
  return {
    date: d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
  };
}

export default function PatientDetailClient({ id }: { id: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [patient, setPatient] = useState<PatientState | null>(null);
  const [patientCases, setPatientCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [casesLoading, setCasesLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setCasesLoading(true);
    setNotFound(false);
    setError(null);
    setPatientCases([]);
    try {
      const patRes = await fetchPatient(id).catch((err: unknown) => ({ _err: err }));

      if ("_err" in patRes) {
        const err = patRes._err;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load patient record. Please try again.",
          );
        }
        return;
      }

      const p = patRes.data;
      setPatient({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: p.dateOfBirth ?? null,
        gender: p.gender ?? null,
        clinicalNotes: p.clinicalNotes ?? null,
        caseCount: p.caseCount ?? 0,
        createdAt: p.createdAt,
      });
      setLoading(false);

      // Load cases after patient resolves — failures here show partial UI, not a blank screen
      fetchPatientCases(id)
        .then((cases) => setPatientCases(cases))
        .catch(() => { /* non-fatal: cases section shows empty */ })
        .finally(() => setCasesLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  const loadTimeline = useCallback(async () => {
    setTimelineLoading(true);
    try {
      const events = await fetchPatientTimeline(id);
      setTimeline(events);
    } catch {
      // non-fatal: show empty state
    } finally {
      setTimelineLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === 'timeline') void loadTimeline();
  }, [activeTab, loadTimeline]);

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const event = await addPatientTimelineNote(id, { note: newNote.trim() });
      setTimeline((prev) => [event, ...prev]);
      setNewNote('');
      toast({ title: 'Note added', type: 'success' });
    } catch {
      toast({ title: 'Failed to add note', description: 'Please try again.', type: 'error' });
    } finally {
      setAddingNote(false);
    }
  }

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

  // ── Error (non-404 failure) ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pt-10 sm:px-5">
        <div className="flex items-start gap-3 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-4 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0" aria-hidden>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div className="flex-1">
            <p className="font-semibold">Unable to load patient</p>
            <p className="mt-0.5 text-xs opacity-80">{error}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw size={14} /> Retry
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft size={14} /> Go back
          </Button>
        </div>
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
    <>
      {showEditModal && (
        <EditPatientModal
          patient={patient}
          onSave={(updated) => {
            setPatient(updated);
            setShowEditModal(false);
            toast({ title: "Patient updated", description: "Changes saved successfully.", type: "success" });
          }}
          onClose={() => setShowEditModal(false)}
        />
      )}

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
              {stats.total === 0 && !casesLoading && (
                <StatusBadge tone="neutral">No cases</StatusBadge>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:bg-[color:var(--border)]/30 transition-colors"
            aria-label="Edit patient"
            title="Edit patient"
          >
            <Edit2 size={14} />
          </button>
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
                <span className={`text-2xl font-bold tabular-nums ${s.cls}`}>
                  {casesLoading ? <SkeletonBlock className="h-7 w-8 mx-auto" /> : s.value}
                </span>
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

        {/* ── Tab switcher ── */}
        <div className="flex gap-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--muted)]/30 p-1">
          {([ ['overview', LayoutDashboard, 'Overview'], ['timeline', History, 'Timeline'] ] as const).map(([tab, Icon, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all',
                activeTab === tab
                  ? 'bg-[color:var(--card)] text-[color:var(--foreground)] shadow-sm'
                  : 'text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]',
              ].join(' ')}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Overview tab ── */}
        {activeTab === 'overview' && (
          <>
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
              {patient.clinicalNotes && (
                <div className="mt-4 border-t border-[color:var(--border)]/60 pt-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
                    Clinical Notes
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                    {patient.clinicalNotes}
                  </p>
                </div>
              )}
            </Card>

            {/* ── Treatment history ── */}
            <div className="space-y-3">
              <SectionHeader
                eyebrow="Clinical"
                title="Treatment History"
                action={
                  patientCases.length > 0 ? (
                    <Link href={`/cases?patientId=${patient.id}`}>
                      <Button variant="ghost" size="sm">View all</Button>
                    </Link>
                  ) : undefined
                }
              />

              {casesLoading ? (
                <div className="space-y-3">
                  <SkeletonBlock className="h-20 w-full" />
                  <SkeletonBlock className="h-20 w-full" />
                </div>
              ) : patientCases.length === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="No cases yet"
                  body="Create a new case to start the clinical workflow for this patient."
                />
              ) : (
                <div className="relative">
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
                            <span
                              className={[
                                "relative z-10 mt-3.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition",
                                idx === 0
                                  ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]"
                                  : "border-[color:var(--border)] bg-[color:var(--card)]",
                              ].join(" ")}
                            >
                              {c.status === "completed" && <CheckCircle2 size={10} className="text-emerald-500" />}
                              {c.status === "active_treatment" && <span className="h-2 w-2 rounded-full bg-[color:var(--primary)]" />}
                            </span>
                            <Card className="flex-1 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                                    {c.chiefComplaint ?? "No chief complaint"}
                                  </p>
                                  {c.malocclusionClass && (
                                    <p className="mt-0.5 truncate text-xs text-[color:var(--muted-foreground)]">{c.malocclusionClass}</p>
                                  )}
                                  <div className="mt-2">
                                    <ProgressBar value={progress} tone={progress >= 80 ? "success" : progress >= 50 ? "primary" : "warning"} />
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1.5">
                                  <StatusBadge tone={caseStatusTone(c.status)}>
                                    {c.status.replace(/_/g, " ")}
                                  </StatusBadge>
                                  <span className="flex items-center gap-1 text-[10px] text-[color:var(--muted-foreground)]">
                                    <CalendarDays size={9} />
                                    {new Date(c.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
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
          </>
        )}

        {/* ── Timeline tab ── */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            {/* Add note input */}
            <Card className="p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
                Add Clinical Note
              </p>
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Record a clinical observation, follow-up note, or event…"
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleAddNote()}
                  disabled={!newNote.trim() || addingNote}
                  className="self-end flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--primary)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
                  aria-label="Add note"
                >
                  {addingNote ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
                </button>
              </div>
            </Card>

            {/* Timeline events */}
            {timelineLoading ? (
              <div className="space-y-3">
                {[0,1,2,3].map((i) => <SkeletonBlock key={i} className="h-20 w-full" />)}
              </div>
            ) : timeline.length === 0 ? (
              <EmptyState
                icon={MessageSquarePlus}
                title="No timeline events yet"
                body="Case transitions, scan uploads, appointments, and clinical notes will appear here."
              />
            ) : (
              <div className="relative">
                <div aria-hidden className="absolute left-[19px] top-6 w-px bg-[color:var(--border)]" style={{ bottom: 20 }} />
                <div className="space-y-3">
                  {timeline.map((event) => {
                    const meta = TIMELINE_TYPE_META[event.type] ?? DEFAULT_TIMELINE_META;
                    const Icon = meta.icon;
                    const { date, time } = formatTimelineDate(event.occurredAt);
                    return (
                      <div key={event.id} className="relative flex items-start gap-3">
                        <span className={`relative z-10 mt-3.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${meta.bg}`}>
                          <Icon size={10} className={meta.color} />
                        </span>
                        <Card className="flex-1 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-[color:var(--foreground)]">{event.label}</p>
                              {event.detail && (
                                <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)] line-clamp-3">{event.detail}</p>
                              )}
                              {event.actor && (
                                <p className="mt-1 text-[10px] text-[color:var(--muted-foreground)]">by {event.actor}</p>
                              )}
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-[10px] font-medium text-[color:var(--muted-foreground)]">{date}</p>
                              {time && <p className="text-[10px] text-[color:var(--muted-foreground)]">{time}</p>}
                            </div>
                          </div>
                          {event.caseId && (
                            <div className="mt-2 border-t border-[color:var(--border)]/50 pt-2">
                              <Link href={`/cases?id=${event.caseId}`} className="text-[10px] font-medium text-[color:var(--primary)] hover:underline">
                                View case →
                              </Link>
                            </div>
                          )}
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </>
  );
}
