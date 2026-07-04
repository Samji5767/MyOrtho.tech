"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Wrench,
  Star,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExcessiveMovement {
  tooth: string;
  movement: string;
  value: number;
  limit: number;
  unit: string;
}

interface CollisionIssue {
  toothPair: string;
  description: string;
}

interface PDLWarning {
  tooth: string;
  stressPct: number;
  severity: "low" | "moderate" | "high";
}

interface AttachmentWarning {
  tooth: string;
  issue: string;
}

interface IPRWarning {
  contact: string;
  excessMm: number;
}

interface StagingIssue {
  stage: number;
  issue: string;
}

interface QAResult {
  setupId: string;
  scores: {
    treatmentQuality: number;
    clinicalSafety: number;
    manufacturing: number;
    overall: number;
  };
  export_ready: boolean;
  issues: {
    excessiveMovements: ExcessiveMovement[];
    collisions: CollisionIssue[];
    pdlWarnings: PDLWarning[];
    attachmentWarnings: AttachmentWarning[];
    iprWarnings: IPRWarning[];
    stagingIssues: StagingIssue[];
  };
  warnings: string[];
  checkedAt: string;
}

// ─── SVG Gauge ────────────────────────────────────────────────────────────────

function ScoreGauge({
  score,
  label,
  size = 96,
  icon: Icon,
}: {
  score: number;
  label: string;
  size?: number;
  icon?: React.ElementType;
}) {
  const r = (size / 2) * 0.78;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (score / 100) * circumference;
  const gap = circumference - dash;

  const color =
    score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  const bgColor =
    score >= 80 ? "#dcfce7" : score >= 60 ? "#fef3c7" : "#fee2e2";

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ width: size, height: size, position: "relative" }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="var(--border)"
            strokeWidth={size * 0.1}
          />
          {/* Fill */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={size * 0.1}
            strokeDasharray={`${dash} ${gap}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        {/* Center text */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0,
          }}
        >
          {Icon && <Icon size={size * 0.15} color={color} />}
          <span
            style={{
              fontSize: size * 0.22,
              fontWeight: 700,
              color,
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {Math.round(score)}
          </span>
        </div>
      </div>
      <span
        className="text-center text-xs font-semibold"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "danger" | "warning" | "neutral";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const toneClasses = {
    danger: "bg-red-100 text-red-700",
    warning: "bg-amber-100 text-amber-700",
    neutral: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-[color:var(--muted)] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[color:var(--foreground)]">
            {title}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${toneClasses[tone]}`}
          >
            {count}
          </span>
        </div>
        {open ? (
          <ChevronDown size={15} className="text-[color:var(--muted-foreground)]" />
        ) : (
          <ChevronRight size={15} className="text-[color:var(--muted-foreground)]" />
        )}
      </button>
      {open && count > 0 && (
        <div className="border-t border-[color:var(--border)] p-4">{children}</div>
      )}
      {open && count === 0 && (
        <div className="border-t border-[color:var(--border)] px-4 py-3 text-xs text-[color:var(--muted-foreground)]">
          No issues found
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function QAReportPanel({
  setupId,
}: {
  setupId?: string;
}) {
  const [data, setData] = useState<QAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (!setupId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/treatment-qa/${setupId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [setupId]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const runQA = async () => {
    if (!setupId) return;
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/treatment-qa/${setupId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
    }
  };

  if (!setupId) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <ShieldCheck size={40} className="text-[color:var(--muted-foreground)]" />
        <p className="text-sm text-[color:var(--muted-foreground)]">
          No setup selected. Create or select a digital setup to run QA.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header action */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-[color:var(--foreground)]">
          QA Report
        </h2>
        <button
          type="button"
          onClick={runQA}
          disabled={running || loading}
          className="inline-flex items-center gap-2 rounded-lg bg-[color:var(--primary)] px-4 py-2 text-xs font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
        >
          <RefreshCw size={13} className={running ? "animate-spin" : ""} />
          {running ? "Running QA…" : "Run QA Check"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-[color:var(--muted)]" />
          ))}
        </div>
      )}

      {!loading && data && (
        <>
          {/* Score dashboard */}
          <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
              Score Dashboard
            </h3>
            <div className="flex flex-wrap items-center justify-around gap-4">
              <ScoreGauge
                score={data.scores.treatmentQuality}
                label="Treatment Quality"
                size={90}
                icon={Star}
              />
              <ScoreGauge
                score={data.scores.overall}
                label="Overall"
                size={120}
                icon={ShieldCheck}
              />
              <ScoreGauge
                score={data.scores.clinicalSafety}
                label="Clinical Safety"
                size={90}
                icon={ShieldCheck}
              />
              <ScoreGauge
                score={data.scores.manufacturing}
                label="Manufacturing"
                size={90}
                icon={Wrench}
              />
            </div>
          </div>

          {/* Export Readiness banner */}
          {data.export_ready ? (
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <CheckCircle2 size={18} className="shrink-0 text-green-600" />
              <span className="text-sm font-semibold text-green-700">
                Ready for Export
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <XCircle size={18} className="shrink-0 text-red-600" />
              <span className="text-sm font-semibold text-red-700">
                Not Ready — Issues Must Be Resolved
              </span>
            </div>
          )}

          {/* Issues sections */}
          <div className="space-y-2">
            <Section
              title="Excessive Movements"
              count={data.issues.excessiveMovements.length}
              tone="danger"
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-xs">
                  <thead>
                    <tr className="border-b border-[color:var(--border)]">
                      <th className="pb-2 text-left font-semibold text-[color:var(--muted-foreground)]">Tooth</th>
                      <th className="pb-2 text-left font-semibold text-[color:var(--muted-foreground)]">Movement</th>
                      <th className="pb-2 text-right font-semibold text-[color:var(--muted-foreground)]">Value</th>
                      <th className="pb-2 text-right font-semibold text-[color:var(--muted-foreground)]">Limit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--border)]">
                    {data.issues.excessiveMovements.map((m) => (
                      <tr key={`${m.tooth}-${m.movement}`}>
                        <td className="py-2 font-mono">{m.tooth}</td>
                        <td className="py-2">{m.movement}</td>
                        <td className="py-2 text-right font-mono text-red-600">
                          {m.value} {m.unit}
                        </td>
                        <td className="py-2 text-right font-mono text-[color:var(--muted-foreground)]">
                          {m.limit} {m.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              title="Collision Issues"
              count={data.issues.collisions.length}
              tone="danger"
            >
              <ul className="space-y-2">
                {data.issues.collisions.map((c) => (
                  <li
                    key={`${c.toothPair}-${c.description}`}
                    className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2"
                  >
                    <XCircle size={13} className="mt-0.5 shrink-0 text-red-500" />
                    <div>
                      <span className="font-mono text-xs font-semibold text-[color:var(--foreground)]">
                        {c.toothPair}
                      </span>
                      <p className="text-xs text-[color:var(--muted-foreground)]">{c.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              title="PDL Warnings"
              count={data.issues.pdlWarnings.length}
              tone="warning"
            >
              <ul className="space-y-2">
                {data.issues.pdlWarnings.map((p) => {
                  const sColor =
                    p.severity === "high"
                      ? "text-red-600"
                      : p.severity === "moderate"
                      ? "text-amber-600"
                      : "text-slate-600";
                  return (
                    <li
                      key={`${p.tooth}-${p.severity}`}
                      className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={12} className="text-amber-500" />
                        <span className="font-mono font-semibold">{p.tooth}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[color:var(--muted-foreground)]">
                          {p.stressPct}%
                        </span>
                        <span className={`font-semibold capitalize ${sColor}`}>
                          {p.severity}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section
              title="Attachment Warnings"
              count={data.issues.attachmentWarnings.length}
              tone="warning"
            >
              <ul className="space-y-2">
                {data.issues.attachmentWarnings.map((a, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs"
                  >
                    <AlertTriangle size={12} className="mt-0.5 shrink-0 text-amber-500" />
                    <div>
                      <span className="font-mono font-semibold">{a.tooth}</span>
                      <span className="ml-2 text-[color:var(--muted-foreground)]">{a.issue}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              title="IPR Warnings"
              count={data.issues.iprWarnings.length}
              tone="warning"
            >
              <ul className="space-y-2">
                {data.issues.iprWarnings.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs"
                  >
                    <span className="font-mono">{w.contact}</span>
                    <span className="font-semibold text-amber-700">+{w.excessMm.toFixed(2)} mm excess</span>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              title="Staging Issues"
              count={data.issues.stagingIssues.length}
              tone="neutral"
            >
              <ul className="space-y-2">
                {data.issues.stagingIssues.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="font-mono font-semibold">Stage {s.stage}</span>
                    <span className="text-[color:var(--muted-foreground)]">{s.issue}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          {/* Warnings */}
          {data.warnings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">
                Warnings
              </h3>
              {data.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                  <span className="text-sm text-amber-800">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Checked at */}
          <p className="text-right text-[10px] text-[color:var(--muted-foreground)]">
            Last checked: {new Date(data.checkedAt).toLocaleString()}
          </p>
        </>
      )}

      {!loading && !data && !error && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <ShieldCheck size={40} className="text-[color:var(--muted-foreground)]" />
          <p className="text-sm text-[color:var(--muted-foreground)]">
            No QA report yet. Click &ldquo;Run QA Check&rdquo; to generate one.
          </p>
        </div>
      )}
    </div>
  );
}
