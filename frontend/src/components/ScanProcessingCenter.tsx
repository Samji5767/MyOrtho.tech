"use client";

import { useCallback, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  FileText,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  ScanLine,
  Upload,
  UploadCloud,
  Wifi,
  X,
  Zap,
} from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import type { ScanItem, ScanStatus } from "@/types/orthodontic";

// ─── Mock scan queue ──────────────────────────────────────────────────────────

const MOCK_SCANS: ScanItem[] = [];

const SCANNER_INTEGRATIONS = [
  { name: "iTero",          logo: "iT", color: "bg-blue-500",    status: "connected", protocol: "iTero API" },
  { name: "Medit",          logo: "Md", color: "bg-teal-600",    status: "connected", protocol: "Medit Link" },
  { name: "3Shape TRIOS",   logo: "3S", color: "bg-violet-600",  status: "available", protocol: "TRIOS API" },
  { name: "Carestream",     logo: "CS", color: "bg-amber-600",   status: "available", protocol: "CS Connect" },
  { name: "Shining3D",      logo: "SH", color: "bg-rose-500",    status: "available", protocol: "Shining API" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ScanStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  queued:       { label: "Queued",        color: "text-slate-500",   bg: "bg-slate-500/10",    icon: CircleDot },
  uploading:    { label: "Uploading",     color: "text-sky-600",     bg: "bg-sky-500/10",      icon: UploadCloud },
  validating:   { label: "Validating",    color: "text-amber-600",   bg: "bg-amber-500/10",    icon: Loader2 },
  processing:   { label: "AI Processing", color: "text-violet-600",  bg: "bg-violet-500/10",   icon: Zap },
  complete:     { label: "Complete",      color: "text-emerald-600", bg: "bg-emerald-500/10",  icon: CheckCircle2 },
  error:        { label: "Error",         color: "text-rose-600",    bg: "bg-rose-500/10",     icon: X },
  review_needed:{ label: "Review Needed", color: "text-orange-600",  bg: "bg-orange-500/10",   icon: AlertTriangle },
};

const QUALITY_CONFIG: Record<string, { label: string; color: string }> = {
  excellent: { label: "Excellent", color: "text-emerald-600" },
  good:      { label: "Good",      color: "text-teal-600" },
  fair:      { label: "Fair",      color: "text-amber-600" },
  poor:      { label: "Poor",      color: "text-orange-600" },
  invalid:   { label: "Invalid",   color: "text-rose-600" },
};

function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${(bytes / 1_000).toFixed(0)} KB`;
}

// ─── Scan row ─────────────────────────────────────────────────────────────────

function ScanRow({ scan }: { scan: ScanItem }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CONFIG[scan.status];
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        {/* Format icon */}
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
          <Layers3 size={16} />
        </span>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs font-bold text-[color:var(--primary)]">{scan.caseId}</span>
            <span className="truncate text-sm font-semibold text-[color:var(--foreground)]">{scan.patientName}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="truncate text-xs text-[color:var(--muted-foreground)]">{scan.fileName}</span>
            <span className="text-[10px] text-[color:var(--muted-foreground)]">·</span>
            <span className="text-xs text-[color:var(--muted-foreground)]">{formatFileSize(scan.fileSize)}</span>
            <span className="text-[10px] text-[color:var(--muted-foreground)]">·</span>
            <span className="rounded-md border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--muted-foreground)] uppercase">{scan.format}</span>
            <span className="text-xs text-[color:var(--muted-foreground)]">{scan.source}</span>
          </div>
        </div>

        {/* Status */}
        <div className="shrink-0 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${cfg.bg} ${cfg.color}`}>
            <Icon size={11} className={scan.status === "processing" || scan.status === "validating" ? "animate-spin" : ""} />
            {cfg.label}
          </span>
          {expanded ? <ChevronUp size={16} className="text-[color:var(--muted-foreground)]" /> : <ChevronDown size={16} className="text-[color:var(--muted-foreground)]" />}
        </div>
      </button>

      {/* Progress bar for active statuses */}
      {(scan.status === "uploading" || scan.status === "processing" || scan.status === "validating") && (
        <div className="px-4 pb-2">
          <div className="h-1 rounded-full bg-[color:var(--border)]">
            <div className="h-full rounded-full bg-[color:var(--primary)] transition-all" style={{ width: `${scan.progress}%` }} />
          </div>
        </div>
      )}

      {/* Expanded validation details */}
      {expanded && scan.validation && (
        <div className="border-t border-[color:var(--border)] px-4 py-4">
          {/* Mesh metrics grid */}
          <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
            {[
              { label: "Triangles",    value: scan.validation.triangleCount.toLocaleString() },
              { label: "Vertices",     value: scan.validation.vertexCount.toLocaleString() },
              { label: "Surface Area", value: `${scan.validation.surfaceAreaMm2.toLocaleString()} mm²` },
              { label: "Quality",      value: <span className={QUALITY_CONFIG[scan.validation.qualityScore].color + " font-bold"}>{QUALITY_CONFIG[scan.validation.qualityScore].label}</span> },
              { label: "Width",        value: `${scan.validation.widthMm} mm` },
              { label: "Height",       value: `${scan.validation.heightMm} mm` },
              { label: "Depth",        value: `${scan.validation.depthMm} mm` },
              { label: "Watertight",   value: scan.validation.isWatertight ? <span className="text-emerald-600 font-bold">Yes</span> : <span className="text-rose-500 font-bold">No</span> },
              { label: "Mesh Holes",   value: scan.validation.holeCount },
              { label: "Non-manifold", value: scan.validation.nonManifoldEdges },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-2.5">
                <p className="text-[10px] font-semibold text-[color:var(--muted-foreground)]">{label}</p>
                <p className="mt-1 text-sm font-bold text-[color:var(--foreground)]">{value}</p>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {scan.validation.warnings.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {scan.validation.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/60 px-3 py-2 dark:border-amber-700/40 dark:bg-amber-900/10">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">{w}</p>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {scan.status === "review_needed" && (
              <>
                <button type="button" className="flex items-center gap-1.5 rounded-xl bg-[color:var(--primary)] px-3 py-2 text-xs font-bold text-white">
                  <CheckCircle2 size={13} /> Approve & Queue AI
                </button>
                <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-xs font-bold text-[color:var(--foreground)]">
                  <ScanLine size={13} /> Re-upload Scan
                </button>
              </>
            )}
            {scan.status === "complete" && (
              <button type="button" className="flex items-center gap-1.5 rounded-xl bg-violet-500 px-3 py-2 text-xs font-bold text-white">
                <Zap size={13} /> Start AI Segmentation
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Upload dropzone ──────────────────────────────────────────────────────────

function UploadDropzone({ onFile }: { onFile: (f: File) => void }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-8 cursor-pointer transition-all ${dragging ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]" : "border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--primary)]/50"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".stl,.ply,.obj,.dcm"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
        <UploadCloud size={24} />
      </div>
      <div className="text-center">
        <p className="font-bold text-[color:var(--foreground)]">Drop scan files here</p>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">STL · PLY · OBJ · DCM · CBCT</p>
      </div>
      <button type="button" className="rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-sm font-bold text-white shadow-sm">
        Browse Files
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScanProcessingCenter() {
  const [scans, setScans] = useState<ScanItem[]>(MOCK_SCANS);
  const [filter, setFilter] = useState<ScanStatus | "all">("all");

  const filtered = filter === "all" ? scans : scans.filter(s => s.status === filter);
  const pendingCount = scans.filter(s => s.status === "review_needed" || s.status === "validating").length;
  const processingCount = scans.filter(s => s.status === "processing" || s.status === "uploading").length;
  const completeCount = scans.filter(s => s.status === "complete").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Scan Processing Center</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Scan Intake & Validation</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Manage STL, PLY, OBJ, and CBCT imports with automated mesh quality analysis.</p>
        </div>
        <button type="button" className="flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm">
          <Plus size={16} /> Import Scan
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Scans",   value: scans.length,    color: "text-[color:var(--foreground)]",  bg: "bg-[color:var(--card)]" },
          { label: "Processing",    value: processingCount, color: "text-violet-600", bg: "bg-violet-500/10" },
          { label: "Review Needed", value: pendingCount,    color: "text-amber-600",  bg: "bg-amber-500/10" },
          { label: "Validated",     value: completeCount,   color: "text-emerald-600",bg: "bg-emerald-500/10" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border border-[color:var(--border)] p-4 ${s.bg}`}>
            <p className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
            <p className="mt-1 text-xs font-semibold text-[color:var(--muted-foreground)]">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Upload dropzone */}
      <UploadDropzone onFile={(f) => console.log("File dropped:", f.name)} />

      {/* Scanner integrations */}
      <div className="ios-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wifi size={15} className="text-[color:var(--primary)]" />
          <h3 className="font-bold text-[color:var(--foreground)]">Scanner Integrations</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {SCANNER_INTEGRATIONS.map((s) => (
            <div key={s.name} className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-black text-white ${s.color}`}>{s.logo}</span>
              <div>
                <p className="text-xs font-bold text-[color:var(--foreground)]">{s.name}</p>
                <p className="text-[10px] text-[color:var(--muted-foreground)]">{s.status === "connected" ? "✓ Connected" : "Available"}</p>
              </div>
              <button type="button" className={`ml-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${s.status === "connected" ? "bg-emerald-500/10 text-emerald-600" : "bg-[color:var(--primary-glow)] text-[color:var(--primary)]"}`}>
                {s.status === "connected" ? "Active" : "Connect"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {(["all", "review_needed", "processing", "validating", "complete", "error"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${filter === key ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
          >
            {key === "all" ? "All scans" : STATUS_CONFIG[key].label}
          </button>
        ))}
      </div>

      {/* Scan queue */}
      <div className="space-y-3">
        {filtered.map((scan) => (
          <ScanRow key={scan.id} scan={scan} />
        ))}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <ScanLine size={28} className="text-[color:var(--muted-foreground)]" />
            <p className="text-sm font-semibold text-[color:var(--foreground)]">No scans in this filter</p>
          </div>
        )}
      </div>

      <MedicalDisclaimer variant="inline" />
    </div>
  );
}

export default ScanProcessingCenter;
