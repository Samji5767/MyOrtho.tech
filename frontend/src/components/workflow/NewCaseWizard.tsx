"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, AlertCircle, Search, UserPlus, Upload, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";
import { fetchPatients, type PatientListItem } from "@/lib/api/patients";
import { createCase, createCaseWithNewPatient } from "@/lib/api/cases";
import { uploadScan } from "@/lib/api/scans";
import { useToast } from "@/components/ToastContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface NewPatientData {
  firstName: string;
  lastName: string;
  dob: string;
  gender: "male" | "female" | "other" | "";
}

interface ClinicalData {
  chiefComplaint: string;
  malocclusionClass: "class-i" | "class-ii-div1" | "class-ii-div2" | "class-iii" | "";
  urgency: "routine" | "urgent";
  crowdingSeverity: "none" | "mild" | "moderate" | "severe";
}

interface GoalsData {
  correctCrowding: boolean;
  correctSpacing: boolean;
  correctOverjet: boolean;
  correctOverbite: boolean;
  correctMidline: boolean;
  correctRotation: boolean;
  correctCrossbite: boolean;
  expectedDuration: "6-12" | "12-18" | "18-24" | "24+" | "";
  notes: string;
}

// ─── Styling constants ────────────────────────────────────────────────────────

const INPUT = [
  "h-10 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]",
  "px-3 text-sm text-[color:var(--foreground)]",
  "placeholder:text-[color:var(--muted-foreground)]",
  "focus:border-[color:var(--primary)] focus:outline-none",
  "focus:ring-2 focus:ring-[color:var(--primary)]/20 transition-colors",
].join(" ");

const SELECT = [INPUT, "cursor-pointer appearance-none"].join(" ");

const TEXTAREA = [
  "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]",
  "px-3 py-2.5 text-sm text-[color:var(--foreground)] resize-none",
  "placeholder:text-[color:var(--muted-foreground)]",
  "focus:border-[color:var(--primary)] focus:outline-none",
  "focus:ring-2 focus:ring-[color:var(--primary)]/20 transition-colors",
].join(" ");

const LABEL = "text-xs font-semibold text-[color:var(--foreground)]";

// ─── Step indicator ───────────────────────────────────────────────────────────

const STEP_LABELS = ["Patient", "Clinical", "Goals", "Scans", "Review"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={[
                "grid h-7 w-7 place-items-center rounded-full text-xs font-bold transition-colors",
                i < current
                  ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                  : i === current
                  ? "border-2 border-[color:var(--primary)] text-[color:var(--primary)]"
                  : "border border-[color:var(--border)] text-[color:var(--muted-foreground)]",
              ].join(" ")}
            >
              {i < current ? <Check size={12} /> : i + 1}
            </div>
            <span
              className={[
                "hidden text-[9px] font-semibold sm:block",
                i <= current ? "text-[color:var(--foreground)]" : "text-[color:var(--muted-foreground)]",
              ].join(" ")}
            >
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div
              className={[
                "mx-1 mb-3 h-0.5 w-8 transition-colors sm:w-12",
                i < current ? "bg-[color:var(--primary)]" : "bg-[color:var(--border)]",
              ].join(" ")}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className={LABEL}>
        {label}
        {required && <span className="ml-0.5 text-[color:var(--danger,#ef4444)]">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Pill radio group ─────────────────────────────────────────────────────────

function PillGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={[
            "rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
            value === opt.value
              ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]"
              : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] hover:border-[color:var(--primary)]/40",
          ].join(" ")}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── Checkbox pill ────────────────────────────────────────────────────────────

function CheckPill({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
        checked
          ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]"
          : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]",
      ].join(" ")}
    >
      <span
        className={[
          "grid h-3.5 w-3.5 place-items-center rounded-sm border transition-colors",
          checked
            ? "border-[color:var(--primary)] bg-[color:var(--primary)]"
            : "border-[color:var(--border)]",
        ].join(" ")}
      >
        {checked && <Check size={9} className="text-white" />}
      </span>
      {children}
    </button>
  );
}

// ─── Scan file row ────────────────────────────────────────────────────────────

function ScanFileRow({
  label,
  file,
  onSelect,
  onClear,
}: {
  label: string;
  file: File | null;
  onSelect: (f: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex items-center gap-3">
      <input
        ref={ref}
        type="file"
        accept=".stl,.obj,.ply"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
          e.target.value = "";
        }}
      />
      <div className="flex-1 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-xs">
        {file ? (
          <span className="font-medium text-[color:var(--foreground)]">{file.name}</span>
        ) : (
          <span className="text-[color:var(--muted-foreground)]">{label} scan — STL / OBJ / PLY</span>
        )}
      </div>
      {file ? (
        <button
          type="button"
          onClick={onClear}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
        >
          <X size={13} />
        </button>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => ref.current?.click()}>
          <Upload size={12} /> Choose
        </Button>
      )}
    </div>
  );
}

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function NewCaseWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedPatientId = searchParams?.get("patientId") ?? null;
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Patient step state
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null);
  const [createNew, setCreateNew] = useState(false);
  const [newPatient, setNewPatient] = useState<NewPatientData>({
    firstName: "", lastName: "", dob: "", gender: "",
  });

  // Clinical step state
  const [clinical, setClinical] = useState<ClinicalData>({
    chiefComplaint: "", malocclusionClass: "", urgency: "routine", crowdingSeverity: "mild",
  });

  // Goals step state
  const [goals, setGoals] = useState<GoalsData>({
    correctCrowding: true, correctSpacing: false, correctOverjet: false,
    correctOverbite: false, correctMidline: false, correctRotation: false,
    correctCrossbite: false, expectedDuration: "", notes: "",
  });

  // Scans step state
  const [upperFile, setUpperFile] = useState<File | null>(null);
  const [lowerFile, setLowerFile] = useState<File | null>(null);

  // Load patients once; auto-select when ?patientId= is in the URL
  useEffect(() => {
    setPatientsLoading(true);
    fetchPatients()
      .then(({ patients }) => {
        setPatients(patients);
        if (preselectedPatientId) {
          const match = patients.find((p) => p.id === preselectedPatientId);
          if (match) setSelectedPatient(match);
        }
      })
      .catch(() => setPatients([]))
      .finally(() => setPatientsLoading(false));
  }, [preselectedPatientId]);

  const filteredPatients = patients.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
    );
  });

  // ── Validation ────────────────────────────────────────────────────────────

  function isDobValid(dob: string): boolean {
    if (!dob) return false;
    const year = parseInt(dob.split('-')[0], 10);
    const currentYear = new Date().getFullYear();
    return !isNaN(year) && year >= 1900 && year <= currentYear;
  }

  function canAdvance(): boolean {
    if (step === 0) {
      if (createNew) {
        return !!newPatient.firstName && !!newPatient.lastName && isDobValid(newPatient.dob);
      }
      return !!selectedPatient;
    }
    if (step === 1) return !!clinical.chiefComplaint && !!clinical.malocclusionClass;
    if (step === 2) return !!goals.expectedDuration;
    return true; // scans and review are optional / always valid
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    try {
      // 1 & 2 — Resolve patient and create case (atomically when creating new patient)
      let caseRecord: Awaited<ReturnType<typeof createCase>>;
      if (createNew) {
        caseRecord = await createCaseWithNewPatient({
          patient: {
            firstName: newPatient.firstName,
            lastName: newPatient.lastName,
            dateOfBirth: newPatient.dob || undefined,
            gender: newPatient.gender || undefined,
          },
          chiefComplaint: clinical.chiefComplaint || undefined,
          malocclusionClass: clinical.malocclusionClass || undefined,
          notes: goals.notes || undefined,
        });
      } else {
        caseRecord = await createCase({
          patientId: selectedPatient!.id,
          chiefComplaint: clinical.chiefComplaint || undefined,
          malocclusionClass: clinical.malocclusionClass || undefined,
          notes: goals.notes || undefined,
        });
      }

      // 3 — Upload scans (fire-and-forget errors so case is still created)
      const uploads: Promise<unknown>[] = [];
      if (upperFile) uploads.push(uploadScan(caseRecord.id, upperFile, "maxillary").catch(() => null));
      if (lowerFile) uploads.push(uploadScan(caseRecord.id, lowerFile, "mandibular").catch(() => null));
      await Promise.all(uploads);

      // 4 — Navigate to new case
      toast({ title: "Case created", description: "Opening your new case workspace.", type: "success" });
      router.push(`/cases?id=${caseRecord.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed — check your backend connection.";
      setSubmitError(msg);
      toast({ title: "Submission failed", description: msg, type: "error" });
      setSubmitting(false);
    }
  }

  // ── Options ───────────────────────────────────────────────────────────────

  const MALOCCLUSION_OPTIONS = [
    { value: "class-i" as const, label: "Class I" },
    { value: "class-ii-div1" as const, label: "Class II Div 1" },
    { value: "class-ii-div2" as const, label: "Class II Div 2" },
    { value: "class-iii" as const, label: "Class III" },
  ];

  const CROWDING_OPTIONS = [
    { value: "none" as const, label: "None" },
    { value: "mild" as const, label: "Mild (<4 mm)" },
    { value: "moderate" as const, label: "Moderate (4–8 mm)" },
    { value: "severe" as const, label: "Severe (>8 mm)" },
  ];

  const DURATION_OPTIONS = [
    { value: "6-12" as const, label: "6–12 months" },
    { value: "12-18" as const, label: "12–18 months" },
    { value: "18-24" as const, label: "18–24 months" },
    { value: "24+" as const, label: "24+ months" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-10 pt-4 sm:px-5">

      {/* Step indicator */}
      <div className="flex justify-center pt-2">
        <StepIndicator current={step} />
      </div>

      <Card className="p-6">

        {/* Step 1 — Patient */}
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Patient</h2>
              <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
                Select an existing patient or create a new record.
              </p>
            </div>

            {/* Toggle: existing vs. new */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setCreateNew(false); }}
                className={[
                  "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                  !createNew
                    ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]"
                    : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
                ].join(" ")}
              >
                <Search size={11} /> Existing patient
              </button>
              <button
                type="button"
                onClick={() => { setCreateNew(true); setSelectedPatient(null); }}
                className={[
                  "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors",
                  createNew
                    ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]"
                    : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
                ].join(" ")}
              >
                <UserPlus size={11} /> New patient
              </button>
            </div>

            {/* Existing patient search */}
            {!createNew && (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
                  <input
                    type="search"
                    inputMode="search"
                    autoComplete="off"
                    className={INPUT + " pl-8"}
                    placeholder="Search by name…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                {patientsLoading ? (
                  <div className="flex items-center justify-center py-6 text-xs text-[color:var(--muted-foreground)]">
                    <Loader2 size={14} className="mr-2 animate-spin" /> Loading patients…
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[color:var(--border)] py-5 text-center text-xs text-[color:var(--muted-foreground)]">
                    {search ? `No patients matching "${search}"` : "No patients yet"}
                    <button
                      type="button"
                      onClick={() => setCreateNew(true)}
                      className="ml-1 font-medium text-[color:var(--primary)] hover:underline"
                    >
                      Create new
                    </button>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto rounded-xl border border-[color:var(--border)] divide-y divide-[color:var(--border)]">
                    {filteredPatients.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPatient(p)}
                        className={[
                          "flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors",
                          selectedPatient?.id === p.id
                            ? "bg-[color:var(--primary-glow)]"
                            : "hover:bg-[color:var(--muted)]/30",
                        ].join(" ")}
                      >
                        <div>
                          <span className="font-medium text-[color:var(--foreground)]">{p.firstName} {p.lastName}</span>
                          {p.dateOfBirth && (
                            <span className="ml-2 text-xs text-[color:var(--muted-foreground)]">
                              DOB: {p.dateOfBirth}
                            </span>
                          )}
                        </div>
                        {selectedPatient?.id === p.id && (
                          <Check size={14} className="shrink-0 text-[color:var(--primary)]" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* New patient form */}
            {createNew && (
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="First name" required>
                    <input
                      type="text"
                      autoCapitalize="words"
                      autoComplete="given-name"
                      maxLength={80}
                      className={INPUT}
                      placeholder="Jane"
                      value={newPatient.firstName}
                      onChange={(e) => setNewPatient((p) => ({ ...p, firstName: e.target.value }))}
                    />
                  </Field>
                  <Field label="Last name" required>
                    <input
                      type="text"
                      autoCapitalize="words"
                      autoComplete="family-name"
                      maxLength={80}
                      className={INPUT}
                      placeholder="Smith"
                      value={newPatient.lastName}
                      onChange={(e) => setNewPatient((p) => ({ ...p, lastName: e.target.value }))}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date of birth" required>
                    <input
                      type="date"
                      className={INPUT}
                      value={newPatient.dob}
                      min="1900-01-01"
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setNewPatient((p) => ({ ...p, dob: e.target.value }))}
                    />
                    {newPatient.dob && !isDobValid(newPatient.dob) && (
                      <p className="text-[10px] text-rose-500">Enter a valid year between 1900 and today.</p>
                    )}
                  </Field>
                  <Field label="Gender">
                    <select
                      className={SELECT}
                      value={newPatient.gender}
                      onChange={(e) => setNewPatient((p) => ({ ...p, gender: e.target.value as NewPatientData["gender"] }))}
                    >
                      <option value="">Select…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other / prefer not to say</option>
                    </select>
                  </Field>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Clinical */}
        {step === 1 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Clinical Classification</h2>
              <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
                Malocclusion class, chief complaint, and urgency.
              </p>
            </div>
            <Field label="Chief complaint" required>
              <textarea
                className={TEXTAREA}
                rows={3}
                placeholder="Patient presents with crowding of the upper anterior teeth and requests cosmetic alignment…"
                value={clinical.chiefComplaint}
                onChange={(e) => setClinical((c) => ({ ...c, chiefComplaint: e.target.value }))}
              />
            </Field>
            <Field label="Malocclusion class (Angle)" required>
              <PillGroup
                options={MALOCCLUSION_OPTIONS}
                value={clinical.malocclusionClass}
                onChange={(v) => setClinical((c) => ({ ...c, malocclusionClass: v }))}
              />
            </Field>
            <Field label="Crowding severity">
              <PillGroup
                options={CROWDING_OPTIONS}
                value={clinical.crowdingSeverity}
                onChange={(v) => setClinical((c) => ({ ...c, crowdingSeverity: v }))}
              />
            </Field>
            <Field label="Case urgency">
              <PillGroup
                options={[
                  { value: "routine" as const, label: "Routine" },
                  { value: "urgent" as const, label: "Urgent" },
                ]}
                value={clinical.urgency}
                onChange={(v) => setClinical((c) => ({ ...c, urgency: v }))}
              />
            </Field>
          </div>
        )}

        {/* Step 3 — Treatment goals */}
        {step === 2 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Treatment Goals</h2>
              <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
                Select all applicable corrections and expected treatment duration.
              </p>
            </div>
            <Field label="Correction objectives">
              <div className="flex flex-wrap gap-2">
                <CheckPill checked={goals.correctCrowding} onChange={(v) => setGoals((g) => ({ ...g, correctCrowding: v }))}>Crowding</CheckPill>
                <CheckPill checked={goals.correctSpacing} onChange={(v) => setGoals((g) => ({ ...g, correctSpacing: v }))}>Spacing</CheckPill>
                <CheckPill checked={goals.correctOverjet} onChange={(v) => setGoals((g) => ({ ...g, correctOverjet: v }))}>Overjet</CheckPill>
                <CheckPill checked={goals.correctOverbite} onChange={(v) => setGoals((g) => ({ ...g, correctOverbite: v }))}>Overbite</CheckPill>
                <CheckPill checked={goals.correctMidline} onChange={(v) => setGoals((g) => ({ ...g, correctMidline: v }))}>Midline</CheckPill>
                <CheckPill checked={goals.correctRotation} onChange={(v) => setGoals((g) => ({ ...g, correctRotation: v }))}>Rotation</CheckPill>
                <CheckPill checked={goals.correctCrossbite} onChange={(v) => setGoals((g) => ({ ...g, correctCrossbite: v }))}>Crossbite</CheckPill>
              </div>
            </Field>
            <Field label="Expected treatment duration" required>
              <PillGroup
                options={DURATION_OPTIONS}
                value={goals.expectedDuration}
                onChange={(v) => setGoals((g) => ({ ...g, expectedDuration: v }))}
              />
            </Field>
            <Field label="Clinical notes">
              <textarea
                className={TEXTAREA}
                rows={3}
                placeholder="Additional clinical observations, patient preferences, or contraindications…"
                value={goals.notes}
                onChange={(e) => setGoals((g) => ({ ...g, notes: e.target.value }))}
              />
            </Field>
          </div>
        )}

        {/* Step 4 — Scans */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Upload Scans</h2>
              <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
                Add STL, OBJ, or PLY arch scans. You can skip this step and upload later.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Field label="Upper arch (maxillary)">
                <ScanFileRow
                  label="Upper arch"
                  file={upperFile}
                  onSelect={setUpperFile}
                  onClear={() => setUpperFile(null)}
                />
              </Field>
              <Field label="Lower arch (mandibular)">
                <ScanFileRow
                  label="Lower arch"
                  file={lowerFile}
                  onSelect={setLowerFile}
                  onClear={() => setLowerFile(null)}
                />
              </Field>
            </div>
            {(upperFile || lowerFile) && (
              <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-xs text-[color:var(--muted-foreground)]">
                Scans will be uploaded when you submit. You can trigger AI segmentation from the case detail page after upload.
              </div>
            )}
          </div>
        )}

        {/* Step 5 — Review */}
        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Review & Submit</h2>
              <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
                Confirm case details before creating the record.
              </p>
            </div>

            {/* Patient summary */}
            {(() => {
              const patientRows: [string, string][] = createNew
                ? [
                    ["Name", `${newPatient.firstName} ${newPatient.lastName}`],
                    ["Date of birth", newPatient.dob || "—"],
                    ["Gender", newPatient.gender || "Not specified"],
                    ["Status", "New patient — will be created"],
                  ]
                : [
                    ["Name", `${selectedPatient!.firstName} ${selectedPatient!.lastName}`],
                    ["Date of birth", selectedPatient!.dateOfBirth ?? "—"],
                    ["Status", "Existing patient"],
                  ];
              return (
                <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] divide-y divide-[color:var(--border)]">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wider">Patient</span>
                    <button type="button" onClick={() => setStep(0)} className="text-[10px] font-medium text-[color:var(--primary)] hover:underline">Edit</button>
                  </div>
                  {patientRows.map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between px-4 py-2 text-xs">
                      <span className="text-[color:var(--muted-foreground)]">{k}</span>
                      <span className="font-medium text-[color:var(--foreground)]">{v}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Clinical summary */}
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] divide-y divide-[color:var(--border)]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wider">Clinical</span>
                <button type="button" onClick={() => setStep(1)} className="text-[10px] font-medium text-[color:var(--primary)] hover:underline">Edit</button>
              </div>
              {[
                ["Chief complaint", clinical.chiefComplaint || "—"],
                ["Malocclusion", clinical.malocclusionClass
                  ? clinical.malocclusionClass.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                  : "—"],
                ["Crowding", `${clinical.crowdingSeverity.charAt(0).toUpperCase()}${clinical.crowdingSeverity.slice(1)}`],
                ["Urgency", `${clinical.urgency.charAt(0).toUpperCase()}${clinical.urgency.slice(1)}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-start justify-between gap-3 px-4 py-2 text-xs">
                  <span className="shrink-0 text-[color:var(--muted-foreground)]">{k}</span>
                  <span className="text-right font-medium text-[color:var(--foreground)]">{v}</span>
                </div>
              ))}
            </div>

            {/* Goals summary */}
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] divide-y divide-[color:var(--border)]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wider">Treatment Goals</span>
                <button type="button" onClick={() => setStep(2)} className="text-[10px] font-medium text-[color:var(--primary)] hover:underline">Edit</button>
              </div>
              <div className="px-4 py-3">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    goals.correctCrowding && "Crowding",
                    goals.correctSpacing && "Spacing",
                    goals.correctOverjet && "Overjet",
                    goals.correctOverbite && "Overbite",
                    goals.correctMidline && "Midline",
                    goals.correctRotation && "Rotation",
                    goals.correctCrossbite && "Crossbite",
                  ].filter(Boolean).map((g) => (
                    <StatusBadge key={String(g)} tone="primary">{String(g)}</StatusBadge>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="text-[color:var(--muted-foreground)]">Duration</span>
                <span className="font-medium text-[color:var(--foreground)]">{goals.expectedDuration || "Not set"} months</span>
              </div>
              {goals.notes && (
                <div className="px-4 py-2 text-xs text-[color:var(--muted-foreground)]">
                  {goals.notes}
                </div>
              )}
            </div>

            {/* Scans summary */}
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] divide-y divide-[color:var(--border)]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wider">Scans</span>
                <button type="button" onClick={() => setStep(3)} className="text-[10px] font-medium text-[color:var(--primary)] hover:underline">Edit</button>
              </div>
              <div className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="text-[color:var(--muted-foreground)]">Upper arch</span>
                <span className="font-medium text-[color:var(--foreground)]">{upperFile ? upperFile.name : "None"}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2 text-xs">
                <span className="text-[color:var(--muted-foreground)]">Lower arch</span>
                <span className="font-medium text-[color:var(--foreground)]">{lowerFile ? lowerFile.name : "None"}</span>
              </div>
            </div>

            {/* Submit error */}
            {submitError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200/60 bg-red-50/60 p-3 text-xs text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                <AlertCircle size={13} className="mt-0.5 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => (step === 0 ? void 0 : setStep((s) => s - 1))}
            className={step === 0 ? "invisible" : ""}
          >
            <ChevronLeft size={15} /> Back
          </Button>

          {step < 4 ? (
            <div className="flex items-center gap-3">
              {step === 3 && (
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  className="text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] hover:underline transition-colors"
                >
                  Skip scans
                </button>
              )}
              <span className="text-xs text-[color:var(--muted-foreground)]">
                Step {step + 1} of 5
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                className={canAdvance() ? "" : "opacity-40 pointer-events-none"}
              >
                Continue <ChevronRight size={15} />
              </Button>
            </div>
          ) : (
            <Button
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              className={submitting ? "opacity-60 pointer-events-none" : ""}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Creating case…
                </>
              ) : (
                <>
                  <Check size={14} /> Create Case
                </>
              )}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
