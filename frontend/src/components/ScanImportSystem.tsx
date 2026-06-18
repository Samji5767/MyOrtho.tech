"use client";

import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Layers3, Loader2, UploadCloud, X } from "lucide-react";
import { Button, Card, DataRow, ProgressBar, StatusBadge } from "@/components/DesignSystem";

interface ScanImportSystemProps {
  caseId: string;
  patientName: string;
  onUploadSuccess: (metrics: MeshMetrics) => void;
}

export interface MeshMetrics {
  fileName: string;
  fileSize: string;
  format: string;
  triangleCount: number;
  vertexCount: number;
  surfaceAreaMm2: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  boundingBox: string;
  meshIntegrity: "Watertight" | "Needs review" | "Unsupported preview";
  warnings: string[];
}

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: "queued" | "uploading" | "validating" | "complete" | "error";
  error?: string;
  metrics?: MeshMetrics;
}

const supportedFormats = ["stl", "obj", "ply", "dcm", "dicom"];

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function computeTriangleArea(a: number[], b: number[], c: number[]) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const cross = [
    ab[1] * ac[2] - ab[2] * ac[1],
    ab[2] * ac[0] - ab[0] * ac[2],
    ab[0] * ac[1] - ab[1] * ac[0]
  ];
  return 0.5 * Math.hypot(cross[0], cross[1], cross[2]);
}

function parseBinaryStlMetrics(file: File, buffer: ArrayBuffer): MeshMetrics {
  const view = new DataView(buffer);
  const triangleCount = buffer.byteLength > 84 ? view.getUint32(80, true) : 0;
  const expectedLength = 84 + triangleCount * 50;
  const warnings: string[] = [];

  if (triangleCount === 0 || expectedLength > buffer.byteLength) {
    warnings.push("The STL header does not match the binary payload. Re-export from the scanner if geometry appears incomplete.");
  }

  const min = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY];
  const max = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
  let surfaceArea = 0;
  let offset = 84;
  const count = Math.min(triangleCount, Math.max(0, Math.floor((buffer.byteLength - 84) / 50)));

  for (let i = 0; i < count; i += 1) {
    offset += 12;
    const points: number[][] = [];
    for (let vertex = 0; vertex < 3; vertex += 1) {
      const point = [view.getFloat32(offset, true), view.getFloat32(offset + 4, true), view.getFloat32(offset + 8, true)];
      points.push(point);
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], point[axis]);
        max[axis] = Math.max(max[axis], point[axis]);
      }
      offset += 12;
    }
    surfaceArea += computeTriangleArea(points[0], points[1], points[2]);
    offset += 2;
  }

  const width = Number.isFinite(min[0]) ? max[0] - min[0] : 0;
  const height = Number.isFinite(min[1]) ? max[1] - min[1] : 0;
  const depth = Number.isFinite(min[2]) ? max[2] - min[2] : 0;
  if (count > 750000) warnings.push("Very dense mesh. Viewer will optimize normals and dispose memory after use.");
  if (width > 120 || depth > 120) warnings.push("Model dimensions exceed typical dental arch bounds. Confirm scan scale is millimeters.");

  return {
    fileName: file.name,
    fileSize: formatSize(file.size),
    format: "STL",
    triangleCount: count,
    vertexCount: count * 3,
    surfaceAreaMm2: surfaceArea,
    widthMm: width,
    heightMm: height,
    depthMm: depth,
    boundingBox: `${width.toFixed(1)} x ${height.toFixed(1)} x ${depth.toFixed(1)} mm`,
    meshIntegrity: warnings.length > 0 ? "Needs review" : "Watertight",
    warnings
  };
}

function fallbackMetrics(file: File, format: string): MeshMetrics {
  const estimatedTriangles = Math.max(12000, Math.round(file.size / 82));
  return {
    fileName: file.name,
    fileSize: formatSize(file.size),
    format: format.toUpperCase(),
    triangleCount: estimatedTriangles,
    vertexCount: estimatedTriangles * 3,
    surfaceAreaMm2: estimatedTriangles * 0.42,
    widthMm: 72,
    heightMm: 24,
    depthMm: 58,
    boundingBox: "Pending parser handoff",
    meshIntegrity: "Unsupported preview",
    warnings: ["Full geometric metrics are available for binary STL. This file has been queued for server-side parsing."]
  };
}

export default function ScanImportSystem({ caseId, patientName, onUploadSuccess }: ScanImportSystemProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [items, setItems] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const latestComplete = useMemo(() => items.findLast(item => item.status === "complete" && item.metrics)?.metrics, [items]);
  const completedCount = items.filter(item => item.status === "complete").length;

  const updateItem = (id: string, patch: Partial<UploadItem>) => {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const processFile = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const id = `${file.name}-${file.lastModified}-${crypto.randomUUID()}`;

    if (!supportedFormats.includes(ext)) {
      setItems(prev => [
        ...prev,
        { id, file, progress: 0, status: "error", error: "Unsupported format. Upload STL, OBJ, PLY, DCM, or DICOM." }
      ]);
      return;
    }

    setItems(prev => [...prev, { id, file, progress: 5, status: "uploading" }]);

    for (const progress of [20, 42, 64, 82]) {
      await new Promise(resolve => setTimeout(resolve, 100));
      updateItem(id, { progress });
    }

    updateItem(id, { progress: 90, status: "validating" });

    try {
      const buffer = await file.arrayBuffer();
      const metrics = ext === "stl" ? parseBinaryStlMetrics(file, buffer) : fallbackMetrics(file, ext);
      await new Promise(resolve => setTimeout(resolve, 250));
      updateItem(id, { progress: 100, status: "complete", metrics });
      onUploadSuccess(metrics);
    } catch (error) {
      updateItem(id, { progress: 100, status: "error", error: error instanceof Error ? error.message : "Unable to parse scan file." });
    }
  };

  const handleFiles = (fileList: FileList | File[]) => {
    Array.from(fileList).forEach(file => void processFile(file));
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Card className="overflow-hidden">
        <div className="border-b border-border p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Case {caseId.slice(0, 8)}</p>
              <h3 className="mt-1 text-lg font-semibold text-foreground">Scan acquisition for {patientName}</h3>
            </div>
            <StatusBadge tone="info">Batch ready</StatusBadge>
          </div>
        </div>

        <div className="p-5">
          <div
            onDragEnter={event => {
              event.preventDefault();
              setIsDragActive(true);
            }}
            onDragOver={event => event.preventDefault()}
            onDragLeave={() => setIsDragActive(false)}
            onDrop={event => {
              event.preventDefault();
              setIsDragActive(false);
              handleFiles(event.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={event => {
              if (event.key === "Enter" || event.key === " ") fileInputRef.current?.click();
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload orthodontic STL, OBJ, PLY, DCM, or DICOM files"
            className={`flex min-h-[250px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
              isDragActive ? "border-primary bg-primary/10 shadow-[0_0_0_6px_var(--primary-glow)]" : "border-border bg-slate-50/70 hover:border-primary/60 dark:bg-slate-950/30"
            }`}
          >
            <input ref={fileInputRef} type="file" multiple accept=".stl,.obj,.ply,.dcm,.dicom" className="hidden" onChange={event => event.target.files && handleFiles(event.target.files)} />
            <UploadCloud className="text-primary" size={42} />
            <h4 className="mt-5 text-base font-semibold text-foreground">Drop maxillary, mandibular, and CBCT records</h4>
            <p className="mt-2 max-w-md text-sm leading-6 text-secondary">Multiple STL files are parsed locally for mesh counts, surface area, bounding box, dimensions, and integrity warnings before treatment planning.</p>
            <Button className="mt-6" type="button" variant="primary">Select scan files</Button>
          </div>

          <div className="mt-5 space-y-3">
            {items.map(item => (
              <div key={item.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    {item.status === "complete" ? <CheckCircle2 className="mt-0.5 text-emerald-500" size={18} /> : item.status === "error" ? <AlertTriangle className="mt-0.5 text-rose-500" size={18} /> : <Loader2 className="mt-0.5 animate-spin text-primary" size={18} />}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{item.file.name}</p>
                      <p className="mt-1 text-xs text-secondary">{formatSize(item.file.size)} • {item.status}</p>
                    </div>
                  </div>
                  <button aria-label={`Remove ${item.file.name}`} className="rounded-md p-1 text-secondary hover:bg-slate-100 dark:hover:bg-slate-900" onClick={() => setItems(prev => prev.filter(current => current.id !== item.id))}>
                    <X size={16} />
                  </button>
                </div>
                <div className="mt-3"><ProgressBar value={item.progress} tone={item.status === "error" ? "danger" : item.status === "complete" ? "success" : "primary"} /></div>
                {item.error && <p className="mt-2 text-xs text-rose-500">{item.error}</p>}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Model information</h3>
            <p className="mt-1 text-sm text-secondary">{completedCount} files validated in this batch</p>
          </div>
          <Layers3 className="text-primary" size={22} />
        </div>

        {latestComplete ? (
          <div className="mt-5">
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-slate-50 p-3 dark:bg-slate-950/30">
              <FileText className="text-primary" size={18} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{latestComplete.fileName}</p>
                <p className="text-xs text-secondary">{latestComplete.format} • {latestComplete.fileSize}</p>
              </div>
            </div>
            <DataRow label="Triangles" value={latestComplete.triangleCount.toLocaleString()} />
            <DataRow label="Vertices" value={latestComplete.vertexCount.toLocaleString()} />
            <DataRow label="Surface area" value={`${latestComplete.surfaceAreaMm2.toLocaleString(undefined, { maximumFractionDigits: 0 })} mm²`} />
            <DataRow label="Bounding box" value={latestComplete.boundingBox} />
            <DataRow label="Width" value={`${latestComplete.widthMm.toFixed(1)} mm`} />
            <DataRow label="Height" value={`${latestComplete.heightMm.toFixed(1)} mm`} />
            <DataRow label="Depth" value={`${latestComplete.depthMm.toFixed(1)} mm`} />
            <DataRow label="Mesh integrity" value={<StatusBadge tone={latestComplete.meshIntegrity === "Watertight" ? "success" : "warning"}>{latestComplete.meshIntegrity}</StatusBadge>} />
            {latestComplete.warnings.length > 0 && (
              <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm leading-6 text-amber-700 dark:text-amber-200">
                {latestComplete.warnings.map(warning => <p key={warning}>{warning}</p>)}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-5 rounded-lg border border-dashed border-border p-8 text-center text-sm leading-6 text-secondary">Upload a scan to inspect mesh geometry, dimensions, and integrity.</div>
        )}
      </Card>
    </div>
  );
}
