"use client";

import { useCallback, useEffect, useMemo, useState, Suspense } from "react";
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
    requiresApproval: false,
    category: "3D Mesh",
  },
  {
    id: "stl_ascii",
    label: "STL ASCII",
    ext: ".stl",
    desc: "ASCII mesh for broad compatibility",
    icon: Layers,
    tone: "info" as const,
    requiresApproval: false,
    category: "3D Mesh",
  },
  {
    id: "ply",
    label: "PLY",
    ext: ".ply",
    desc: "Polygon mesh with color and normals",
    icon: Layers,
    tone: "info" as const,
    requiresApproval: false,
    category: "3D Mesh",
  },
  {
    id: "obj",
    label: "OBJ",
    ext: ".obj",
    desc: "Wavefront OBJ with material data",
    icon: Layers,
    tone: "info" as const,
    requiresApproval: false,
    category: "3D Mesh",
  },
  {
    id: "off",
    label: "OFF",
    ext: ".off",
    desc: "Object File Format for mesh interchange",
    icon: Layers,
    tone: "neutral" as const,
    requiresApproval: false,
    category: "3D Mesh",
  },
  {
    id: "3mf",
    label: "3MF",
    ext: ".3mf",
    desc: "3D Manufacturing Format",
    icon: Package,
    tone: "primary" as const,
    requiresApproval: false,
    category: "3D Mesh",
  },
  {
    id: "zip",
    label: "Full Package",
    ext: ".zip",
    desc: "All arches + treatment plan + reports",
    icon: Package,
    tone: "success" as const,
    requiresApproval: true,
    category: "Package",
  },
  {
    id: "pdf_report",
    label: "Clinical Report",
    ext: ".pdf",
    desc: "PDF with measurements, notes & images",
    icon: FileText,
    tone: "warning" as const,
    requiresApproval: true,
    category: "Report",
  },
  {
    id: "csv",
    label: "CSV Measurements",
    ext: ".csv",
    desc: "Tooth movements & IPR data table",
    icon: FileText,
    tone: "neutral" as const,
    requiresApproval: false,
    category: "Data",
  },
  {
    id: "json",
    label: "Plan JSON",
    ext: ".json",
    desc: "Machine-readable treatment plan data",
    icon: FileText,
    tone: "neutral" as const,
    requiresApproval: false,
    category: "Data",
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
  const byCategory = FORMATS.reduce<Record<string, typeof FORMATS>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">
            Available Formats
          </p>
          <h2 className="mt-0.5 text-lg font-semibold text-[color:var(--foreground)]">
            Export Options
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-amber-200/70 bg-amber-50/70 px-3 py-1.5 text-[10px] font-semibold text-amber-700 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-400">
          <Shield size={11} />
          PHI requires approval
        </div>
      </div>

      {Object.entries(byCategory).map(([cat, fmts]) => (
        <div key={cat}>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
            {cat}
          </p>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {fmts.map((fmt) => {
              const Icon = fmt.icon;
              return (
                <Card key={fmt.id} className="flex flex-col gap-2 p-3 cursor-default">
                  <div className="flex items-start justify-between gap-1">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--primary-glow)]">
                      <Icon size={13} className="text-[color:var(--primary)]" aria-hidden />
                    </span>
                    {fmt.requiresApproval && (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                        PHI
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[color:var(--foreground)]">{fmt.label}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-[color:var(--muted-foreground)]">
                      {fmt.desc}
                    </p>
                  </div>
                  <span className="mt-auto font-mono text-[10px] text-[color:var(--muted-foreground)]">
                    {fmt.ext}
                  </span>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
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
      <div className="space-y-3">
        <SkeletonBlock className="h-32 w-full" />
        <SkeletonBlock className="h-24 w-full" />
        <SkeletonBlock className="h-24 w-full" />
      </div>
    );
  }

  if (!planId) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--primary-glow)]">
          <Stethoscope size={22} className="text-[color:var(--primary)]" />
        </div>
        <p className="mt-4 text-base font-semibold text-[color:var(--foreground)]">
          No treatment plan yet
        </p>
        <p className="mt-1.5 mx-auto max-w-xs text-sm text-[color:var(--muted-foreground)]">
          Create and approve a treatment plan for this case before generating export packages.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href={`/treatment-plan?caseId=${caseId}`}>
            <Button variant="primary" size="sm">
              Go to Treatment Plan
            </Button>
          </Link>
          <Link href={`/cases?id=${caseId}`}>
            <Button variant="secondary" size="sm">
              View Case
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  return <ExportPackagePanel caseId={caseId} planId={planId} />;
}

// ─── Printer compatibility ────────────────────────────────────────────────────

const PRINTER_COMPAT = [
  { name: "3Shape Trios",        type: "Scanner",  formats: ["STL", "PLY", "OBJ"] },
  { name: "Medit i700",          type: "Scanner",  formats: ["STL", "PLY", "OBJ"] },
  { name: "iTero Element",       type: "Scanner",  formats: ["STL", "PLY"] },
  { name: "Carestream CS 3600",  type: "Scanner",  formats: ["STL", "PLY"] },
  { name: "Exocad DentalCAD",    type: "CAD",      formats: ["STL", "PLY", "OBJ", "OFF"] },
  { name: "Dental Wings",        type: "CAD",      formats: ["STL", "OBJ", "3MF"] },
  { name: "Maestro 3D",          type: "CAD",      formats: ["STL", "OBJ"] },
  { name: "OnyxCeph",            type: "Planning", formats: ["STL", "OBJ"] },
  { name: "uLab Systems",        type: "Planning", formats: ["STL"] },
  { name: "ArchForm",            type: "Planning", formats: ["STL", "OBJ"] },
  { name: "SprintRay Pro",       type: "Printer",  formats: ["STL", "3MF"] },
  { name: "Asiga MAX",           type: "Printer",  formats: ["STL", "3MF"] },
  { name: "Ackuretta Ackuray",   type: "Printer",  formats: ["STL", "3MF"] },
  { name: "Formlabs Form 3B+",   type: "Printer",  formats: ["STL", "3MF", "PLY"] },
  { name: "NextDent 5100",       type: "Printer",  formats: ["STL", "3MF"] },
] as const;

const TYPE_BADGE: Record<string, string> = {
  Scanner: "text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-950/40",
  CAD:     "text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-950/40",
  Planning:"text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-950/40",
  Printer: "text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950/40",
};

function PrinterCompatibility() {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">
          Device Compatibility
        </p>
        <h2 className="mt-0.5 text-lg font-semibold text-[color:var(--foreground)]">
          Compatible Systems
        </h2>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          Common orthodontic scanners, CAD systems, and 3D printers that accept these export formats.
          Verify support with your specific device model and firmware.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[color:var(--border)] bg-[color:var(--card)]">
              <th className="px-4 py-2.5 text-left font-semibold text-[color:var(--foreground)]">System</th>
              <th className="px-3 py-2.5 text-left font-semibold text-[color:var(--foreground)]">Type</th>
              <th className="px-3 py-2.5 text-left font-semibold text-[color:var(--foreground)]">Accepted Formats</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[color:var(--border)] bg-[color:var(--card)]">
            {PRINTER_COMPAT.map((row) => (
              <tr key={row.name} className="transition-colors hover:bg-[color:var(--primary-glow)]">
                <td className="px-4 py-2 font-medium text-[color:var(--foreground)]">{row.name}</td>
                <td className="px-3 py-2">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_BADGE[row.type] ?? ""}`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {row.formats.map((f) => (
                      <span
                        key={f}
                        className="rounded border border-[color:var(--border)] bg-[color:var(--background)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--foreground)]"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-[color:var(--muted-foreground)]">
        Compatibility is based on published format specifications. MyOrtho makes no certification claims — always confirm acceptance with your device manufacturer.
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ExportPageContent() {
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
          <PrinterCompatibility />
          <ComplianceNotice />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <SectionHeader eyebrow="Export Center" title="Export Package" />
            <Link href={`/cases?id=${caseId}`}>
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

export default function ExportPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center text-sm text-[color:var(--muted-foreground)]">Loading export…</div>}>
      <ExportPageContent />
    </Suspense>
  );
}
