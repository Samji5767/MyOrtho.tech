"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Check, Loader2, Plus, Search,
  Upload, User, X,
} from "lucide-react";
import { fetchPatients, createPatient, type PatientListItem } from "@/lib/api/patients";
import { createCase } from "@/lib/api/cases";
import { uploadScan } from "@/lib/api/scans";

type Step = "patient" | "case" | "scans" | "done";

interface NewCaseModalProps {
  onClose: () => void;
  onCreated: (caseId: string) => void;
}

export default function NewCaseModal({ onClose, onCreated }: NewCaseModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("patient");

  // Patient step
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientListItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newDob, setNewDob] = useState("");

  // Case step
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [malocclusionClass, setMalocclusionClass] = useState("");
  const [notes, setNotes] = useState("");

  // Scan step
  const [upperFile, setUpperFile] = useState<File | null>(null);
  const [lowerFile, setLowerFile] = useState<File | null>(null);
  const upperInputRef = useRef<HTMLInputElement>(null);
  const lowerInputRef = useRef<HTMLInputElement>(null);

  // State
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [caseId, setCaseId] = useState("");

  useEffect(() => {
    fetchPatients()
      .then(({ patients }) => { setPatients(patients); setPatientsLoading(false); })
      .catch(() => setPatientsLoading(false));
  }, []);

  const filteredPatients = patients.filter((p) =>
    `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreatePatient() {
    if (!newFirst.trim() || !newLast.trim()) return;
    setWorking(true);
    setError("");
    try {
      const p = await createPatient({
        firstName: newFirst.trim(),
        lastName: newLast.trim(),
        dateOfBirth: newDob || undefined,
      });
      setPatients((prev) => [...prev, p]);
      setSelectedPatient(p);
      setShowCreate(false);
      setStep("case");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create patient");
    } finally {
      setWorking(false);
    }
  }

  async function handleCreateCase() {
    if (!selectedPatient) return;
    setWorking(true);
    setError("");
    try {
      const c = await createCase({
        patientId: selectedPatient.id,
        chiefComplaint: chiefComplaint.trim() || undefined,
        malocclusionClass: malocclusionClass || undefined,
        notes: notes.trim() || undefined,
      });
      setCaseId(c.id);
      setStep("scans");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create case");
    } finally {
      setWorking(false);
    }
  }

  async function handleUploadScans() {
    setWorking(true);
    setError("");
    try {
      if (upperFile) await uploadScan(caseId, upperFile, "maxillary");
      if (lowerFile) await uploadScan(caseId, lowerFile, "mandibular");
      setStep("done");
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "Upload failed — you can upload scans later from the case page."
      );
    } finally {
      setWorking(false);
    }
  }

  function navigateToCase() {
    onCreated(caseId);
    router.push(`/cases/${caseId}`);
  }

  const STEP_LABELS: Record<Step, string> = {
    patient: "Step 1 of 3",
    case: "Step 2 of 3",
    scans: "Step 3 of 3",
    done: "Complete",
  };

  const STEP_TITLES: Record<Step, string> = {
    patient: "Select Patient",
    case: "Case Details",
    scans: "Upload Scans",
    done: "Case Created",
  };

  const ORDERED_STEPS: Step[] = ["patient", "case", "scans"];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-lg rounded-t-3xl border border-[color:var(--border)] bg-[color:var(--background)] shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-[color:var(--border)] sm:hidden" />

        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[color:var(--border)] px-5 py-4">
          {step !== "patient" && step !== "done" && (
            <button
              type="button"
              onClick={() => { setError(""); setStep(step === "case" ? "patient" : "case"); }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] transition-transform active:scale-90"
            >
              <ArrowLeft size={15} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
              {STEP_LABELS[step]}
            </p>
            <h2 className="text-base font-bold text-[color:var(--foreground)]">
              {STEP_TITLES[step]}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--foreground)] transition-transform active:scale-90"
          >
            <X size={15} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-5 pt-3">
          {ORDERED_STEPS.map((s, i) => (
            <div
              key={s}
              className={[
                "h-1 flex-1 rounded-full transition-colors",
                step === "done" || ORDERED_STEPS.indexOf(step as Step) >= i
                  ? "bg-[color:var(--primary)]"
                  : "bg-[color:var(--border)]",
              ].join(" ")}
            />
          ))}
        </div>

        {/* Scrollable content */}
        <div className="max-h-[62vh] overflow-y-auto px-5 pb-2 pt-4">

          {/* ── Step 1: Patient ── */}
          {step === "patient" && !showCreate && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5">
                <Search size={15} className="shrink-0 text-[color:var(--muted-foreground)]" />
                <input
                  autoFocus
                  type="search"
                  placeholder="Search patients…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
                />
              </div>

              {patientsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 size={18} className="animate-spin text-[color:var(--muted-foreground)]" />
                </div>
              ) : filteredPatients.length > 0 ? (
                <div className="space-y-1.5">
                  {filteredPatients.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedPatient(p); setStep("case"); }}
                      className="flex w-full items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-3 text-left transition-colors hover:border-[color:var(--primary)] active:scale-[0.99]"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-sm font-bold text-[color:var(--primary)]">
                        {p.firstName[0]}{p.lastName[0]}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">
                          {p.fullName}
                        </p>
                        <p className="text-xs text-[color:var(--muted-foreground)]">
                          {p.caseCount} case{p.caseCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <ArrowRight size={14} className="shrink-0 text-[color:var(--muted-foreground)]" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="py-3 text-center text-sm text-[color:var(--muted-foreground)]">
                  {search ? `No patients matching "${search}"` : "No patients yet"}
                </p>
              )}

              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-[color:var(--border)] px-3 py-3 text-sm font-semibold text-[color:var(--primary)] transition-colors hover:border-[color:var(--primary)]"
              >
                <Plus size={15} />
                Create new patient
              </button>
            </div>
          )}

          {/* ── Step 1: Create new patient form ── */}
          {step === "patient" && showCreate && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setError(""); }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
              >
                <ArrowLeft size={13} /> Back to search
              </button>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
                    First name *
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={newFirst}
                    onChange={(e) => setNewFirst(e.target.value)}
                    placeholder="First"
                    className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
                    Last name *
                  </label>
                  <input
                    type="text"
                    value={newLast}
                    onChange={(e) => setNewLast(e.target.value)}
                    placeholder="Last"
                    className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
                  Date of birth
                </label>
                <input
                  type="date"
                  value={newDob}
                  onChange={(e) => setNewDob(e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)]"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleCreatePatient}
                disabled={working || !newFirst.trim() || !newLast.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] py-3 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
              >
                {working ? <Loader2 size={15} className="animate-spin" /> : <User size={15} />}
                Create Patient
              </button>
            </div>
          )}

          {/* ── Step 2: Case details ── */}
          {step === "case" && (
            <div className="space-y-4">
              {selectedPatient && (
                <div className="flex items-center gap-2.5 rounded-xl bg-[color:var(--primary-glow)] px-3 py-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] text-xs font-bold text-white">
                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                  </span>
                  <span className="text-sm font-semibold text-[color:var(--primary)]">
                    {selectedPatient.fullName}
                  </span>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
                  Chief complaint
                </label>
                <input
                  autoFocus
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder="e.g. Crowding, spacing, Class II…"
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
                  Malocclusion class
                </label>
                <select
                  value={malocclusionClass}
                  onChange={(e) => setMalocclusionClass(e.target.value)}
                  className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)]"
                >
                  <option value="">Select class</option>
                  <option value="class_i">Class I</option>
                  <option value="class_ii">Class II</option>
                  <option value="class_iii">Class III</option>
                  <option value="open_bite">Open Bite</option>
                  <option value="deep_bite">Deep Bite</option>
                  <option value="crossbite">Crossbite</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
                  Clinical notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional clinical observations…"
                  className="w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)]"
                />
              </div>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleCreateCase}
                disabled={working}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] py-3 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
              >
                {working ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                Create Case
              </button>
            </div>
          )}

          {/* ── Step 3: Upload scans ── */}
          {step === "scans" && (
            <div className="space-y-4">
              <p className="text-sm text-[color:var(--muted-foreground)]">
                Upload STL, OBJ, or PLY files for upper and/or lower arch. You can skip and upload later.
              </p>

              {/* Upper arch */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[color:var(--foreground)]">
                  Upper arch (maxillary)
                </label>
                <input
                  ref={upperInputRef}
                  type="file"
                  accept=".stl,.obj,.ply"
                  className="hidden"
                  onChange={(e) => setUpperFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => upperInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-[color:var(--border)] px-4 py-3.5 text-sm transition-colors hover:border-[color:var(--primary)]"
                >
                  <Upload size={16} className="shrink-0 text-[color:var(--muted-foreground)]" />
                  {upperFile ? (
                    <span className="min-w-0 flex-1 truncate text-left font-medium text-[color:var(--foreground)]">
                      {upperFile.name}
                    </span>
                  ) : (
                    <span className="text-[color:var(--muted-foreground)]">
                      Select upper arch scan
                    </span>
                  )}
                  {upperFile && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setUpperFile(null); }}
                      className="shrink-0 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </button>
              </div>

              {/* Lower arch */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[color:var(--foreground)]">
                  Lower arch (mandibular)
                </label>
                <input
                  ref={lowerInputRef}
                  type="file"
                  accept=".stl,.obj,.ply"
                  className="hidden"
                  onChange={(e) => setLowerFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => lowerInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-dashed border-[color:var(--border)] px-4 py-3.5 text-sm transition-colors hover:border-[color:var(--primary)]"
                >
                  <Upload size={16} className="shrink-0 text-[color:var(--muted-foreground)]" />
                  {lowerFile ? (
                    <span className="min-w-0 flex-1 truncate text-left font-medium text-[color:var(--foreground)]">
                      {lowerFile.name}
                    </span>
                  ) : (
                    <span className="text-[color:var(--muted-foreground)]">
                      Select lower arch scan
                    </span>
                  )}
                  {lowerFile && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setLowerFile(null); }}
                      className="shrink-0 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
                    >
                      <X size={14} />
                    </button>
                  )}
                </button>
              </div>

              {error && (
                <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep("done")}
                  disabled={working}
                  className="flex flex-1 items-center justify-center rounded-xl border border-[color:var(--border)] py-3 text-sm font-semibold text-[color:var(--foreground)] transition-transform active:scale-95"
                >
                  Skip for now
                </button>
                <button
                  type="button"
                  onClick={handleUploadScans}
                  disabled={working || (!upperFile && !lowerFile)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] py-3 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
                >
                  {working ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                  Upload
                </button>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Check size={28} strokeWidth={2.5} />
              </span>
              <div>
                <p className="text-base font-bold text-[color:var(--foreground)]">Case created!</p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                  The patient case is ready. Open it to upload scans, run AI segmentation, and start treatment planning.
                </p>
              </div>
              <button
                type="button"
                onClick={navigateToCase}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] py-3 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
              >
                Open Case
                <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>

        <div style={{ height: "max(env(safe-area-inset-bottom, 0px), 12px)" }} />
      </div>
    </div>
  );
}
