"use client";

import { useState } from "react";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Download,
  Eye,
  FileText,
  Layers,
  Loader2,
  Microscope,
  Package,
  Printer,
  Shield,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  Timer,
  User,
  X,
} from "lucide-react";
import type { QCCheck, QCReport, AuditLogEntry } from "@/types/orthodontic";
import { qcStatusTone } from "@/types/orthodontic";

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_QC_CHECKS: QCCheck[] = [];

const MOCK_QC_REPORTS: QCReport[] = [];

const MOCK_AUDIT_LOG: AuditLogEntry[] = [];

// ─── QC Check row ─────────────────────────────────────────────────────────────

const CHECK_ICONS: Record<QCCheck["checkType"], React.ElementType> = {
  print_quality:         Layers,
  model_integrity:       Shield,
  thickness_verification:Microscope,
  fit_verification:      Eye,
  surface_finish:        Layers,
  dimensional_accuracy:  Layers,
  material_compliance:   CheckCircle2,
};

const STATUS_CONFIG = {
  pass:             { label: "Pass",             bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-300/50" },
  fail:             { label: "Fail",             bg: "bg-rose-500/10",    text: "text-rose-500",    border: "border-rose-300/50" },
  conditional_pass: { label: "Conditional Pass", bg: "bg-amber-500/10",   text: "text-amber-600",   border: "border-amber-300/50" },
  rework_required:  { label: "Rework Required",  bg: "bg-orange-500/10",  text: "text-orange-600",  border: "border-orange-300/50" },
  pending:          { label: "Pending",          bg: "bg-slate-500/10",   text: "text-slate-500",   border: "border-slate-300/50" },
};

function QCCheckRow({ check }: { check: QCCheck }) {
  const cfg = STATUS_CONFIG[check.status];
  const Icon = CHECK_ICONS[check.checkType];

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 ${check.status === "fail" || check.status === "rework_required" ? "border-rose-300/50 bg-rose-50/30 dark:border-rose-700/40 dark:bg-rose-900/5" : check.status === "conditional_pass" ? "border-amber-300/40 bg-amber-50/30 dark:border-amber-700/40 dark:bg-amber-900/5" : "border-[color:var(--border)] bg-[color:var(--card)]"}`}>
      <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${cfg.bg} ${cfg.text}`}>
        <Icon size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-[color:var(--foreground)]">{check.label}</p>
          <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-[color:var(--muted-foreground)]">
          {check.measuredValue && <span><strong className="text-[color:var(--foreground)]">Measured:</strong> {check.measuredValue}</span>}
          {check.expectedRange && <span><strong className="text-[color:var(--foreground)]">Expected:</strong> {check.expectedRange}</span>}
          {check.tolerance && <span><strong className="text-[color:var(--foreground)]">Tolerance:</strong> {check.tolerance}</span>}
        </div>
        {check.notes && (
          <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">{check.notes}</p>
        )}
        {check.inspectedAt && (
          <p className="mt-0.5 text-[10px] text-[color:var(--muted-foreground)]">Inspected at {check.inspectedAt}</p>
        )}
      </div>
    </div>
  );
}

// ─── QC Report card ───────────────────────────────────────────────────────────

function QCReportCard({ report, selected, onSelect }: { report: QCReport; selected: boolean; onSelect: () => void }) {
  const cfg = STATUS_CONFIG[report.overallStatus];
  const passCount = report.checks.filter(c => c.status === "pass").length;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition-all ${selected ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]" : "border-[color:var(--border)] bg-[color:var(--card)] hover:border-[color:var(--primary)]/40"}`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-xs font-bold text-[color:var(--primary)]">{report.batchLabel}</p>
          <p className="text-sm font-bold text-[color:var(--foreground)]">{report.patientName}</p>
          <p className="text-xs text-[color:var(--muted-foreground)]">{report.caseId}</p>
        </div>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cfg.bg} ${cfg.text}`}>
          {cfg.label}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-[color:var(--muted-foreground)]">
        <span>{passCount}/{report.checks.length} checks passed</span>
        <span>{report.photosAttached} photos</span>
      </div>
      <p className="mt-1.5 text-xs text-[color:var(--muted-foreground)]">By {report.inspectorName} · {report.inspectedAt}</p>
    </button>
  );
}

// ─── Audit log ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Admin", clinic_admin: "Clinic Admin", orthodontist: "Orthodontist",
  dentist: "Dentist", treatment_planner: "Planner", lab_technician: "Lab Tech",
  reviewer: "Reviewer", read_only: "Read-only",
};

function AuditLog() {
  return (
    <div className="ios-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <ClipboardList size={15} className="text-[color:var(--primary)]" />
        <h3 className="font-bold text-[color:var(--foreground)]">Audit Log</h3>
        <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">HIPAA-compliant</span>
      </div>
      <div className="space-y-2">
        {MOCK_AUDIT_LOG.map(entry => (
          <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--primary-glow)] text-[color:var(--primary)] text-[10px] font-black">
              {entry.actorName.split(" ").map(n => n[0]).join("").slice(0, 2)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[color:var(--foreground)]">{entry.action}</p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="text-xs font-semibold text-[color:var(--muted-foreground)]">{entry.actorName}</span>
                <span className="rounded-md bg-[color:var(--primary-glow)] px-1.5 py-0.5 text-[10px] font-bold text-[color:var(--primary)]">{ROLE_LABELS[entry.actorRole] ?? entry.actorRole}</span>
                <span className="text-xs text-[color:var(--muted-foreground)]">{entry.timestamp}</span>
              </div>
              {entry.details && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Object.entries(entry.details).map(([k, v]) => (
                    <span key={k} className="rounded-md border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] text-[color:var(--muted-foreground)]">
                      <span className="font-semibold text-[color:var(--foreground)]">{k}:</span> {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function QualityControlCenter() {
  const [activeTab, setActiveTab] = useState<"inspection" | "reports" | "audit">("inspection");
  const [selectedReport, setSelectedReport] = useState<QCReport>(MOCK_QC_REPORTS[0]);
  const [approved, setApproved] = useState(selectedReport.approvedForShipping);

  const passCount = selectedReport.checks.filter(c => c.status === "pass").length;
  const failCount = selectedReport.checks.filter(c => c.status === "fail").length;
  const condCount = selectedReport.checks.filter(c => c.status === "conditional_pass").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Quality Control Center</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">QC Inspection Workflow</h2>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Validate print quality, model integrity, thickness, and fit for each batch.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="flex items-center gap-1.5 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm font-bold text-[color:var(--foreground)]">
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {(["inspection", "reports", "audit"] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all capitalize ${activeTab === tab ? "bg-[color:var(--primary)] text-white" : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
          >
            {tab === "audit" ? "Audit Log" : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Inspection tab */}
      {activeTab === "inspection" && (
        <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
          {/* Report selector */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-[color:var(--foreground)]">Batches for Inspection</h4>
            {MOCK_QC_REPORTS.map(r => (
              <QCReportCard
                key={r.id}
                report={r}
                selected={r.id === selectedReport.id}
                onSelect={() => { setSelectedReport(r); setApproved(r.approvedForShipping); }}
              />
            ))}
          </div>

          {/* QC checks */}
          <div className="space-y-4">
            {/* Batch header */}
            <div className="ios-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-xs font-bold text-[color:var(--primary)]">{selectedReport.batchLabel} · {selectedReport.caseId}</p>
                  <h3 className="text-lg font-bold text-[color:var(--foreground)]">{selectedReport.patientName}</h3>
                  <p className="text-xs text-[color:var(--muted-foreground)]">Inspector: {selectedReport.inspectorName} · {selectedReport.inspectedAt}</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600">{passCount} Pass</span>
                    {condCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-600">{condCount} Conditional</span>}
                    {failCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-500">{failCount} Fail</span>}
                  </div>
                </div>
              </div>

              {/* Overall status + shipping approval */}
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <div className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${STATUS_CONFIG[selectedReport.overallStatus].border} ${STATUS_CONFIG[selectedReport.overallStatus].bg}`}>
                  {selectedReport.overallStatus === "pass" ? <CheckCircle2 size={15} className="text-emerald-600" /> : <AlertTriangle size={15} className="text-amber-600" />}
                  <span className={`text-sm font-bold ${STATUS_CONFIG[selectedReport.overallStatus].text}`}>{STATUS_CONFIG[selectedReport.overallStatus].label}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setApproved(v => !v)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all ${approved ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]"}`}
                >
                  {approved ? <CheckCircle2 size={15} className="text-emerald-600" /> : <ThumbsUp size={15} />}
                  {approved ? "Approved for Shipping" : "Approve for Shipping"}
                </button>
              </div>

              {selectedReport.auditNotes && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/60 px-3 py-2 dark:border-amber-700/40 dark:bg-amber-900/10">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800 dark:text-amber-300">{selectedReport.auditNotes}</p>
                </div>
              )}
            </div>

            {/* Checks list */}
            <div className="space-y-2">
              {selectedReport.checks.map(check => (
                <QCCheckRow key={check.id} check={check} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reports tab */}
      {activeTab === "reports" && (
        <div className="ios-card p-6 text-center">
          <FileText size={32} className="mx-auto mb-3 text-[color:var(--muted-foreground)]" />
          <h3 className="font-bold text-[color:var(--foreground)] mb-2">QC Reports Archive</h3>
          <p className="text-sm text-[color:var(--muted-foreground)] mb-5">
            All QC inspection reports are stored with full audit trails, inspector signatures, pass/fail status, and batch photos.
          </p>
          <div className="flex justify-center gap-3 flex-wrap">
            {MOCK_QC_REPORTS.map(r => (
              <div key={r.id} className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-3">
                <span className={`h-2.5 w-2.5 rounded-full ${r.overallStatus === "pass" ? "bg-emerald-500" : r.overallStatus === "conditional_pass" ? "bg-amber-500" : "bg-rose-500"}`} />
                <div className="text-left">
                  <p className="text-xs font-bold text-[color:var(--foreground)]">{r.batchLabel}</p>
                  <p className="text-[10px] text-[color:var(--muted-foreground)]">{r.patientName}</p>
                </div>
                <button type="button" className="ml-2 text-[color:var(--primary)]"><Download size={13} /></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit log */}
      {activeTab === "audit" && <AuditLog />}
    </div>
  );
}

export default QualityControlCenter;
