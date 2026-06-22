"use client";

import { useState } from "react";
import {
  Activity,
  Calendar,
  Camera,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  ClipboardList,
  Download,
  Edit3,
  FileText,
  FileScan,
  Layers3,
  Mail,
  MapPin,
  Phone,
  Plus,
  ScanLine,
  ShieldCheck,
  Stethoscope,
  Upload,
  User,
  Users,
} from "lucide-react";
import { MedicalDisclaimer } from "@/components/MedicalDisclaimer";
import type { EnterprisePatient, PatientRecord, PatientTimelineEvent } from "@/types/orthodontic";

// ─── Patient data (populated from real backend) ───────────────────────────────

const MOCK_PATIENT: EnterprisePatient | null = null;

const MOCK_PATIENTS: Array<{ id: string; name: string; caseId: string; status: string; progress: number; initials: string; accentClass: string }> = [];

// ─── Helper components ────────────────────────────────────────────────────────

function CollapsibleSection({ title, icon: Icon, defaultOpen = true, children }: { title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="ios-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2.5 px-5 py-4 text-left"
      >
        <Icon size={16} className="shrink-0 text-[color:var(--primary)]" />
        <span className="flex-1 font-bold text-[color:var(--foreground)]">{title}</span>
        {open ? <ChevronUp size={16} className="text-[color:var(--muted-foreground)]" /> : <ChevronDown size={16} className="text-[color:var(--muted-foreground)]" />}
      </button>
      {open && (
        <div className="border-t border-[color:var(--border)] px-5 pb-5 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

function DataField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-1 text-sm text-[color:var(--foreground)]">{value}</p>
    </div>
  );
}

function RecordIcon({ type }: { type: PatientRecord["type"] }) {
  const map: Record<PatientRecord["type"], React.ElementType> = {
    photo: Camera, stl: Layers3, cbct: FileScan, xray: FileScan,
    treatment_plan: FileText, consent: ShieldCheck, document: ClipboardList,
  };
  const colors: Record<PatientRecord["type"], string> = {
    photo: "bg-rose-500/10 text-rose-500",
    stl:   "bg-violet-500/10 text-violet-500",
    cbct:  "bg-blue-500/10 text-blue-500",
    xray:  "bg-amber-500/10 text-amber-500",
    treatment_plan: "bg-teal-500/10 text-teal-600",
    consent:  "bg-emerald-500/10 text-emerald-600",
    document: "bg-slate-500/10 text-slate-500",
  };
  const Icon = map[type];
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${colors[type]}`}>
      <Icon size={16} />
    </span>
  );
}

function TimelineIcon({ type }: { type: PatientTimelineEvent["eventType"] }) {
  const map: Record<PatientTimelineEvent["eventType"], React.ElementType> = {
    consultation: User, scan_upload: ScanLine, segmentation: Activity,
    plan_generated: FileText, approval: ShieldCheck, manufacturing: CircleDot,
    delivery: ClipboardList, refinement: Edit3, appointment: Calendar,
    note: Edit3, payment: FileText,
  };
  const colors: Record<PatientTimelineEvent["eventType"], string> = {
    consultation: "bg-violet-500/10 text-violet-500",
    scan_upload: "bg-sky-500/10 text-sky-500",
    segmentation: "bg-indigo-500/10 text-indigo-500",
    plan_generated: "bg-teal-500/10 text-teal-600",
    approval: "bg-amber-500/10 text-amber-600",
    manufacturing: "bg-[color:var(--primary-glow)] text-[color:var(--primary)]",
    delivery: "bg-emerald-500/10 text-emerald-600",
    refinement: "bg-orange-500/10 text-orange-500",
    appointment: "bg-slate-500/10 text-slate-500",
    note: "bg-slate-500/10 text-slate-500",
    payment: "bg-green-500/10 text-green-600",
  };
  const Icon = map[type];
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${colors[type]}`}>
      <Icon size={16} />
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function EnterprisePatientProfile() {
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const patient = MOCK_PATIENT;

  if (!patient) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Patient Management</p>
            <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Enterprise Patient Profiles</h2>
          </div>
          <button type="button" className="flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-95">
            <Plus size={16} /> New Patient
          </button>
        </div>
        <div className="ios-card flex flex-col items-center gap-4 p-12 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
            <Users size={28} />
          </span>
          <div>
            <p className="text-base font-semibold text-[color:var(--foreground)]">No patient selected</p>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Add a patient and upload a scan to view the full enterprise profile.</p>
          </div>
        </div>
      </div>
    );
  }

  const { demographics: d, clinicalInfo: c, records, timeline } = patient;

  return (
    <div className="space-y-6">
      {/* Header + patient selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--muted-foreground)]">Patient Management</p>
          <h2 className="mt-1 text-2xl font-bold text-[color:var(--foreground)]">Enterprise Patient Profiles</h2>
        </div>
        <button type="button" className="flex items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-transform active:scale-95">
          <Plus size={16} /> New Patient
        </button>
      </div>

      {/* Patient selector rail */}
      {MOCK_PATIENTS.length > 0 ? (
        <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
          {MOCK_PATIENTS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPatientId(p.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 transition-all ${selectedPatientId === p.id ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)]" : "border-[color:var(--border)] bg-[color:var(--card)]"}`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ${p.accentClass}`}>{p.initials}</span>
              <div className="text-left">
                <p className={`text-sm font-bold ${selectedPatientId === p.id ? "text-[color:var(--primary)]" : "text-[color:var(--foreground)]"}`}>{p.name}</p>
                <p className="text-[11px] text-[color:var(--muted-foreground)]">{p.caseId}</p>
              </div>
            </button>
          ))}
        </div>
      ) : null}
      {/* Progress hero */}
      <div className="ios-card p-5">
        <div className="flex items-center gap-4 flex-wrap">
          <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold text-white bg-violet-500`}>
            {d.firstName[0]}{d.lastName[0]}
          </span>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-[color:var(--foreground)]">{d.firstName} {d.lastName}</h3>
            <p className="text-sm text-[color:var(--muted-foreground)]">Age {d.age} · {d.gender} · Case {patient.activeCaseId} · {c.clinicName}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CircleDot size={10} /> Active
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--primary-glow)] px-3 py-1.5 text-xs font-bold text-[color:var(--primary)]">
              {c.angleClassification}
            </span>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[color:var(--muted-foreground)]">Treatment Progress</span>
            <span className="text-xs font-bold text-[color:var(--foreground)]">{patient.treatmentProgress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[color:var(--border)] overflow-hidden">
            <div className="h-full rounded-full bg-[color:var(--primary)] transition-all" style={{ width: `${patient.treatmentProgress}%` }} />
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        {/* Left column */}
        <div className="space-y-5">
          {/* Demographics */}
          <CollapsibleSection title="Demographics" icon={User}>
            <div className="grid gap-4 sm:grid-cols-2">
              <DataField label="Full Name"         value={`${d.firstName} ${d.lastName}`} />
              <DataField label="Date of Birth"     value={`${d.dateOfBirth} (Age ${d.age})`} />
              <DataField label="Gender"            value={d.gender.replace("_", " ")} />
              <DataField label="Insurance ID"      value={d.insuranceId ?? "—"} />
              <DataField label="Phone"             value={
                <span className="flex items-center gap-1.5"><Phone size={12} /> {d.phone}</span>
              } />
              <DataField label="Email"             value={
                <span className="flex items-center gap-1.5"><Mail size={12} /> {d.email}</span>
              } />
              <DataField label="Address"           value={
                <span className="flex items-center gap-1.5"><MapPin size={12} /> {d.address}, {d.city}</span>
              } />
              <DataField label="Emergency Contact" value={`${d.emergencyContact ?? "—"} · ${d.emergencyPhone ?? ""}`} />
              <DataField label="Referred By"       value={d.referredBy ?? "—"} />
            </div>
          </CollapsibleSection>

          {/* Clinical Information */}
          <CollapsibleSection title="Clinical Information" icon={Stethoscope}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <DataField label="Orthodontist"           value={c.orthodontistName} />
                <DataField label="Clinic"                 value={c.clinicName} />
                <DataField label="Angle Classification"   value={c.angleClassification} />
                <DataField label="Skeletal Pattern"       value={`Class ${c.skeletalPattern}`} />
                <DataField label="Overjet"                value={`${c.overjet} mm`} />
                <DataField label="Overbite"               value={`${c.overbite} mm`} />
                <DataField label="Upper Arch Crowding"    value={`${c.crowdingUpper} mm`} />
                <DataField label="Lower Arch Crowding"    value={`${c.crowdingLower} mm`} />
                <DataField label="Treatment Status"       value={
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 capitalize">
                    {c.treatmentStatus}
                  </span>
                } />
                <DataField label="Estimated End Date" value={c.estimatedEndDate ?? "TBD"} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)] mb-1.5">Chief Complaint</p>
                <p className="text-sm text-[color:var(--foreground)] leading-relaxed">{c.chiefComplaint}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)] mb-1.5">Diagnosis</p>
                <p className="text-sm text-[color:var(--foreground)] leading-relaxed">{c.diagnosis}</p>
              </div>
              {c.notes && (
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[color:var(--muted-foreground)] mb-1.5">Clinical Notes</p>
                  <p className="text-sm text-[color:var(--foreground)] leading-relaxed">{c.notes}</p>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Records */}
          <CollapsibleSection title="Records & Files" icon={ClipboardList}>
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <button type="button" className="flex items-center gap-1.5 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-xs font-semibold text-[color:var(--foreground)]">
                  <Upload size={13} /> Upload file
                </button>
              </div>
              {records.map((rec) => (
                <div key={rec.id} className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5">
                  <RecordIcon type={rec.type} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{rec.fileName}</p>
                    <p className="text-xs text-[color:var(--muted-foreground)]">
                      {(rec.fileSize / 1000000).toFixed(1)} MB · {rec.uploadedBy} · {rec.uploadedAt}
                    </p>
                    {rec.notes && <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{rec.notes}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {rec.tags.slice(0, 2).map(t => (
                      <span key={t} className="rounded-md border border-[color:var(--border)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--muted-foreground)]">{t}</span>
                    ))}
                    <button type="button" className="rounded-lg border border-[color:var(--border)] p-1.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
                      <Download size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleSection>
        </div>

        {/* Right column: timeline */}
        <div className="ios-card p-5">
          <div className="flex items-center justify-between gap-2 mb-5">
            <h3 className="font-bold text-[color:var(--foreground)]">Case Timeline</h3>
            <span className="text-xs text-[color:var(--muted-foreground)]">{timeline.length} events</span>
          </div>
          <div className="relative space-y-0">
            {timeline.map((ev, idx) => (
              <div key={ev.id} className="flex gap-3 pb-5 last:pb-0">
                {/* Connector line */}
                <div className="relative flex flex-col items-center">
                  <TimelineIcon type={ev.eventType} />
                  {idx < timeline.length - 1 && (
                    <div className="absolute top-9 bottom-0 left-[18px] w-px bg-[color:var(--border)]" />
                  )}
                </div>
                <div className="pb-1 flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1.5 flex-wrap">
                    <p className="text-sm font-bold text-[color:var(--foreground)]">{ev.title}</p>
                    <span className="text-[11px] shrink-0 text-[color:var(--muted-foreground)]">{ev.timestamp}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted-foreground)]">{ev.description}</p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--muted-foreground)]">{ev.actor}</p>
                  {ev.metadata && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {Object.entries(ev.metadata).map(([k, v]) => (
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

          <div className="mt-4 border-t border-[color:var(--border)] pt-4">
            <button type="button" className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[color:var(--border)] py-3 text-sm font-semibold text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]">
              <Plus size={15} /> Add note to timeline
            </button>
          </div>
        </div>
      </div>

      <MedicalDisclaimer variant="panel" />
    </div>
  );
}

export default EnterprisePatientProfile;
