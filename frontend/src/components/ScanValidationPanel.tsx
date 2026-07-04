'use client';

import { useCallback, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  Upload,
  XCircle,
} from 'lucide-react';
import { Button, Card, ProgressBar, StatusBadge } from '@/components/DesignSystem';
import { api, uploadFile } from '@/lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type ArchType = 'upper' | 'lower' | 'bite';

interface UploadRecord {
  id: string;
  fileName: string;
  archType: ArchType;
  fileSizeBytes?: number;
  status?: string;
}

interface ValidationCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

interface ValidationResult {
  id: string;
  uploadId: string;
  qualityScore: number;
  confidence: number;
  watertight: boolean;
  normalsConsistent: boolean;
  noNonManifoldEdges: boolean;
  noSelfIntersections: boolean;
  vertexCount: number;
  faceCount: number;
  issues: Array<{ severity: 'error' | 'warning' | 'info'; message: string }>;
  autoFixSuggestions: string[];
  overallStatus: 'pass' | 'warn' | 'fail';
  message?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function qualityColor(score: number): string {
  if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function qualityRingColor(score: number): string {
  if (score >= 80) return 'var(--clinical-safe)';
  if (score >= 50) return 'var(--clinical-warn)';
  return 'var(--clinical-danger)';
}

function qualityTone(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateVertices(fileSizeBytes: number): number {
  return Math.max(1000, Math.round(fileSizeBytes / 300));
}

// ─── Quality Score Circle ──────────────────────────────────────────────────────

function QualityScoreCircle({ score }: { score: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const dash = (score / 100) * circumference;
  const color = qualityRingColor(score);

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={110} height={110} className="-rotate-90">
        <circle
          cx={55}
          cy={55}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={10}
          className="text-slate-100 dark:text-slate-800"
        />
        <circle
          cx={55}
          cy={55}
          r={radius}
          fill="none"
          strokeWidth={10}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          style={{ stroke: color, transition: 'stroke-dasharray 0.6s ease' }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-bold tabular-nums ${qualityColor(score)}`}>
          {score}
        </span>
        <span className="text-xs text-secondary">/ 100</span>
      </div>
    </div>
  );
}

// ─── Check Item ───────────────────────────────────────────────────────────────

function CheckItem({ check }: { check: ValidationCheck }) {
  return (
    <div className="flex items-start gap-2">
      {check.passed ? (
        <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <XCircle size={15} className="text-rose-500 shrink-0 mt-0.5" />
      )}
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{check.name}</p>
        {check.detail && (
          <p className="text-[11px] text-secondary">{check.detail}</p>
        )}
      </div>
    </div>
  );
}

// ─── Issue Row ────────────────────────────────────────────────────────────────

function IssueRow({ issue }: { issue: ValidationResult['issues'][number] }) {
  const tone = issue.severity === 'error' ? 'danger' : issue.severity === 'warning' ? 'warning' : 'info';
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border last:border-b-0">
      <StatusBadge tone={tone}>
        {issue.severity}
      </StatusBadge>
      <p className="text-xs text-foreground">{issue.message}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScanValidationPanel({
  uploadId: initialUploadId,
  caseId,
  onComplete,
}: {
  uploadId?: string;
  caseId: string;
  onComplete?: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [archType, setArchType] = useState<ArchType>('upper');

  const [uploadRecord, setUploadRecord] = useState<UploadRecord | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // ── File select ────────────────────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setUploadRecord(null);
    setValidationResult(null);
    setUploadError(null);
    setValidationError(null);
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('fileName', file.name);
      form.append('archType', archType);

      const record = await uploadFile<UploadRecord>('/api/stl/uploads', form);
      setUploadRecord(record);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [file, archType]);

  // ── Validate ───────────────────────────────────────────────────────────────

  const handleValidate = useCallback(async () => {
    const id = uploadRecord?.id ?? initialUploadId;
    if (!id) return;
    setValidating(true);
    setValidationError(null);
    try {
      const fileSizeBytes = file?.size ?? 0;
      const vertexCount = estimateVertices(fileSizeBytes);
      const faceCount = Math.round(vertexCount * 2);

      const result = await api.post<ValidationResult>(`/api/stl/uploads/${id}/validate`, {
        vertexCount,
        faceCount,
        archType,
      });
      setValidationResult(result);
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  }, [uploadRecord, initialUploadId, file, archType]);

  // ── Validation checks list ─────────────────────────────────────────────────

  function buildChecks(v: ValidationResult): ValidationCheck[] {
    return [
      { name: 'Watertight Mesh', passed: v.watertight, detail: v.watertight ? 'No open boundaries detected' : 'Open boundaries found' },
      { name: 'Consistent Normals', passed: v.normalsConsistent, detail: v.normalsConsistent ? 'All face normals outward-facing' : 'Normal inconsistencies detected' },
      { name: 'No Non-Manifold Edges', passed: v.noNonManifoldEdges, detail: v.noNonManifoldEdges ? 'Clean edge topology' : 'Non-manifold edges present' },
      { name: 'No Self-Intersections', passed: v.noSelfIntersections, detail: v.noSelfIntersections ? 'Geometry is clean' : 'Mesh self-intersects' },
      { name: 'Vertex Count Valid', passed: v.vertexCount > 0, detail: `${v.vertexCount.toLocaleString()} vertices` },
      { name: 'Face Count Valid', passed: v.faceCount > 0, detail: `${v.faceCount.toLocaleString()} faces` },
    ];
  }

  const activeUploadId = uploadRecord?.id ?? initialUploadId;

  return (
    <div className="space-y-5">
      {/* Upload Section */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-primary" />
          <h3 className="text-sm font-semibold text-foreground">STL Scan Upload</h3>
        </div>

        {/* Arch type */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-secondary w-20 shrink-0">Arch Type</label>
          <div className="flex gap-2">
            {(['upper', 'lower', 'bite'] as ArchType[]).map((a) => (
              <button
                key={a}
                onClick={() => setArchType(a)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  archType === a
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-secondary hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Drop zone */}
        <div
          className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-all"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="p-3 rounded-full bg-slate-100 dark:bg-slate-800">
            <Upload size={20} className="text-secondary" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Click to select STL file</p>
            <p className="text-xs text-secondary mt-0.5">Supports .stl files (binary or ASCII)</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".stl"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* File info */}
        {file && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border">
            <FileText size={18} className="text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
              <p className="text-xs text-secondary">{formatBytes(file.size)}</p>
            </div>
            {!uploadRecord && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleUpload()}
                disabled={uploading}
              >
                {uploading ? <><Loader2 size={13} className="animate-spin" /> Uploading…</> : 'Upload'}
              </Button>
            )}
            {uploadRecord && (
              <StatusBadge tone="success">Uploaded</StatusBadge>
            )}
          </div>
        )}

        {uploadError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <AlertTriangle size={12} /> {uploadError}
          </p>
        )}

        {/* Validate button */}
        {activeUploadId && !validationResult && (
          <Button
            variant="primary"
            onClick={() => void handleValidate()}
            disabled={validating}
            className="w-full"
          >
            {validating ? (
              <><Loader2 size={14} className="animate-spin" /> Running AI Validation…</>
            ) : (
              <>Run Scan Validation</>
            )}
          </Button>
        )}

        {validationError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <AlertTriangle size={12} /> {validationError}
          </p>
        )}
      </Card>

      {/* Validation Results */}
      {validationResult && (
        <>
          {/* Score + Confidence */}
          <Card className="p-5">
            <div className="flex items-start gap-6">
              {/* Circle */}
              <div className="relative flex items-center justify-center" style={{ width: 110, height: 110 }}>
                <QualityScoreCircle score={validationResult.qualityScore} />
              </div>

              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-secondary">Scan Quality Score</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-2xl font-bold ${qualityColor(validationResult.qualityScore)}`}>
                      {validationResult.qualityScore}/100
                    </span>
                    <StatusBadge tone={qualityTone(validationResult.qualityScore)}>
                      {validationResult.overallStatus === 'pass' ? 'Pass' : validationResult.overallStatus === 'warn' ? 'Caution' : 'Fail'}
                    </StatusBadge>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-secondary">AI Confidence</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {Math.round(validationResult.confidence * 100)}%
                    </span>
                  </div>
                  <ProgressBar
                    value={Math.round(validationResult.confidence * 100)}
                    tone={validationResult.confidence > 0.8 ? 'success' : validationResult.confidence > 0.5 ? 'warning' : 'danger'}
                  />
                </div>

                {validationResult.message && (
                  <p className="text-xs text-secondary">{validationResult.message}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Checks Grid */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4">Mesh Integrity Checks</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {buildChecks(validationResult).map((check) => (
                <CheckItem key={check.name} check={check} />
              ))}
            </div>
          </Card>

          {/* Auto-fix Suggestions */}
          {validationResult.autoFixSuggestions.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" />
                Auto-Fix Suggestions
              </h3>
              <ul className="space-y-2">
                {validationResult.autoFixSuggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shrink-0">
                      FIX
                    </span>
                    <p className="text-xs text-foreground">{s}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {/* Issues */}
          {validationResult.issues.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">Issues Detected</h3>
              <div>
                {validationResult.issues.map((issue, i) => (
                  <IssueRow key={i} issue={issue} />
                ))}
              </div>
            </Card>
          )}

          {/* Advance Button */}
          {validationResult.overallStatus !== 'fail' && (
            <Button variant="primary" className="w-full" onClick={onComplete}>
              Process Scan <ChevronRight size={16} />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
