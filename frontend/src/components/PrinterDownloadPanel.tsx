"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  FileBox,
  Loader2,
  Package2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Card } from "@/components/DesignSystem";
import { api } from "@/lib/api/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type PrinterBrand =
  | "Formlabs"
  | "Stratasys"
  | "EnvisionTEC"
  | "Carbon DLS"
  | "Asiga"
  | "Universal";

type FileFormat = "stl" | "3mf" | "obj" | "ply" | "zip";

interface PrinterFile {
  id: string;
  name: string;
  arch: "upper" | "lower" | "both" | "full";
  format: FileFormat;
  sizeBytes?: number;
  url: string;
  stage?: number;
  generatedAt?: string;
  status: "ready" | "generating" | "failed";
}

interface DownloadState {
  [fileId: string]: "idle" | "downloading" | "done" | "error";
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FORMAT_META: Record<
  FileFormat,
  { label: string; description: string; printers: PrinterBrand[]; color: string }
> = {
  stl: {
    label: "STL",
    description: "Standard Tessellation Language — universally supported",
    printers: ["Formlabs", "Stratasys", "EnvisionTEC", "Carbon DLS", "Asiga", "Universal"],
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  "3mf": {
    label: "3MF",
    description: "3D Manufacturing Format — color, material, and print settings",
    printers: ["Formlabs", "Stratasys"],
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  },
  obj: {
    label: "OBJ",
    description: "Wavefront OBJ — CAD and mesh editing workflows",
    printers: ["Formlabs", "Universal"],
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  },
  ply: {
    label: "PLY",
    description: "Polygon File Format — scan-derived mesh workflows",
    printers: ["Universal"],
    color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  },
  zip: {
    label: "ZIP",
    description: "Full package — all files bundled for lab delivery",
    printers: ["Universal"],
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
  },
};

const ARCH_LABEL: Record<PrinterFile["arch"], string> = {
  upper: "Upper Arch",
  lower: "Lower Arch",
  both: "Both Arches",
  full: "Full Package",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FormatBadge({ format }: { format: FileFormat }) {
  const meta = FORMAT_META[format];
  return (
    <span
      className={[
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        meta.color,
      ].join(" ")}
    >
      {meta.label}
    </span>
  );
}

function CompatibilityPills({ format }: { format: FileFormat }) {
  const { printers } = FORMAT_META[format];
  const shown = printers.filter((p) => p !== "Universal");
  if (shown.length === 0) return <span className="text-[11px] text-[color:var(--muted-foreground)]">All printers</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((p) => (
        <span
          key={p}
          className="rounded bg-[color:var(--muted)]/60 px-1.5 py-0.5 text-[10px] text-[color:var(--muted-foreground)]"
        >
          {p}
        </span>
      ))}
    </div>
  );
}

function DownloadButton({
  file,
  state,
  onDownload,
}: {
  file: PrinterFile;
  state: DownloadState[string];
  onDownload: (file: PrinterFile) => void;
}) {
  if (file.status === "generating") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[color:var(--muted-foreground)]">
        <Loader2 size={13} className="animate-spin" /> Generating…
      </span>
    );
  }

  if (file.status === "failed") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-500">
        <AlertCircle size={13} /> Failed
      </span>
    );
  }

  if (state === "done") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 size={13} /> Downloaded
      </span>
    );
  }

  return (
    <button
      onClick={() => onDownload(file)}
      disabled={state === "downloading"}
      title={`Download ${file.name}`}
      className={[
        "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
        state === "downloading"
          ? "cursor-not-allowed opacity-60 bg-[color:var(--muted)] text-[color:var(--muted-foreground)]"
          : "bg-[color:var(--primary)] text-white hover:bg-[color:var(--primary)]/90",
      ].join(" ")}
    >
      {state === "downloading" ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        <Download size={12} />
      )}
      {state === "downloading" ? "Downloading…" : "Download"}
    </button>
  );
}

function FileRow({
  file,
  dlState,
  onDownload,
}: {
  file: PrinterFile;
  dlState: DownloadState[string];
  onDownload: (file: PrinterFile) => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-[color:var(--border)] py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      {/* File info */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <FileBox
          size={18}
          className="shrink-0 text-[color:var(--muted-foreground)]"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="truncate text-sm font-medium text-[color:var(--foreground)]">
              {file.name}
            </span>
            <FormatBadge format={file.format} />
            {file.arch !== "full" && (
              <span className="text-[11px] text-[color:var(--muted-foreground)]">
                {ARCH_LABEL[file.arch]}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 flex-wrap">
            <CompatibilityPills format={file.format} />
            {file.sizeBytes && (
              <span className="text-[11px] text-[color:var(--muted-foreground)]">
                {formatBytes(file.sizeBytes)}
              </span>
            )}
            {file.generatedAt && (
              <span className="text-[11px] text-[color:var(--muted-foreground)]">
                {file.generatedAt}
              </span>
            )}
          </div>
        </div>
      </div>
      {/* Action */}
      <div className="ml-9 sm:ml-0">
        <DownloadButton file={file} state={dlState} onDownload={onDownload} />
      </div>
    </div>
  );
}

// ─── Format group ─────────────────────────────────────────────────────────────

function FormatGroup({
  format,
  files,
  dlState,
  onDownload,
}: {
  format: FileFormat;
  files: PrinterFile[];
  dlState: DownloadState;
  onDownload: (file: PrinterFile) => void;
}) {
  const meta = FORMAT_META[format];
  return (
    <Card className="overflow-hidden p-0">
      <div className={["flex items-center gap-3 border-b border-[color:var(--border)] px-4 py-3", meta.color.split(" ")[0]].join(" ")}>
        <span className={["text-xs font-bold uppercase tracking-wider", meta.color.split(" ").slice(1).join(" ")].join(" ")}>
          {meta.label}
        </span>
        <span className="text-[11px] text-[color:var(--muted-foreground)]">{meta.description}</span>
      </div>
      <div className="px-4">
        {files.map((f) => (
          <FileRow
            key={f.id}
            file={f}
            dlState={dlState[f.id] ?? "idle"}
            onDownload={onDownload}
          />
        ))}
      </div>
    </Card>
  );
}

// ─── Printer compatibility reference ─────────────────────────────────────────

function CompatibilityTable() {
  const rows: { printer: PrinterBrand; formats: FileFormat[]; note: string }[] = [
    {
      printer: "Formlabs",
      formats: ["stl", "3mf", "obj"],
      note: "PreForm slicing software (Form 3B+, Form 4B)",
    },
    {
      printer: "Stratasys",
      formats: ["stl", "3mf"],
      note: "GrabCAD Print (J5 DentaJet, Objet series)",
    },
    {
      printer: "EnvisionTEC",
      formats: ["stl"],
      note: "Envision One (direct STL import)",
    },
    {
      printer: "Carbon DLS",
      formats: ["stl"],
      note: "Carbon Design Engine",
    },
    {
      printer: "Asiga",
      formats: ["stl"],
      note: "Asiga Composer (Max UV, Pro 4K)",
    },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-[color:var(--border)] px-4 py-3">
        <h3 className="text-xs font-semibold text-[color:var(--foreground)]">
          Printer Compatibility Reference
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[color:var(--border)] bg-[color:var(--muted)]/30">
              <th className="px-4 py-2 text-left font-medium text-[color:var(--muted-foreground)]">Printer</th>
              <th className="px-4 py-2 text-left font-medium text-[color:var(--muted-foreground)]">Supported Formats</th>
              <th className="px-4 py-2 text-left font-medium text-[color:var(--muted-foreground)]">Software / Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.printer}
                className={i % 2 === 0 ? "" : "bg-[color:var(--muted)]/10"}
              >
                <td className="whitespace-nowrap px-4 py-2.5 font-medium text-[color:var(--foreground)]">
                  {row.printer}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1 flex-wrap">
                    {row.formats.map((f) => (
                      <FormatBadge key={f} format={f} />
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2.5 text-[color:var(--muted-foreground)]">
                  {row.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─── Main panel ──────────────────────────────────────────────────────────────

interface PrinterDownloadPanelProps {
  caseId: string;
  setupId?: string;
}

export default function PrinterDownloadPanel({
  caseId,
  setupId,
}: PrinterDownloadPanelProps) {
  const [files, setFiles] = useState<PrinterFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const [dlState, setDlState] = useState<DownloadState>({});

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<unknown>(`/api/cases/${caseId}/scans`);
      const items = (Array.isArray(data) ? data : []) as {
        id: string;
        jawType?: string;
        originalFilename?: string;
        fileFormat?: string;
        fileSizeBytes?: number;
        createdAt?: string;
      }[];
      const jawArchMap: Record<string, PrinterFile["arch"]> = {
        maxillary: "upper",
        mandibular: "lower",
        both: "both",
        auto: "full",
      };
      const apiFiles: PrinterFile[] = items.map((u) => {
        const rawName: string = u.originalFilename ?? "file";
        const rawFmt = (u.fileFormat ?? rawName.split(".").pop() ?? "stl").toLowerCase();
        const format: FileFormat = (["stl", "3mf", "obj", "ply", "zip"] as string[]).includes(rawFmt)
          ? (rawFmt as FileFormat)
          : "stl";
        return {
          id: u.id,
          name: rawName,
          arch: jawArchMap[u.jawType ?? ""] ?? "both",
          format,
          sizeBytes: u.fileSizeBytes,
          url: `/api/cases/${caseId}/scans/${u.id}/file`,
          generatedAt: (u.createdAt ?? "").toString().slice(0, 10),
          status: "ready",
        } satisfies PrinterFile;
      });

      if (apiFiles.length === 0) {
        setFiles([]);
        setIsDemo(true);
      } else {
        setFiles(apiFiles);
        setIsDemo(false);
      }
    } catch {
      setFiles([]);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  const handleDownload = useCallback(
    async (file: PrinterFile) => {
      if (file.url === "#") return;
      setDlState((s) => ({ ...s, [file.id]: "downloading" }));
      try {
        const res = await fetch(file.url, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("fetch-failed");
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
        setDlState((s) => ({ ...s, [file.id]: "done" }));
        setTimeout(
          () => setDlState((s) => ({ ...s, [file.id]: "idle" })),
          4000,
        );
      } catch {
        setDlState((s) => ({ ...s, [file.id]: "error" }));
      }
    },
    [],
  );

  // Group files by format
  const byFormat = (Object.keys(FORMAT_META) as FileFormat[]).reduce<
    Record<FileFormat, PrinterFile[]>
  >(
    (acc, fmt) => {
      acc[fmt] = files.filter((f) => f.format === fmt);
      return acc;
    },
    { stl: [], "3mf": [], obj: [], ply: [], zip: [] },
  );

  const activeFormats = (Object.keys(FORMAT_META) as FileFormat[]).filter(
    (f) => byFormat[f].length > 0,
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">
            Printer-Compatible Downloads
          </h2>
          <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
            All mesh formats ready for dental 3D printers — STL, 3MF, OBJ, PLY, and full ZIP package
          </p>
        </div>
        <button
          onClick={loadFiles}
          disabled={loading}
          className="flex shrink-0 items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Empty state — no export files available */}
      {isDemo && !loading && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-[color:var(--border)] px-4 py-6 text-sm text-[color:var(--muted-foreground)]">
          <Package2 size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-[color:var(--foreground)]">No export files available</p>
            <p className="mt-0.5 text-xs">
              Generate an export package first, or upload STL, 3MF, OBJ, or PLY scan files via the{" "}
              <strong>Scans</strong> tab to enable downloads.
            </p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[color:var(--muted)]/40" />
          ))}
        </div>
      )}

      {/* File groups */}
      {!loading && (
        <div className="space-y-3">
          {activeFormats.map((fmt) => (
            <FormatGroup
              key={fmt}
              format={fmt}
              files={byFormat[fmt]}
              dlState={dlState}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}

      {/* Compatibility table */}
      {!loading && <CompatibilityTable />}
    </div>
  );
}
