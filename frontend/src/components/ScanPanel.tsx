"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  FileBox,
  Loader2,
  RefreshCw,
  ScanLine,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";
import {
  listScans,
  listSegmentationJobs,
  uploadScan,
  triggerSegmentation,
  pollJobStatus,
  retrySegmentJob,
  type ScanRecord,
  type SegmentJobResult,
} from "@/lib/api/scans";
import { ApiError } from "@/lib/api/client";

// Loaded client-side only — WebGL cannot run on the server
const ScanMultiView = dynamic(() => import("@/components/ScanMultiView"), { ssr: false });

interface ViewTarget { scan: ScanRecord }

const ACCEPTED_EXTS = ".stl,.obj,.ply";
const MAX_MB = 250;
const POLL_MS = 3_000;

type JawType = "maxillary" | "mandibular" | "both";

interface ActiveJob {
  scanId: string;
  jobId: string;
  result: SegmentJobResult;
}

function fmt(bytes: number): string {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function JobChip({ result }: { result: SegmentJobResult }) {
  if (result.status === "queued")
    return <StatusBadge tone="neutral"><Clock size={10} className="mr-1 inline" />Queued</StatusBadge>;
  if (result.status === "processing")
    return <StatusBadge tone="info"><Loader2 size={10} className="mr-1 inline animate-spin" />Running</StatusBadge>;
  if (result.status === "completed")
    return (
      <div className="flex flex-col gap-0.5">
        <StatusBadge tone="success">
          <CheckCircle2 size={10} className="mr-1 inline" />Completed
        </StatusBadge>
        {result.teethDetected !== undefined && (
          <span className="text-[10px] text-[color:var(--muted-foreground)]">
            {result.teethDetected} teeth detected
          </span>
        )}
      </div>
    );
  return <StatusBadge tone="danger"><XCircle size={10} className="mr-1 inline" />Failed</StatusBadge>;
}

export default function ScanPanel({ caseId }: { caseId: string }) {
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [jawType, setJawType] = useState<JawType>("maxillary");
  const fileRef = useRef<HTMLInputElement>(null);

  const [jobs, setJobs] = useState<Record<string, ActiveJob>>({});
  const [segErrors, setSegErrors] = useState<Record<string, string>>({});
  const [viewing, setViewing] = useState<ViewTarget | null>(null);

  const loadScans = useCallback(async () => {
    setLoadError(null);
    try {
      const [scansData, persistedJobs] = await Promise.all([
        listScans(caseId),
        listSegmentationJobs(caseId).catch(() => [] as SegmentJobResult[]),
      ]);
      setScans(scansData);
      // Hydrate persisted jobs so status survives backend restart
      if (persistedJobs.length > 0) {
        setJobs((prev) => {
          const next = { ...prev };
          for (const job of persistedJobs) {
            if (job.scanId && !next[job.scanId]) {
              next[job.scanId] = { scanId: job.scanId, jobId: job.jobId, result: job };
            }
          }
          return next;
        });
      }
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Failed to load scans");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { loadScans(); }, [loadScans]);

  // Poll active segmentation jobs
  useEffect(() => {
    const active = Object.values(jobs).filter(
      (j) => j.result.status === "queued" || j.result.status === "processing",
    );
    if (active.length === 0) return;
    const timer = setInterval(async () => {
      for (const job of active) {
        try {
          const updated = await pollJobStatus(job.jobId);
          setJobs((prev) => ({
            ...prev,
            [job.scanId]: { ...prev[job.scanId], result: updated },
          }));
        } catch { /* keep polling */ }
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [jobs]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MB * 1_048_576) {
      setUploadError(`File exceeds ${MAX_MB} MB limit`);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const scan = await uploadScan(caseId, file, jawType);
      setScans((prev) => [scan, ...prev]);
    } catch (e) {
      setUploadError(e instanceof ApiError ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSegment(scanId: string) {
    setSegErrors((prev) => { const n = { ...prev }; delete n[scanId]; return n; });
    try {
      const res = await triggerSegmentation(caseId, scanId);
      setJobs((prev) => ({
        ...prev,
        [scanId]: { scanId, jobId: res.jobId, result: { jobId: res.jobId, status: "queued" } },
      }));
    } catch (e) {
      setSegErrors((prev) => ({
        ...prev,
        [scanId]: e instanceof ApiError ? e.message : "Segmentation trigger failed",
      }));
    }
  }

  async function handleRetry(scanId: string, jobId: string) {
    setSegErrors((prev) => { const n = { ...prev }; delete n[scanId]; return n; });
    try {
      const res = await retrySegmentJob(jobId);
      setJobs((prev) => ({
        ...prev,
        [scanId]: { scanId, jobId: res.jobId, result: { jobId: res.jobId, status: "queued" } },
      }));
    } catch (e) {
      setSegErrors((prev) => ({
        ...prev,
        [scanId]: e instanceof ApiError ? e.message : "Retry failed",
      }));
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload card */}
      <Card className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <UploadCloud size={15} className="text-[color:var(--primary)]" />
          <h3 className="text-sm font-semibold text-[color:var(--foreground)]">Upload Scan</h3>
        </div>

        <div className="space-y-3">
          {/* Jaw selector */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[color:var(--muted-foreground)]">Jaw:</span>
            {(["maxillary", "mandibular", "both"] as JawType[]).map((j) => (
              <button
                key={j}
                type="button"
                onClick={() => setJawType(j)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold transition-all",
                  jawType === j
                    ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                    : "border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
                ].join(" ")}
              >
                {j.charAt(0).toUpperCase() + j.slice(1)}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-[color:var(--border)] p-4 transition-colors hover:border-[color:var(--primary)]/60">
            <FileBox size={20} className="shrink-0 text-[color:var(--primary)]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[color:var(--foreground)]">
                {uploading ? "Uploading…" : "Select STL / OBJ / PLY"}
              </p>
              <p className="text-xs text-[color:var(--muted-foreground)]">Max {MAX_MB} MB per file</p>
            </div>
            {uploading && <Loader2 size={16} className="shrink-0 animate-spin text-[color:var(--primary)]" />}
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPTED_EXTS}
              className="sr-only"
              onChange={handleFile}
              disabled={uploading}
            />
          </label>

          {uploadError && (
            <p className="flex items-center gap-1.5 text-xs text-red-500">
              <XCircle size={12} className="shrink-0" /> {uploadError}
            </p>
          )}
        </div>
      </Card>

      {/* Scan list */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <FileBox size={15} className="text-[color:var(--primary)]" />
            <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
              Uploaded Scans
              {!loading && (
                <span className="ml-1.5 font-normal text-[color:var(--muted-foreground)]">({scans.length})</span>
              )}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => { setLoading(true); loadScans(); }}
            className="rounded-lg border border-[color:var(--border)] p-1.5 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
            aria-label="Refresh scan list"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 size={20} className="animate-spin text-[color:var(--muted-foreground)]" />
          </div>
        ) : loadError ? (
          <div className="px-4 py-8 text-center">
            <XCircle size={20} className="mx-auto mb-2 text-red-400" />
            <p className="text-sm text-[color:var(--muted-foreground)]">{loadError}</p>
          </div>
        ) : scans.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[color:var(--muted-foreground)]">
            No scans uploaded yet
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border)]">
            {scans.map((scan) => {
              const job = jobs[scan.id];
              const segErr = segErrors[scan.id];
              const isFailed = job?.result.status === "failed";
              const canSegment = !job;
              return (
                <div key={scan.id} className="flex items-start gap-3 px-4 py-3">
                  <FileBox size={15} className="mt-0.5 shrink-0 text-[color:var(--muted-foreground)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[color:var(--foreground)]">
                      {scan.originalFilename ?? scan.filePath.split("/").pop()}
                    </p>
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      {scan.jawType} · {scan.fileFormat.toUpperCase()} · {fmt(scan.fileSizeBytes)}
                    </p>
                    {job && <div className="mt-1.5"><JobChip result={job.result} /></div>}
                    {segErr && <p className="mt-1 text-xs text-red-500">{segErr}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setViewing({ scan })}
                      title="View in 6-view 3D layout"
                    >
                      <ScanLine size={12} /> View 3D
                    </Button>
                    {canSegment && (
                      <Button variant="secondary" size="sm" onClick={() => handleSegment(scan.id)}>
                        <Cpu size={12} /> Segment
                      </Button>
                    )}
                    {isFailed && job && (
                      <Button variant="secondary" size="sm" onClick={() => handleRetry(scan.id, job.jobId)}>
                        <RefreshCw size={12} /> Retry
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
        AI segmentation is a workflow tool only. Output is not clinically validated and must be
        reviewed by a licensed clinician before any clinical decision.
      </div>

      {/* 6-view 3D viewer modal */}
      {viewing && (
        <ScanMultiView
          caseId={caseId}
          scanId={viewing.scan.id}
          filename={viewing.scan.originalFilename ?? viewing.scan.filePath.split("/").pop() ?? "scan"}
          jawType={viewing.scan.jawType}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
