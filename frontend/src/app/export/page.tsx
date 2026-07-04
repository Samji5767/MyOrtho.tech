"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Download,
  FileText,
  Layers,
  Package,
  Search,
  Shield,
  Stethoscope,
  X,
} from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  SectionHeader,
  SkeletonBlock,
  Spinner,
  StatusBadge,
} from "@/components/DesignSystem";
import { fetchCases, fetchCase, type CaseListItem } from "@/lib/api/cases";
import dynamic from "next/dynamic";

const ExportPackagePanel = dynamic(
  () => import("@/components/ExportPackagePanel"),
  { ssr: false, loading: () => <SkeletonBlock className="h-64 w-full" /> },
);

// ─── Export format catalogue ─────────────────────────────────────────────────

const FORMATS = [
  {
    id: "stl_binary",
    label: "STL Binary",
    ext: ".stl",
    desc: "Standard binary mesh for printing",
    icon: Layers,
    tone: "primary" as const,
  },
  {
    id: "stl_ascii",
    label: "STL ASCII",
    ext: ".stl",
    desc: "ASCII mesh for compatibility",
    icon: Layers,
    tone: "info" as const,
  },
  {
    id: "obj",
    label: "OBJ",
    ext: ".obj",
    desc: "Wavefront OBJ with material",
    icon: Layers,
    tone: "info" as const,
  },
  {
    id: "3mf",
    label: "3MF",
    ext: ".3mf",
    desc: "3D Manufacturing Format",
    icon: Package,
    tone: "primary" as const,
  },
  {
    id: "zip",
    label: "Full Package ZIP",
    ext: ".zip",
    desc: "All arches + treatment plan",
    icon: Package,
    tone: "success" as const,
  },
  {
    id: "pdf_report",
    label: "Clinical Report",
    ext: ".pdf",
    desc: "PDF with measurements & notes",
    icon: FileText,
    tone: "warning" as const,
  },
  {
    id: "csv",
    label: "CSV Measurements",
    ext: ".csv",
    desc: "Tooth movements & IPR data",
    icon: FileText,
    tone: "neutral" as const,
  },
  {
    id: "json",
    label: "Treatment Plan JSON",
    ext: ".json",
    desc: "Machine-readable plan data",
    icon: FileText,
    tone: "neutral" as const,
  },
];

// ─── Case selector ────────────────────────────────────────────────────────────

function CaseSelector({
  onSelect,
}: {
  onSelect: (caseId: string) => void;
}) {
  const [cases, setCases] = useState<CaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchCases()
      .then(({ cases: data }) => setCases(data))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cases;
    return cases.filter(
      (c) =>
        `${c.patient.firstName} ${c.patient.lastName}`
          .toLowerCase()
          .includes(q) ||
        (c.chiefComplaint ?? "").toLowerCase().includes(q),
    );
  }, [cases, query]);

  return (
    <div className="space-y-4">
      <SectionHeader
        eyebrow="Export Center"
        title="Select a Case"
        description="Choose a case to export its treatment data, meshes, and clinical report."
      />

      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary"
          aria-hidden
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by patient name or complaint…"
          className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <SkeletonBlock key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No cases found"
          body={
            query
              ? `No cases match "${query}"`
              : "Create a case first to access export options."
          }
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card overflow-hidden">
          {filtered.map((c) => {
            const name = `${c.patient.firstName} ${c.patient.lastName}`;
            const initials =
              `${c.patient.firstName[0] ?? ""}${c.patient.lastName[0] ?? ""}`.toUpperCase();
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {initials}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {name}
                  </p>
                  <p className="truncate text-xs text-secondary">
                    {c.chiefComplaint ?? c.status}
                  </p>
                </div>
                <StatusBadge
                  tone={
                    c.status === "approved" || c.status === "completed"
                      ? "success"
                      : c.status === "clinical_review" ||
                          c.status === "planning"
                        ? "warning"
                        : "info"
                  }
                >
                  {c.status.replace(/_/g, " ")}
                </StatusBadge>
                <ChevronRight size={14} className="shrink-0 text-secondary" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Format grid ──────────────────────────────────────────────────────────────

function FormatGrid({ caseId }: { caseId: string }) {
  return (
    <div className="space-y-4">
      <SectionHeader eyebrow="Available Formats" title="Export Options" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {FORMATS.map((fmt) => {
          const Icon = fmt.icon;
          return (
            <Card
              key={fmt.id}
              className="flex flex-col gap-2 p-3 cursor-default"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Icon size={14} className="text-primary" aria-hidden />
                </span>
                <span className="text-xs font-bold text-foreground">
                  {fmt.label}
                </span>
              </div>
              <p className="text-[11px] text-secondary leading-snug">
                {fmt.desc}
              </p>
              <span className="mt-auto font-mono text-[10px] text-muted-foreground">
                {fmt.ext}
              </span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── Compliance notice ────────────────────────────────────────────────────────

function ComplianceNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-blue-200/60 bg-blue-50/60 px-4 py-3 text-xs text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300">
      <Shield size={14} className="mt-0.5 shrink-0" aria-hidden />
      <span>
        <strong>HIPAA / clinical compliance:</strong> All export packages are
        SHA-256 checksummed and logged to the audit trail. Exports containing
        PHI require doctor approval before download.
      </span>
    </div>
  );
}

// ─── Export panel wrapper (fetches planId) ───────────────────────────────────

function ExportPanelWrapper({ caseId }: { caseId: string }) {
  const [planId, setPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCase(caseId)
      .then(({ data }) => {
        setPlanId(data.linkedResources?.planId ?? null);
      })
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-secondary">
        <Spinner size={16} /> Loading case details…
      </div>
    );
  }

  if (!planId) {
    return (
      <Card className="p-6 text-center">
        <Stethoscope size={24} className="mx-auto text-secondary opacity-50" />
        <p className="mt-3 text-sm font-medium text-foreground">
          No treatment plan found
        </p>
        <p className="mt-1 text-xs text-secondary">
          Create a treatment plan for this case before generating export packages.
        </p>
        <div className="mt-4">
          <Link href={`/treatment-plan?caseId=${caseId}`}>
            <Button variant="primary" size="sm">
              Go to Treatment Plan
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return <ExportPackagePanel caseId={caseId} planId={planId} />;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const caseId = searchParams.get("caseId");

  const handleSelect = useCallback(
    (id: string) => {
      router.replace(`/export?caseId=${id}`);
    },
    [router],
  );

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">
      {/* Compact back nav when caseId is set */}
      {caseId && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.replace("/export")}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-secondary hover:text-foreground"
          >
            <ArrowRight size={13} className="rotate-180" />
            All Cases
          </button>
          <span className="text-xs text-muted-foreground">/ Export</span>
        </div>
      )}

      {!caseId ? (
        <>
          <CaseSelector onSelect={handleSelect} />
          <FormatGrid caseId="" />
          <ComplianceNotice />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <SectionHeader eyebrow="Export Center" title="Export Package" />
            <Link href={`/cases/${caseId}`}>
              <Button variant="ghost" size="sm">
                View Case
              </Button>
            </Link>
          </div>

          <ExportPanelWrapper caseId={caseId} />
          <ComplianceNotice />
        </>
      )}
    </section>
  );
}
