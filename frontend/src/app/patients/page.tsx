"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  FileText,
  HeartPulse,
  Loader2,
  Search,
  UploadCloud,
  UserPlus,
  X,
  type LucideIcon,
} from "lucide-react";
import NativeSheet from "@/components/NativeSheet";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";
import { fetchPatients } from "@/lib/api/patients";

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  gender: string | null;
  caseCount: number;
  createdAt: string;
}

export default function PatientsPage() {
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPatients()
      .then(({ patients: data }) => setPatients(data as Patient[]))
      .catch((e: Error) => setError(e?.message ?? 'Failed to load patients'))
      .finally(() => setLoading(false));
  }, []);

  const filteredPatients = useMemo(
    () =>
      query.trim()
        ? patients.filter((p) =>
            `${p.firstName} ${p.lastName}`.toLowerCase().includes(query.toLowerCase())
          )
        : patients,
    [query, patients]
  );

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5 lg:px-8 lg:pb-10">
      {/* Header card */}
      <Card className="ios-card p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Patient care</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                Patients
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted-foreground)]">
                Treatment progress, appointments, reminders, and scans.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <StatusBadge tone="success">Mobile ready</StatusBadge>
              <Button variant="primary" size="sm" onClick={() => setSheetOpen(true)}>
                <UserPlus size={13} />
                Add patient
              </Button>
            </div>
          </div>

          {/* Search input */}
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]">
              <Search size={15} />
            </span>
            <input
              type="search"
              placeholder="Search by patient name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 w-full rounded-2xl border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)] pl-10 pr-10 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:ring-2 focus:ring-[color:var(--primary-glow)] transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-[color:var(--muted-foreground)]">
              <Loader2 size={16} className="animate-spin" />
              Loading patients…
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <p className="py-4 text-center text-sm text-rose-500">{error}</p>
          )}

          {/* Patient list */}
          {!loading && filteredPatients.length > 0 && (
            <ul className="divide-y divide-[color:var(--border)]">
              {filteredPatients.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/patients/${p.id}`}
                    className="flex items-center gap-3 px-1 py-3 transition-colors hover:bg-[color:var(--muted-foreground)]/5"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-sm font-bold text-[color:var(--primary)]">
                      {p.firstName[0]}{p.lastName[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                        {p.firstName} {p.lastName}
                      </p>
                      <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
                        {p.caseCount} case{p.caseCount !== 1 ? 's' : ''}
                        {p.gender ? ` · ${p.gender}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={15} className="shrink-0 text-[color:var(--muted-foreground)]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* Empty state */}
          {!loading && filteredPatients.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
                <UserPlus size={28} />
              </span>
              <div>
                <p className="text-base font-semibold text-[color:var(--foreground)]">
                  {query ? `No results for "${query}"` : "No patients yet"}
                </p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  {query
                    ? "Try a different name or clear the search."
                    : "Add a patient or upload a scan to begin a clinical case."}
                </p>
              </div>
              {!query && (
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    className="inline-flex h-11 items-center gap-2 rounded-full bg-[color:var(--primary)] px-5 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
                  >
                    <UserPlus size={15} />
                    Add Patient
                  </button>
                  <Link
                    href="/studio"
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-5 text-sm font-semibold text-[color:var(--foreground)] transition-transform active:scale-95"
                  >
                    <UploadCloud size={15} className="text-[color:var(--primary)]" />
                    Upload Scan
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Workflow guide — shown when no patients, helps orient new users */}
      {!loading && filteredPatients.length === 0 && !query && (
        <>
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Getting started</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                  Start with a scan or patient record
                </h2>
              </div>
              <HeartPulse size={20} className="text-[color:var(--primary)]" />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { icon: UploadCloud, title: "Upload a scan", body: "Drop an STL, PLY, or OBJ file to start the AI segmentation pipeline.", href: "/studio" },
                { icon: UserPlus, title: "Add a patient", body: "Create a patient record manually to link cases, scans, and treatment plans.", href: undefined },
                { icon: HeartPulse, title: "Open CAD workspace", body: "Use the full desktop workspace for scan review, CAD design, and treatment staging.", href: "/desktop" },
              ].map((item) => {
                const Icon = item.icon;
                const inner = (
                  <>
                    <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
                      <Icon size={18} />
                    </span>
                    <h3 className="mt-3 text-sm font-semibold text-[color:var(--foreground)]">{item.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{item.body}</p>
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

          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Documents</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                  Document management
                </h2>
              </div>
              <FileText size={20} className="text-[color:var(--primary)]" />
            </div>

            <div className="mt-4 space-y-2">
              <DocRow title="Treatment plans" body="Stage lists, checkpoints, and compliance notes stored per patient." />
              <DocRow title="Consent forms" body="Signed documents and treatment acknowledgements." />
              <DocRow title="Care instructions" body="Cleaning, wear-time, and food guidance for each patient." />
            </div>
          </Card>
        </>
      )}

      {/* Floating bottom bar */}
      <div className="fixed inset-x-0 bottom-4 z-30 mx-auto w-[min(92vw,32rem)] lg:hidden">
        <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_88%,transparent)] p-2 shadow-[var(--shadow-lg)] backdrop-blur-xl">
          <Link
            href="/"
            className="flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-semibold text-[color:var(--foreground)] transition-transform duration-200 active:scale-95"
          >
            <HeartPulse size={16} className="text-[color:var(--primary)]" />
            Dashboard
          </Link>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex-1 rounded-full bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform duration-200 active:scale-95"
          >
            Add patient
          </button>
        </div>
      </div>

      <NativeSheet isOpen={sheetOpen} title="Patient actions" onClose={() => setSheetOpen(false)}>
        <div className="space-y-3">
          <SheetAction icon={UserPlus} title="Add patient" body="Create a new patient record with contact and clinical details." />
          <SheetAction icon={UploadCloud} title="Upload scan" body="Import an STL, PLY, or OBJ file and link it to a patient." />
          <SheetAction icon={CalendarDays} title="Book appointment" body="Schedule a visit and link it to a patient record." />
          <SheetAction icon={FileText} title="Upload document" body="Attach consent forms, X-rays, or care instructions." />
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
      <ChevronRight size={16} className="mt-1 shrink-0 text-[color:var(--muted-foreground)]" />
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
