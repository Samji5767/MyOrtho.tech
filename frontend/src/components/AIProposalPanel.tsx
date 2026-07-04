"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Brain,
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { Card, StatusBadge } from "@/components/DesignSystem";
import {
  listProposals,
  generateProposal,
  reviewProposal,
  ANGLE_CLASS_LABELS,
  type AIProposal,
  type AngleClass,
} from "@/lib/api/aiProposal";

// ─── Disclaimer ───────────────────────────────────────────────────────────────

function AIDisclaimer() {
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
      <span>
        <strong>Clinical decision support only.</strong> AI treatment proposals are automated suggestions based on clinical measurements. All outputs require clinician review and approval before any clinical action or export.
      </span>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function ProposalStatusBadge({ status }: { status: AIProposal["status"] }) {
  const map = {
    draft:    { label: "Draft",    tone: "neutral" as const },
    reviewed: { label: "Reviewed", tone: "info"    as const },
    accepted: { label: "Accepted", tone: "success" as const },
    rejected: { label: "Rejected", tone: "danger"  as const },
  };
  const { label, tone } = map[status];
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

// ─── Generate form ────────────────────────────────────────────────────────────

function GenerateForm({
  caseId,
  onGenerated,
}: {
  caseId: string;
  onGenerated: (p: AIProposal) => void;
}) {
  const [angleClass, setAngleClass] = useState<AngleClass | "">("");
  const [upperCrowding, setUpperCrowding] = useState("");
  const [lowerCrowding, setLowerCrowding] = useState("");
  const [overjet, setOverjet] = useState("");
  const [overbite, setOverbite] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setWorking(true);
    setError("");
    try {
      const p = await generateProposal(caseId, {
        angleClassification: angleClass || undefined,
        upperCrowdingMm: upperCrowding ? parseFloat(upperCrowding) : undefined,
        lowerCrowdingMm: lowerCrowding ? parseFloat(lowerCrowding) : undefined,
        overjetMm: overjet ? parseFloat(overjet) : undefined,
        overbitemm: overbite ? parseFloat(overbite) : undefined,
      });
      onGenerated(p);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to generate proposal");
    } finally {
      setWorking(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles size={16} className="text-[color:var(--primary)]" />
        <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
          Generate AI Proposal
        </h3>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
              Angle classification
            </label>
            <select
              value={angleClass}
              onChange={(e) => setAngleClass(e.target.value as AngleClass | "")}
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)]"
            >
              <option value="">Not specified</option>
              {(Object.keys(ANGLE_CLASS_LABELS) as AngleClass[]).map((k) => (
                <option key={k} value={k}>{ANGLE_CLASS_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
              Overjet (mm)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={overjet}
              onChange={(e) => setOverjet(e.target.value)}
              placeholder="e.g. 3.5"
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)] placeholder:text-[color:var(--muted-foreground)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
              Upper crowding (mm)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={upperCrowding}
              onChange={(e) => setUpperCrowding(e.target.value)}
              placeholder="e.g. 4.2"
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)] placeholder:text-[color:var(--muted-foreground)]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-[color:var(--foreground)]">
              Lower crowding (mm)
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={lowerCrowding}
              onChange={(e) => setLowerCrowding(e.target.value)}
              placeholder="e.g. 2.8"
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)] placeholder:text-[color:var(--muted-foreground)]"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={working}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] py-3 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95 disabled:opacity-50"
        >
          {working ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Sparkles size={15} />
          )}
          Generate Proposal
        </button>
      </div>
    </Card>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <span className="text-sm font-semibold text-[color:var(--foreground)]">{title}</span>
        {open ? <ChevronUp size={15} className="text-[color:var(--muted-foreground)]" /> : <ChevronDown size={15} className="text-[color:var(--muted-foreground)]" />}
      </button>
      {open && <div className="border-t border-[color:var(--border)] px-4 pb-4 pt-3">{children}</div>}
    </div>
  );
}

// ─── Proposal detail ──────────────────────────────────────────────────────────

function ProposalDetail({
  proposal,
  caseId,
  onReviewed,
}: {
  proposal: AIProposal;
  caseId: string;
  onReviewed: (p: AIProposal) => void;
}) {
  const [reviewNotes, setReviewNotes] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  async function handleReview(status: "accepted" | "rejected") {
    setWorking(true);
    setError("");
    try {
      const updated = await reviewProposal(caseId, proposal.id, { status, reviewNotes: reviewNotes.trim() || undefined });
      onReviewed(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setWorking(false);
    }
  }

  // Derive complexity color
  const complexityPct = proposal.complexityScore != null ? Math.round(proposal.complexityScore * 100) : null;
  const complexityColor =
    complexityPct == null ? ""
    : complexityPct >= 70 ? "bg-rose-500"
    : complexityPct >= 40 ? "bg-amber-500"
    : "bg-emerald-500";
  const complexityLabel =
    complexityPct == null ? ""
    : complexityPct >= 70 ? "High"
    : complexityPct >= 40 ? "Moderate"
    : "Low";

  const refinePct = proposal.refinementProbability != null ? Math.round(proposal.refinementProbability * 100) : null;

  return (
    <div className="space-y-3">
      {/* Status + date row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <ProposalStatusBadge status={proposal.status} />
          {proposal.angleClassification && (
            <span className="rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--foreground)]">
              {ANGLE_CLASS_LABELS[proposal.angleClassification]}
            </span>
          )}
          {proposal.treatmentPlanId && (
            <span className="rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--primary)]">
              Linked to plan
            </span>
          )}
        </div>
        <span className="text-xs text-[color:var(--muted-foreground)]">
          {new Date(proposal.generatedAt).toLocaleDateString()}
          {proposal.predictedDurationWeeks != null && (
            <> · ~{proposal.predictedDurationWeeks} weeks</>
          )}
        </span>
      </div>

      {/* AI insight cards */}
      {(proposal.estimatedStages != null || complexityPct != null || refinePct != null) && (
        <div className="grid grid-cols-3 gap-2">
          {proposal.estimatedStages != null && (
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-center">
              <p className="text-lg font-bold text-[color:var(--primary)]">{proposal.estimatedStages}</p>
              <p className="mt-0.5 text-[10px] font-medium text-[color:var(--muted-foreground)]">Est. Stages</p>
            </div>
          )}
          {complexityPct != null && (
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium text-[color:var(--muted-foreground)]">Complexity</p>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white ${complexityColor}`}>
                  {complexityLabel}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className={`h-full rounded-full transition-all duration-700 ${complexityColor}`} style={{ width: `${complexityPct}%` }} />
              </div>
              <p className="mt-1 text-xs font-semibold tabular-nums text-[color:var(--foreground)]">{complexityPct}%</p>
            </div>
          )}
          {refinePct != null && (
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
              <p className="text-[10px] font-medium text-[color:var(--muted-foreground)]">Refinement</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div className="h-full rounded-full bg-sky-500 transition-all duration-700" style={{ width: `${refinePct}%` }} />
              </div>
              <p className="mt-1 text-xs font-semibold tabular-nums text-[color:var(--foreground)]">{refinePct}%</p>
            </div>
          )}
        </div>
      )}

      {/* Ideal occlusion */}
      <Section title="Ideal Occlusion Targets">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-[color:var(--muted-foreground)]">Target overjet</dt>
            <dd className="font-semibold text-[color:var(--foreground)]">
              {proposal.idealOcclusion.targetOverjet} mm
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--muted-foreground)]">Target overbite</dt>
            <dd className="font-semibold text-[color:var(--foreground)]">
              {proposal.idealOcclusion.targetOverbite} mm
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--muted-foreground)]">Midline deviation</dt>
            <dd className="font-semibold text-[color:var(--foreground)]">
              {proposal.idealOcclusion.targetMidlineDeviation} mm
            </dd>
          </div>
          <div>
            <dt className="text-[color:var(--muted-foreground)]">Target class</dt>
            <dd className="font-semibold text-[color:var(--foreground)]">
              {proposal.idealOcclusion.targetAngleClass}
            </dd>
          </div>
        </dl>
      </Section>

      {/* Movement sequence */}
      {proposal.movementSequence.length > 0 && (
        <Section title="Movement Sequence">
          <div className="space-y-2">
            {proposal.movementSequence.map((phase) => (
              <div key={phase.phase} className="rounded-xl border border-[color:var(--border)] px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[color:var(--foreground)]">
                    Phase {phase.phase} — Stages {phase.stages}
                  </span>
                  {phase.priority && (
                    <StatusBadge tone="neutral">{phase.priority}</StatusBadge>
                  )}
                </div>
                <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                  {phase.description}
                </p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* IPR suggestions */}
      {proposal.suggestedIpr.length > 0 && (
        <Section title={`IPR Suggestions (${proposal.suggestedIpr.length})`}>
          <div className="space-y-1.5">
            {proposal.suggestedIpr.map((ipr, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs">
                <span className="font-semibold text-[color:var(--foreground)]">
                  {ipr.toothA} / {ipr.toothB}
                </span>
                <span className="text-[color:var(--muted-foreground)]">{ipr.amountMm} mm</span>
                <span className="ml-auto text-[color:var(--muted-foreground)]">Stage {ipr.stage}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Attachment suggestions */}
      {proposal.suggestedAttachments.length > 0 && (
        <Section title={`Attachment Suggestions (${proposal.suggestedAttachments.length})`}>
          <div className="space-y-1.5">
            {proposal.suggestedAttachments.map((att, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs">
                <span className="font-semibold text-[color:var(--foreground)]">
                  Tooth {att.tooth}
                </span>
                <span className="text-[color:var(--muted-foreground)]">{att.type}</span>
                <span className="ml-auto text-[color:var(--muted-foreground)]">Stage {att.stage}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Anchorage */}
      {proposal.anchorageRecs.length > 0 && (
        <Section title="Anchorage Recommendations">
          <ul className="space-y-1.5">
            {proposal.anchorageRecs.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-[color:var(--foreground)]">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--primary)]" />
                <span>
                  <strong>{rec.type}</strong>
                  {rec.location && <> · {rec.location}</>}
                  {rec.teeth && rec.teeth.length > 0 && <> · Teeth: {rec.teeth.join(", ")}</>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Expansion recommendations */}
      {proposal.expansionRecs.length > 0 && (
        <Section title={`Expansion Recommendations (${proposal.expansionRecs.length})`}>
          <div className="space-y-1.5">
            {proposal.expansionRecs.map((rec, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-[color:var(--border)] px-3 py-2 text-xs">
                <span className="font-semibold capitalize text-[color:var(--foreground)]">{rec.arch} arch</span>
                <span className="text-[color:var(--muted-foreground)]">{rec.type}</span>
                <span className="font-mono text-[color:var(--foreground)]">{rec.amountMm}mm</span>
                <span className="ml-auto text-[color:var(--muted-foreground)]">Stage {rec.stage}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* AI notes */}
      {proposal.aiNotes && (
        <Section title="AI Notes">
          <p className="text-xs text-[color:var(--foreground)]">{proposal.aiNotes}</p>
        </Section>
      )}

      {/* Clinician review */}
      {proposal.status === "draft" || proposal.status === "reviewed" ? (
        <Card className="p-4">
          <p className="mb-2 text-xs font-semibold text-[color:var(--foreground)]">Clinician Review</p>
          <textarea
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            rows={2}
            placeholder="Optional review notes…"
            className="mb-3 w-full resize-none rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2.5 text-xs text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)] placeholder:text-[color:var(--muted-foreground)]"
          />
          {error && (
            <p className="mb-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleReview("rejected")}
              disabled={working}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[color:var(--border)] py-2.5 text-xs font-semibold text-[color:var(--foreground)] transition-transform active:scale-95 disabled:opacity-50"
            >
              <X size={13} /> Reject
            </button>
            <button
              type="button"
              onClick={() => handleReview("accepted")}
              disabled={working}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
            >
              {working ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Accept
            </button>
          </div>
        </Card>
      ) : (
        <div className="rounded-xl border border-[color:var(--border)] px-4 py-3 text-xs text-[color:var(--muted-foreground)]">
          {proposal.status === "accepted" ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              ✓ Accepted by {proposal.reviewedByEmail ?? "clinician"} on{" "}
              {proposal.reviewedAt ? new Date(proposal.reviewedAt).toLocaleDateString() : "—"}
            </span>
          ) : (
            <span className="text-red-600 dark:text-red-400">
              ✗ Rejected by {proposal.reviewedByEmail ?? "clinician"} on{" "}
              {proposal.reviewedAt ? new Date(proposal.reviewedAt).toLocaleDateString() : "—"}
            </span>
          )}
          {proposal.reviewNotes && (
            <p className="mt-1 text-[color:var(--muted-foreground)]">{proposal.reviewNotes}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function AIProposalPanel({ caseId }: { caseId: string }) {
  const [proposals, setProposals] = useState<AIProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AIProposal | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listProposals(caseId);
      setProposals(list);
      if (list.length > 0) setSelected((prev) => prev ?? list[0]);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  function handleGenerated(p: AIProposal) {
    setProposals((prev) => [p, ...prev]);
    setSelected(p);
    setShowForm(false);
  }

  function handleReviewed(p: AIProposal) {
    setProposals((prev) => prev.map((x) => (x.id === p.id ? p : x)));
    setSelected(p);
  }

  return (
    <div className="space-y-4">
      <AIDisclaimer />

      {/* Header */}
      <div className="flex items-center gap-2">
        <Brain size={17} className="text-[color:var(--primary)]" />
        <h2 className="text-base font-semibold text-[color:var(--foreground)]">AI Treatment Proposals</h2>
        <button
          type="button"
          onClick={load}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)] text-[color:var(--muted-foreground)] transition-transform active:scale-90"
        >
          <RefreshCw size={14} />
        </button>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex h-8 items-center gap-1.5 rounded-full bg-[color:var(--primary)] px-3 text-xs font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
        >
          <Sparkles size={12} />
          Generate
        </button>
      </div>

      {/* Generate form */}
      {showForm && <GenerateForm caseId={caseId} onGenerated={handleGenerated} />}

      {loadError && (
        <div className="text-xs text-red-600 dark:text-red-400 px-1">{loadError}</div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-[color:var(--muted-foreground)]" />
        </div>
      ) : proposals.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
            <Brain size={22} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">No proposals yet</p>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
              Generate an AI treatment proposal using clinical measurements.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
          >
            <Sparkles size={14} />
            Generate Proposal
          </button>
        </Card>
      ) : (
        <>
          {/* Proposal selector */}
          {proposals.length > 1 && (
            <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
              {proposals.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className={[
                    "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
                    selected?.id === p.id
                      ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                      : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)]",
                  ].join(" ")}
                >
                  Proposal {proposals.length - i}
                </button>
              ))}
            </div>
          )}

          {/* Selected proposal */}
          {selected && (
            <ProposalDetail
              proposal={selected}
              caseId={caseId}
              onReviewed={handleReviewed}
            />
          )}
        </>
      )}
    </div>
  );
}
