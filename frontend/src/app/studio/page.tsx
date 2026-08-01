"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";
import { useAuth } from "@/context/AuthContext";
import { FolderKanban, Loader2, Search, ScanSearch } from "lucide-react";

const DentalAnatomyViewer = dynamic(
  () => import("@/components/DentalAnatomyViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[color:var(--primary)]" />
      </div>
    ),
  },
);

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase());
}

function statusDot(s: string): string {
  if (s === "completed") return "bg-emerald-500";
  if (s === "active_treatment") return "bg-blue-500";
  if (s === "approved") return "bg-violet-500";
  return "bg-[color:var(--muted-foreground)]";
}

export default function StudioPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCases()
      .then(r => {
        setCases(r.cases);
        const first = r.cases.find(c =>
          c.status === "active_treatment" ||
          c.status === "approved" ||
          c.status === "completed",
        ) ?? r.cases[0] ?? null;
        if (first) setSelectedId(first.id);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = cases.filter(c => {
    if (!query) return true;
    const q = query.toLowerCase();
    const name = `${c.patient.firstName} ${c.patient.lastName}`.toLowerCase();
    return name.includes(q) || (c.chiefComplaint ?? "").toLowerCase().includes(q);
  });

  const selected = cases.find(c => c.id === selectedId) ?? null;

  return (
    <div className="flex h-[calc(100vh-var(--tab-bar-height,0px))] overflow-hidden bg-[color:var(--background)]">
      {/* ── Case list sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-72 flex-col border-r border-[color:var(--border)] bg-[color:var(--card)]">
        <div className="border-b border-[color:var(--border)] px-4 py-4">
          <h1 className="text-sm font-semibold text-[color:var(--foreground)]">3D Studio</h1>
          <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">Select a case to open the 3D viewer</p>
        </div>

        <div className="px-3 py-2.5 border-b border-[color:var(--border)]">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
            <input
              type="search"
              placeholder="Search patients…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] py-1.5 pl-7 pr-3 text-xs text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-[color:var(--primary)]" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-[color:var(--muted-foreground)]">
              {query ? "No matching cases" : "No cases yet"}
            </p>
          ) : (
            filtered.map(c => {
              const name = `${c.patient.firstName} ${c.patient.lastName}`;
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={[
                    "w-full text-left px-3 py-2.5 transition-colors",
                    active
                      ? "bg-[color:var(--primary)]/10"
                      : "hover:bg-[color:var(--muted)]/30",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className={["mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", statusDot(c.status)].join(" ")}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className={["truncate text-xs font-medium", active ? "text-[color:var(--primary)]" : "text-[color:var(--foreground)]"].join(" ")}>
                        {name}
                      </p>
                      {c.chiefComplaint && (
                        <p className="truncate text-[10px] text-[color:var(--muted-foreground)]">{c.chiefComplaint}</p>
                      )}
                      <p className="mt-0.5 text-[10px] text-[color:var(--muted-foreground)]">{statusLabel(c.status)}</p>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Main 3D viewport ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selected ? (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                  {selected.patient.firstName} {selected.patient.lastName}
                </h2>
                {selected.chiefComplaint && (
                  <p className="truncate text-xs text-[color:var(--muted-foreground)]">{selected.chiefComplaint}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-4">
                <span className={["inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", statusDot(selected.status), "text-white"].join(" ")}>
                  {statusLabel(selected.status)}
                </span>
                <Link
                  href={`/cases?case=${selected.id}`}
                  className="text-xs text-[color:var(--primary)] hover:underline"
                >
                  Open case
                </Link>
              </div>
            </div>

            {/* Viewer */}
            <div className="flex-1 overflow-auto p-4">
              <DentalAnatomyViewer caseId={selected.id} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            {loading ? (
              <Loader2 size={32} className="animate-spin text-[color:var(--primary)]" />
            ) : cases.length === 0 ? (
              <>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--muted)]">
                  <FolderKanban size={24} className="text-[color:var(--muted-foreground)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[color:var(--foreground)]">No cases yet</p>
                  <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                    Create a case and run AI segmentation to view 3D anatomy.
                  </p>
                </div>
                <Link
                  href="/cases/new"
                  className="rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--primary-foreground)] hover:opacity-90"
                >
                  New case
                </Link>
              </>
            ) : (
              <>
                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--muted)]">
                  <ScanSearch size={24} className="text-[color:var(--muted-foreground)]" />
                </div>
                <p className="text-sm text-[color:var(--muted-foreground)]">Select a case from the sidebar</p>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
