"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Search,
  Users,
  X,
} from "lucide-react";
import { fetchCases, type CaseListItem } from "@/lib/api/cases";
import { fetchPatients, type PatientListItem } from "@/lib/api/patients";
import { Spinner, StatusBadge } from "./DesignSystem";

type Category = "all" | "patients" | "cases";

const CATEGORIES: { key: Category; label: string }[] = [
  { key: "all", label: "All" },
  { key: "patients", label: "Patients" },
  { key: "cases", label: "Cases" },
];

function statusTone(status: string): "primary" | "success" | "warning" | "neutral" | "info" {
  switch (status) {
    case "active_treatment": return "success";
    case "clinical_review":
    case "scan_review":
    case "planning": return "warning";
    case "completed":
    case "approved": return "primary";
    default: return "info";
  }
}

export default function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("all");
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    const [casesRes, patientsRes] = await Promise.allSettled([
      fetchCases(),
      fetchPatients(),
    ]);
    if (casesRes.status === "fulfilled") setCases(casesRes.value.cases);
    if (patientsRes.status === "fulfilled") setPatients(patientsRes.value.patients);
    setLoading(false);
    setLoaded(true);
  }, [loaded]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = category === "all" || category === "cases" ? cases : [];
    if (!q) return all;
    return all.filter(c =>
      `${c.patient.firstName} ${c.patient.lastName}`.toLowerCase().includes(q) ||
      (c.chiefComplaint ?? "").toLowerCase().includes(q) ||
      c.status.includes(q) ||
      c.id.toLowerCase().includes(q),
    );
  }, [cases, query, category]);

  const filteredPatients = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = category === "all" || category === "patients" ? patients : [];
    if (!q) return all;
    return all.filter(p =>
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
    );
  }, [patients, query, category]);

  const totalResults = filteredCases.length + filteredPatients.length;
  const hasQuery = query.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search patients, cases, IDs…"
          className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          aria-label="Global search"
          autoComplete="off"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {loading && <Spinner size={14} />}
          {query && !loading && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear"
              className="text-secondary hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setCategory(cat.key)}
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold transition-all",
              category === cat.key
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-secondary hover:text-foreground",
            ].join(" ")}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="space-y-1 rounded-xl border border-border bg-card overflow-hidden">
        {!hasQuery && !loading && (
          <p className="px-4 py-6 text-center text-sm text-secondary">
            Type to search patients and cases across your clinic.
          </p>
        )}

        {hasQuery && totalResults === 0 && !loading && (
          <div className="flex flex-col items-center gap-2 py-10 text-sm text-secondary">
            <Search size={22} className="opacity-30" aria-hidden />
            <span>No results for &ldquo;{query}&rdquo;</span>
          </div>
        )}

        {/* Patient results */}
        {filteredPatients.length > 0 && (
          <div>
            <p className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
              Patients
            </p>
            {filteredPatients.map((p) => (
              <Link
                key={p.id}
                href={`/patients/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {p.firstName[0]}{p.lastName[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {p.firstName} {p.lastName}
                  </span>
                  <span className="block text-xs text-secondary">
                    {p.caseCount} case{p.caseCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <Users size={14} className="shrink-0 text-secondary" aria-hidden />
              </Link>
            ))}
          </div>
        )}

        {/* Case results */}
        {filteredCases.length > 0 && (
          <div>
            <p className="px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground border-b border-border">
              Cases
            </p>
            {filteredCases.map((c) => (
              <Link
                key={c.id}
                href={`/cases?id=${c.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {c.patient.firstName[0]}{c.patient.lastName[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {c.patient.firstName} {c.patient.lastName}
                  </span>
                  <span className="block truncate text-xs text-secondary">
                    {c.chiefComplaint ?? c.malocclusionClass ?? c.status}
                  </span>
                </div>
                <StatusBadge tone={statusTone(c.status)}>
                  {c.status.replace(/_/g, " ")}
                </StatusBadge>
                <ClipboardList size={14} className="shrink-0 text-secondary" aria-hidden />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
