"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientData {
  firstName: string;
  lastName: string;
  dob: string;
  gender: "male" | "female" | "other" | "";
  phone: string;
  email: string;
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

const STEP_LABELS = ["Patient", "Clinical", "Goals", "Review"];

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
                "mx-1 mb-3 h-0.5 w-10 transition-colors sm:w-16",
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

// ─── Wizard ───────────────────────────────────────────────────────────────────

export default function NewCaseWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [patient, setPatient] = useState<PatientData>({
    firstName: "", lastName: "", dob: "", gender: "", phone: "", email: "",
  });

  const [clinical, setClinical] = useState<ClinicalData>({
    chiefComplaint: "", malocclusionClass: "", urgency: "routine", crowdingSeverity: "mild",
  });

  const [goals, setGoals] = useState<GoalsData>({
    correctCrowding: true, correctSpacing: false, correctOverjet: false,
    correctOverbite: false, correctMidline: false, correctRotation: false,
    correctCrossbite: false, expectedDuration: "", notes: "",
  });

  // ── Validation ────────────────────────────────────────────────────────────

  function canAdvance(): boolean {
    if (step === 0) return !!patient.firstName && !!patient.lastName && !!patient.dob;
    if (step === 1) return !!clinical.chiefComplaint && !!clinical.malocclusionClass;
    if (step === 2) return !!goals.expectedDuration;
    return true;
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

    try {
      const body = {
        patient: {
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dob,
          gender: patient.gender || undefined,
          phone: patient.phone || undefined,
          email: patient.email || undefined,
        },
        clinical: {
          chiefComplaint: clinical.chiefComplaint,
          malocclusionClass: clinical.malocclusionClass,
          crowdingSeverity: clinical.crowdingSeverity,
          urgency: clinical.urgency,
        },
        treatmentGoals: {
          correctCrowding: goals.correctCrowding,
          correctSpacing: goals.correctSpacing,
          correctOverjet: goals.correctOverjet,
          correctOverbite: goals.correctOverbite,
          correctMidline: goals.correctMidline,
          correctRotation: goals.correctRotation,
          correctCrossbite: goals.correctCrossbite,
          expectedDurationMonths: goals.expectedDuration,
          notes: goals.notes || undefined,
        },
      };

      const res = await fetch(`${apiUrl}/cases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "Unknown error");
        throw new Error(`Server responded ${res.status}: ${text}`);
      }

      router.push("/cases");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed — check your backend connection.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step content ──────────────────────────────────────────────────────────

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
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Patient Details</h2>
              <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
                Enter patient information or search existing records.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="First name" required>
                <input
                  className={INPUT}
                  placeholder="Jane"
                  value={patient.firstName}
                  onChange={(e) => setPatient((p) => ({ ...p, firstName: e.target.value }))}
                />
              </Field>
              <Field label="Last name" required>
                <input
                  className={INPUT}
                  placeholder="Smith"
                  value={patient.lastName}
                  onChange={(e) => setPatient((p) => ({ ...p, lastName: e.target.value }))}
                />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date of birth" required>
                <input
                  type="date"
                  className={INPUT}
                  value={patient.dob}
                  onChange={(e) => setPatient((p) => ({ ...p, dob: e.target.value }))}
                />
              </Field>
              <Field label="Gender">
                <select
                  className={SELECT}
                  value={patient.gender}
                  onChange={(e) => setPatient((p) => ({ ...p, gender: e.target.value as PatientData["gender"] }))}
                >
                  <option value="">Select…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / prefer not to say</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Phone">
                <input
                  type="tel"
                  className={INPUT}
                  placeholder="+1 (555) 000-0000"
                  value={patient.phone}
                  onChange={(e) => setPatient((p) => ({ ...p, phone: e.target.value }))}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  className={INPUT}
                  placeholder="jane@example.com"
                  value={patient.email}
                  onChange={(e) => setPatient((p) => ({ ...p, email: e.target.value }))}
                />
              </Field>
            </div>
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

        {/* Step 4 — Review */}
        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Review & Submit</h2>
              <p className="mt-0.5 text-sm text-[color:var(--muted-foreground)]">
                Confirm case details before creating the record.
              </p>
            </div>

            {/* Patient summary */}
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] divide-y divide-[color:var(--border)]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wider">Patient</span>
                <button type="button" onClick={() => setStep(0)} className="text-[10px] font-medium text-[color:var(--primary)] hover:underline">Edit</button>
              </div>
              {[
                ["Name", `${patient.firstName} ${patient.lastName}`],
                ["Date of birth", patient.dob || "—"],
                ["Gender", patient.gender || "Not specified"],
                ["Phone", patient.phone || "—"],
                ["Email", patient.email || "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-4 py-2 text-xs">
                  <span className="text-[color:var(--muted-foreground)]">{k}</span>
                  <span className="font-medium text-[color:var(--foreground)]">{v}</span>
                </div>
              ))}
            </div>

            {/* Clinical summary */}
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] divide-y divide-[color:var(--border)]">
              <div className="flex items-center justify-between px-4 py-2.5">
                <span className="text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wider">Clinical</span>
                <button type="button" onClick={() => setStep(1)} className="text-[10px] font-medium text-[color:var(--primary)] hover:underline">Edit</button>
              </div>
              {[
                ["Chief complaint", clinical.chiefComplaint],
                ["Malocclusion", clinical.malocclusionClass.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())],
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
                <span className="font-medium text-[color:var(--foreground)]">{goals.expectedDuration} months</span>
              </div>
              {goals.notes && (
                <div className="px-4 py-2 text-xs text-[color:var(--muted-foreground)]">
                  {goals.notes}
                </div>
              )}
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

          {step < 3 ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[color:var(--muted-foreground)]">
                Step {step + 1} of 4
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
