"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpDown,
  CalendarDays,
  ChevronRight,
  FileText,
  HeartPulse,
  Search,
  UploadCloud,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import NativeSheet from "@/components/NativeSheet";
import { Button, Card, SkeletonBlock, StatusBadge } from "@/components/DesignSystem";
import { fetchPatients } from "@/lib/api/patients";

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

const STAGGER_CLASSES = [
  "animate-stagger-1",
  "animate-stagger-2",
  "animate-stagger-3",
  "animate-stagger-4",
  "animate-stagger-5",
  "animate-stagger-6",
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sortPatients(list: Patient[], key: SortKey): Patient[] {
  const arr = [...list];
  switch (key) {
    case "name_asc":    return arr.sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
    case "name_desc":   return arr.sort((a, b) => `${b.firstName} ${b.lastName}`.localeCompare(`${a.firstName} ${a.lastName}`));
    case "cases_desc":  return arr.sort((a, b) => b.caseCount - a.caseCount);
    case "newest":      return arr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case "oldest":      return arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    default:            return arr;
  }
}

function formatAge(dob: string | null): string | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const age = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600000));
  return `${age}y`;
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function PatientsPage() {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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
        <Button variant="primary" size="sm" onClick={() => setSheetOpen(true)}>
          <UserPlus size={13} />
          Add Patient
        </Button>
      </div>

      {/* ── Stat strip ── */}
      {!loading && patients.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Total",       value: patients.length,  icon: Users,       cls: "text-[color:var(--primary)]",        bg: "bg-[color:var(--primary-glow)]" },
            { label: "With Cases",  value: activeCaseCount,  icon: HeartPulse,  cls: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "New (30d)",   value: patients.filter(p => (Date.now() - new Date(p.createdAt).getTime()) < 30 * 86400000).length,
              icon: CalendarDays, cls: "text-sky-600 dark:text-sky-400", bg: "bg-sky-500/10" },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="flex flex-col items-center gap-1.5 p-3 text-center animate-stagger-1">
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

      {/* ── Search + Sort ── */}
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
                <SkeletonBlock className="h-10 w-10 shrink-0 rounded-2xl" />
                <div className="flex-1 space-y-2">
                  <SkeletonBlock className="h-3.5 w-36" />
                  <SkeletonBlock className="h-3 w-20" />
                </div>
                <SkeletonBlock className="h-5 w-12 rounded-full" />
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

        {/* ── Patient list ── */}
        {!loading && !error && filteredPatients.length > 0 && (
          <>
            <div className="mt-3 flex items-center justify-between px-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                {query ? `${filteredPatients.length} result${filteredPatients.length !== 1 ? "s" : ""}` : `${filteredPatients.length} patient${filteredPatients.length !== 1 ? "s" : ""}`}
              </p>
              <ArrowUpDown size={11} className="text-[color:var(--muted-foreground)]" aria-hidden />
            </div>
            <ul className="mt-1 divide-y divide-[color:var(--border)]">
              {filteredPatients.map((p, idx) => {
                const stagger = STAGGER_CLASSES[Math.min(idx, STAGGER_CLASSES.length - 1)];
                const age = formatAge(p.dateOfBirth);
                const initials = `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase();
                return (
                  <li key={p.id} className={stagger}>
                    <Link
                      href={`/patients/${p.id}`}
                      className="group flex items-center gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-[color:var(--muted-foreground)]/5"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-sm font-bold text-[color:var(--primary)]">
                        {initials}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                          {p.firstName} {p.lastName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[color:var(--muted-foreground)]">
                          {p.caseCount} case{p.caseCount !== 1 ? "s" : ""}
                          {age ? ` · ${age} old` : ""}
                          {p.gender ? ` · ${p.gender}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {p.caseCount > 0 && (
                          <StatusBadge tone={p.caseCount >= 3 ? "primary" : "success"}>
                            {p.caseCount} {p.caseCount === 1 ? "case" : "cases"}
                          </StatusBadge>
                        )}
                        <ChevronRight size={14} className="text-[color:var(--muted-foreground)] transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
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
                <Button variant="primary" size="sm" onClick={() => setSheetOpen(true)}>
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
                { icon: UploadCloud, title: "Upload a scan", body: "Import an STL, PLY, or OBJ file to start the AI segmentation pipeline.", href: "/studio" },
                { icon: UserPlus, title: "Add a patient", body: "Create a patient record to link cases, scans, and treatment plans.", href: undefined },
                { icon: HeartPulse, title: "Open CAD workspace", body: "Full-screen workspace for scan review, CAD design, and treatment staging.", href: "/desktop" },
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
                  <button key={item.title} type="button" onClick={() => setSheetOpen(true)} className="ios-chip p-4 text-left transition-transform active:scale-[0.99]">{inner}</button>
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
              <DocRow title="Consent forms" body="Signed documents and treatment acknowledgements." />
              <DocRow title="Care instructions" body="Cleaning, wear-time, and food guidance for each patient." />
            </div>
          </Card>
        </>
      )}

      <NativeSheet isOpen={sheetOpen} title="Patient actions" onClose={() => setSheetOpen(false)}>
        <div className="space-y-3">
          <SheetAction icon={UserPlus}    title="Add patient"       body="Create a new patient record with contact and clinical details." />
          <SheetAction icon={UploadCloud} title="Upload scan"       body="Import an STL, PLY, or OBJ file and link it to a patient." />
          <SheetAction icon={CalendarDays} title="Book appointment" body="Schedule a visit and link it to a patient record." />
          <SheetAction icon={FileText}    title="Upload document"   body="Attach consent forms, X-rays, or care instructions." />
        </div>
      </NativeSheet>
    </section>
  );
}

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

function SheetAction({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="ios-chip flex items-start gap-3 px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">{body}</p>
      </div>
    </div>
  );
}
