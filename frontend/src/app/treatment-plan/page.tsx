"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FolderKanban,
  Layers3,
  Search,
} from "lucide-react";
import { Card } from "@/components/DesignSystem";
import { ClinicalWarningBanner } from "@/components/ui/ClinicalWarningBanner";
import TreatmentPlansPanel from "@/components/TreatmentPlansPanel";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";

// ─── Status label map ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active_treatment: "Active",
  pending_records: "Pending Records",
  scan_review: "Scan Review",
  clinical_review: "Clinical Review",
  planning: "Planning",
  manufacturing: "Manufacturing",
  completed: "Completed",
  on_hold: "On Hold",
  draft: "Draft",
};

// ─── Case selector ────────────────────────────────────────────────────────────

function CaseSelector({ onSelect }: { onSelect: (c: CaseListItem) => void }) {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoadError(null);
    fetchCases()
      .then(({ cases }) => setCases(cases))
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Failed to load cases"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = cases.filter((c) => {
    const q = search.toLowerCase();
    const patientName = `${c.patient.firstName} ${c.patient.lastName}`.toLowerCase();
    return (
      patientName.includes(q) ||
      (c.chiefComplaint ?? "").toLowerCase().includes(q) ||
      c.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
        <input
          className={[
            "h-10 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]",
            "pl-8 pr-3 text-sm text-[color:var(--foreground)]",
            "placeholder:text-[color:var(--muted-foreground)]",
            "focus:border-[color:var(--primary)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/20",
          ].join(" ")}
          placeholder="Search by patient or complaint…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loadError && (
        <div className="rounded-xl border border-rose-200/60 bg-rose-50 dark:bg-rose-950/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          {loadError}
        </div>
      )}

      {loading ? (
        <div className="space-y-2 py-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-4 w-32 animate-skeleton rounded" />
              <div className="ml-auto h-5 w-16 animate-skeleton rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border)] py-8 text-center text-sm text-[color:var(--muted-foreground)]">
          {search ? `No cases matching "${search}"` : "No cases yet"}
          <Link href="/cases/new" className="ml-1 font-medium text-[color:var(--primary)] hover:underline">
            Create one
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-[color:var(--border)] divide-y divide-[color:var(--border)] overflow-hidden">
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-[color:var(--muted)]/30 transition-colors"
            >
              <div className="min-w-0">
                <p className="font-semibold text-[color:var(--foreground)]">
                  {c.patient.firstName} {c.patient.lastName}
                </p>
                {c.chiefComplaint && (
                  <p className="truncate text-xs text-[color:var(--muted-foreground)]">{c.chiefComplaint}</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-[color:var(--primary-glow)] px-2.5 py-0.5 text-[10px] font-semibold text-[color:var(--primary)]">
                {STATUS_LABEL[c.status] ?? c.status}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function TreatmentPlanPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const caseId = searchParams?.get("caseId") ?? null;
  const [selectedCase, setSelectedCase] = useState<CaseListItem | null>(null);

  // If caseId is in URL, load the case
  useEffect(() => {
    if (!caseId) return;
    fetchCases().then(({ cases }) => {
      const found = cases.find((c) => c.id === caseId);
      if (found) setSelectedCase(found);
    });
  }, [caseId]);

  function handleSelect(c: CaseListItem) {
    setSelectedCase(c);
    router.replace(`/treatment-plan?caseId=${encodeURIComponent(c.id)}`);
  }

  const effectiveCaseId = caseId ?? selectedCase?.id ?? null;

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Treatment Planning
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Treatment Plans
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Stage generation, movement adjustment, and doctor approval
          </p>
        </div>
        <Link
          href="/cases"
          className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-xs font-medium text-[color:var(--foreground)] hover:border-[color:var(--primary)]/40 transition-colors"
        >
          <FolderKanban size={13} /> Cases
        </Link>
      </div>

      {/* Case context banner */}
      {selectedCase && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-[10px] font-bold text-[color:var(--primary)]">
              {selectedCase.patient.firstName[0]}{selectedCase.patient.lastName[0]}
            </div>
            <div>
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {selectedCase.patient.firstName} {selectedCase.patient.lastName}
              </p>
              {selectedCase.chiefComplaint && (
                <p className="text-xs text-[color:var(--muted-foreground)]">{selectedCase.chiefComplaint}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/cases?id=${selectedCase.id}`}
              className="text-xs font-medium text-[color:var(--primary)] hover:underline"
            >
              View case →
            </Link>
            <button
              type="button"
              onClick={() => { setSelectedCase(null); router.replace("/treatment-plan"); }}
              className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* AI disclaimer */}
      <ClinicalWarningBanner message="AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist." />

      {/* Main content */}
      {effectiveCaseId ? (
        <TreatmentPlansPanel caseId={effectiveCaseId} />
      ) : (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Layers3 size={15} className="text-[color:var(--primary)]" />
            <h2 className="text-sm font-semibold text-[color:var(--foreground)]">Select a case to view treatment plans</h2>
          </div>
          <CaseSelector onSelect={handleSelect} />
        </Card>
      )}
    </section>
  );
}

export default function TreatmentPlanPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-sm text-[color:var(--muted-foreground)]">Loading treatment plans…</div>}>
      <TreatmentPlanPageContent />
    </Suspense>
  );
}
