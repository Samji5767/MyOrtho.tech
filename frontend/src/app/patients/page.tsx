"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  ChevronRight,
  FileText,
  HeartPulse,
  Loader2,
  Search,
  UploadCloud,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import NativeSheet from "@/components/NativeSheet";
import { Button, Card, Input, Select, SkeletonBlock } from "@/components/DesignSystem";
import { fetchPatients, createPatient, type CreatePatientDto } from "@/lib/api/patients";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  caseCount: number;
  createdAt: string;
}

type SortKey = "name_asc" | "name_desc" | "cases_desc" | "newest" | "oldest";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sortPatients(list: Patient[], key: SortKey): Patient[] {
  const arr = [...list];
  switch (key) {
    case "name_asc":   return arr.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    case "name_desc":  return arr.sort((a, b) => `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`));
    case "cases_desc": return arr.sort((a, b) => b.caseCount - a.caseCount);
    case "newest":     return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "oldest":     return arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    default:           return arr;
  }
}

function formatAge(dob: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return `${Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600000))}y`;
}

function formatAdded(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatGender(g: string | null): string {
  if (!g) return "—";
  const map: Record<string, string> = {
    male: "Male",
    female: "Female",
    non_binary: "Non-binary",
    prefer_not_to_say: "Not stated",
    other: "Other",
  };
  return map[g] ?? g.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const DOB_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateDob(v: string): string | null {
  if (!v.trim()) return null; // optional field
  if (!DOB_RE.test(v)) return "Use YYYY-MM-DD format (e.g. 1990-06-15)";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "Not a valid date";
  if (d.getFullYear() < 1900) return "Year must be 1900 or later";
  if (d > new Date()) return "Date of birth cannot be in the future";
  return null;
}

const INITIAL_FORM: CreatePatientDto = {
  firstName: "", lastName: "", dateOfBirth: "", gender: "", clinicalNotes: "",
};

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState<CreatePatientDto>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Keyboard shortcut ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // ── Load patients ───────────────────────────────────────────────────────────
  useEffect(() => {
    fetchPatients()
      .then(({ patients: data }) => setPatients(data as Patient[]))
      .catch((e: Error) => setError(e?.message ?? "Failed to load patients"))
      .finally(() => setLoading(false));
  }, []);

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = q
      ? patients.filter((p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
        )
      : patients;
    return sortPatients(matched, sortKey);
  }, [query, patients, sortKey]);

  const activeCaseCount = patients.reduce((s, p) => s + (p.caseCount > 0 ? 1 : 0), 0);
  const new30d = patients.filter(
    (p) => Date.now() - new Date(p.createdAt).getTime() < 30 * 86400000,
  ).length;

  // ── Sheet helpers ───────────────────────────────────────────────────────────
  const openSheet = () => {
    setForm(INITIAL_FORM);
    setFormErrors({});
    setSubmitError(null);
    setSheetOpen(true);
  };

  const closeSheet = () => {
    if (!submitting) setSheetOpen(false);
  };

  const setField = (field: keyof CreatePatientDto, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
    }
    if (submitError) setSubmitError(null);
  };

  // ── Validation ──────────────────────────────────────────────────────────────
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.firstName?.trim()) errs.firstName = "First name is required";
    if (!form.lastName?.trim()) errs.lastName = "Last name is required";
    const dobErr = validateDob(form.dateOfBirth ?? "");
    if (dobErr) errs.dateOfBirth = dobErr;
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const dto: CreatePatientDto = {
        firstName: form.firstName!.trim(),
        lastName: form.lastName!.trim(),
        ...(form.dateOfBirth?.trim()    ? { dateOfBirth:    form.dateOfBirth.trim() }    : {}),
        ...(form.gender?.trim()         ? { gender:         form.gender.trim() }         : {}),
        ...(form.clinicalNotes?.trim()  ? { clinicalNotes:  form.clinicalNotes.trim() }  : {}),
      };
      const created = await createPatient(dto);
      setPatients((prev) => [{ ...created, caseCount: created.caseCount ?? 0 } as Patient, ...prev]);
      setSheetOpen(false);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create patient. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Patient Care</p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Patients
          </h1>
        </div>
        <Button variant="primary" size="sm" onClick={openSheet}>
          <UserPlus size={13} />
          Add Patient
        </Button>
      </div>

      {/* ── Stat strip ── */}
      {!loading && patients.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Total",      value: patients.length, icon: Users,       cls: "text-[color:var(--primary)]",                bg: "bg-[color:var(--primary-glow)]" },
            { label: "With Cases", value: activeCaseCount,  icon: HeartPulse,  cls: "text-emerald-600 dark:text-emerald-400",     bg: "bg-emerald-500/10" },
            { label: "New (30d)",  value: new30d,           icon: CalendarDays, cls: "text-sky-600 dark:text-sky-400",            bg: "bg-sky-500/10" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="flex flex-col items-center gap-1.5 p-3 text-center">
                <span className={`grid h-7 w-7 place-items-center rounded-xl ${s.bg} ${s.cls}`}>
                  <Icon size={13} />
                </span>
                <span className={`text-xl font-bold tabular-nums ${s.cls}`}>{s.value}</span>
                <span className="text-[10px] font-medium text-[color:var(--muted-foreground)]">{s.label}</span>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Search + Sort + Table ── */}
      <Card className="p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
              aria-hidden
            />
            <input
              ref={searchRef}
              type="search"
              placeholder="Search by name… ( / )"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search patients"
              className="h-10 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] pl-9 pr-8 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary-glow)] transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              >
                <X size={13} />
              </button>
            )}
          </div>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort patients"
            className="h-10 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 text-xs font-medium text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary-glow)] transition-all"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
            <option value="cases_desc">Most cases</option>
          </select>
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonBlock className="h-9 w-9 shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <SkeletonBlock className="h-3.5 w-40" />
                  <SkeletonBlock className="h-3 w-24" />
                </div>
                <SkeletonBlock className="h-5 w-10 rounded-full" />
              </div>
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {!loading && error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertCircle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── Patient table ── */}
        {!loading && !error && filteredPatients.length > 0 && (
          <>
            <p className="mt-3 mb-1 px-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
              {query
                ? `${filteredPatients.length} result${filteredPatients.length !== 1 ? "s" : ""}`
                : `${filteredPatients.length} patient${filteredPatients.length !== 1 ? "s" : ""}`}
            </p>
            <div className="overflow-x-auto -mx-1 px-1">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border)]">
                    <th className="pb-2 pt-1 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
                      Patient
                    </th>
                    <th className="pb-2 pt-1 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
                      Age
                    </th>
                    <th className="pb-2 pt-1 pr-4 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)] hidden sm:table-cell">
                      Gender
                    </th>
                    <th className="pb-2 pt-1 pr-4 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
                      Cases
                    </th>
                    <th className="pb-2 pt-1 text-left text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)] hidden md:table-cell">
                      Added
                    </th>
                    <th className="pb-2 pt-1 w-5" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map((p) => {
                    const age = formatAge(p.dateOfBirth);
                    const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
                    return (
                      <tr
                        key={p.id}
                        onClick={() => router.push(`/patients/${p.id}`)}
                        className="group cursor-pointer border-b border-[color:var(--border)] last:border-0 transition-colors hover:bg-[color:var(--primary-glow)]/30"
                      >
                        {/* Patient name + avatar */}
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[color:var(--primary-glow)] text-xs font-bold text-[color:var(--primary)]">
                              {initials}
                            </span>
                            <Link
                              href={`/patients/${p.id}`}
                              className="truncate font-semibold text-[color:var(--foreground)] hover:text-[color:var(--primary)] transition-colors focus-visible:outline-none focus-visible:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {p.firstName} {p.lastName}
                            </Link>
                          </div>
                        </td>
                        {/* Age */}
                        <td className="py-3 pr-4 tabular-nums text-[color:var(--muted-foreground)]">
                          {age ?? <span className="text-[color:var(--border)]">—</span>}
                        </td>
                        {/* Gender — hidden on xs */}
                        <td className="py-3 pr-4 text-[color:var(--muted-foreground)] hidden sm:table-cell">
                          {formatGender(p.gender)}
                        </td>
                        {/* Cases */}
                        <td className="py-3 pr-4 text-right tabular-nums">
                          {p.caseCount > 0 ? (
                            <span className={[
                              "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-bold",
                              p.caseCount >= 3
                                ? "bg-[color:var(--primary-glow)] text-[color:var(--primary)]"
                                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                            ].join(" ")}>
                              {p.caseCount}
                            </span>
                          ) : (
                            <span className="text-[color:var(--muted-foreground)]/40 tabular-nums">0</span>
                          )}
                        </td>
                        {/* Added date — hidden on sm */}
                        <td className="py-3 text-xs text-[color:var(--muted-foreground)] hidden md:table-cell">
                          {formatAdded(p.createdAt)}
                        </td>
                        {/* Arrow */}
                        <td className="py-3 pl-1">
                          <ChevronRight
                            size={13}
                            className="text-[color:var(--muted-foreground)] transition-transform group-hover:translate-x-0.5"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && filteredPatients.length === 0 && (
          <div className="mt-4 flex flex-col items-center gap-4 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
              <UserPlus size={24} />
            </span>
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {query ? `No results for "${query}"` : "No patients yet"}
              </p>
              <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                {query
                  ? "Try a different name or clear the search."
                  : "Add a patient or upload a scan to begin a clinical case."}
              </p>
            </div>
            {!query && (
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="primary" size="sm" onClick={openSheet}>
                  <UserPlus size={13} />
                  Add Patient
                </Button>
                <Link href="/studio">
                  <Button variant="secondary" size="sm">
                    <UploadCloud size={13} />
                    Upload Scan
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Workflow guide (first-run only) ── */}
      {!loading && !error && patients.length === 0 && !query && (
        <>
          <Card className="p-5 animate-stagger-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Getting Started</p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                  Start with a scan or patient record
                </h2>
              </div>
              <HeartPulse size={18} className="mt-1 shrink-0 text-[color:var(--primary)]" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { icon: UploadCloud, title: "Upload a scan",      body: "Import an STL, PLY, or OBJ file to start the AI segmentation pipeline.", href: "/studio" },
                { icon: UserPlus,    title: "Add a patient",      body: "Create a patient record to link cases, scans, and treatment plans.",       href: undefined },
                { icon: HeartPulse,  title: "Open CAD workspace", body: "Full-screen workspace for scan review, CAD design, and treatment staging.", href: "/desktop" },
              ].map((item) => {
                const Icon = item.icon;
                const inner = (
                  <>
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
                      <Icon size={16} />
                    </span>
                    <p className="mt-3 text-sm font-semibold text-[color:var(--foreground)]">{item.title}</p>
                    <p className="mt-1.5 text-xs leading-5 text-[color:var(--muted-foreground)]">{item.body}</p>
                  </>
                );
                return item.href ? (
                  <Link key={item.title} href={item.href} className="ios-chip p-4 transition-transform active:scale-[0.99]">{inner}</Link>
                ) : (
                  <button key={item.title} type="button" onClick={openSheet} className="ios-chip p-4 text-left transition-transform active:scale-[0.99]">{inner}</button>
                );
              })}
            </div>
          </Card>

          <Card className="p-5 animate-stagger-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Documents</p>
                <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
                  Document management
                </h2>
              </div>
              <FileText size={18} className="mt-1 shrink-0 text-[color:var(--primary)]" />
            </div>
            <div className="mt-4 space-y-2">
              <DocRow title="Treatment plans" body="Stage lists, checkpoints, and compliance notes stored per patient." />
              <DocRow title="Consent forms"   body="Signed documents and treatment acknowledgements." />
              <DocRow title="Care instructions" body="Cleaning, wear-time, and food guidance for each patient." />
            </div>
          </Card>
        </>
      )}

      {/* ── Add Patient sheet ── */}
      <NativeSheet isOpen={sheetOpen} title="Add Patient" onClose={closeSheet}>
        <form onSubmit={handleSubmit} noValidate className="space-y-4">

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="First Name *"
              value={form.firstName}
              onChange={(e) => setField("firstName", e.target.value)}
              error={formErrors.firstName}
              placeholder="Alex"
              autoComplete="given-name"
              disabled={submitting}
            />
            <Input
              label="Last Name *"
              value={form.lastName}
              onChange={(e) => setField("lastName", e.target.value)}
              error={formErrors.lastName}
              placeholder="Chen"
              autoComplete="family-name"
              disabled={submitting}
            />
          </div>

          {/* Date of birth */}
          <Input
            label="Date of Birth"
            type="text"
            inputMode="numeric"
            value={form.dateOfBirth}
            onChange={(e) => setField("dateOfBirth", e.target.value)}
            error={formErrors.dateOfBirth}
            placeholder="YYYY-MM-DD"
            hint="Optional — enter as YYYY-MM-DD, e.g. 1990-06-15"
            autoComplete="bday"
            disabled={submitting}
          />

          {/* Gender */}
          <Select
            label="Gender"
            value={form.gender}
            onChange={(e) => setField("gender", e.target.value)}
            disabled={submitting}
          >
            <option value="">Not stated</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non_binary">Non-binary</option>
            <option value="prefer_not_to_say">Prefer not to say</option>
            <option value="other">Other</option>
          </Select>

          {/* Clinical notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[color:var(--foreground)]">
              Clinical Notes{" "}
              <span className="font-normal text-[color:var(--muted-foreground)]">(optional)</span>
            </label>
            <textarea
              value={form.clinicalNotes}
              onChange={(e) => setField("clinicalNotes", e.target.value)}
              placeholder="Relevant medical history, allergies, treatment goals, or other clinical information…"
              rows={5}
              disabled={submitting}
              className="w-full resize-y rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] outline-none focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary-glow)] transition-all min-h-[110px] disabled:pointer-events-none disabled:opacity-50"
            />
          </div>

          {/* Submit error */}
          {submitError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {submitError}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1 border-t border-[color:var(--border)]/60">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={closeSheet}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? (
                <><Loader2 size={13} className="animate-spin" /> Saving…</>
              ) : (
                <><UserPlus size={13} /> Add Patient</>
              )}
            </Button>
          </div>
        </form>
      </NativeSheet>
    </section>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function DocRow({ title, body }: { title: string; body: string }) {
  return (
    <div className="ios-chip flex items-start justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">{body}</p>
      </div>
      <ChevronRight size={15} className="mt-0.5 shrink-0 text-[color:var(--muted-foreground)]" />
    </div>
  );
}
