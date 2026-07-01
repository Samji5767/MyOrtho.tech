'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  BarChart2,
  Bot,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Cpu,
  Grid3x3,
  Hash,
  Layers,
  Loader2,
  Move3d,
  Package,
  Play,
  RefreshCw,
  ShieldCheck,
  Target,
  Upload,
  Zap,
} from 'lucide-react';
import { Card, Button, ProgressBar, StatusBadge, Spinner } from '@/components/DesignSystem';
import { api } from '@/lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StepData {
  step: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  completedAt?: string;
  summary?: string;
  outputRef?: string;
}

interface Pipeline {
  currentStep: number;
  stepsCompleted: number;
  overallStatus: 'idle' | 'in_progress' | 'completed' | 'failed';
  stepsData: StepData[];
  stlUploadId?: string;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { step: 1,  label: 'Scan Upload',      icon: Upload,          description: 'Upload STL scan file' },
  { step: 2,  label: 'Scan Validation',  icon: ShieldCheck,     description: 'AI mesh integrity check' },
  { step: 3,  label: 'Scan Processing',  icon: Cpu,             description: 'Orient, trim, normalize' },
  { step: 4,  label: 'Tooth Segmentation', icon: Grid3x3,       description: 'AI tooth boundary detection' },
  { step: 5,  label: 'Tooth ID',         icon: Hash,            description: 'FDI numbering & classification' },
  { step: 6,  label: 'Clinical Analysis', icon: BarChart2,      description: 'Bolton, ALD, occlusion' },
  { step: 7,  label: 'Treatment Goals',  icon: Target,          description: 'AI treatment objectives' },
  { step: 8,  label: 'CAD Workspace',    icon: Move3d,          description: 'Tooth movement editor' },
  { step: 9,  label: 'Biomechanics',     icon: Zap,             description: 'PDL stress & feasibility' },
  { step: 10, label: 'AI Assistant',     icon: Bot,             description: 'Clinical suggestions' },
  { step: 11, label: 'Stage Generation', icon: Layers,          description: 'Aligner staging' },
  { step: 12, label: 'Simulation',       icon: Play,            description: 'Treatment animation' },
  { step: 13, label: 'QA Check',         icon: ClipboardCheck,  description: 'Safety & quality scores' },
  { step: 14, label: 'Manufacturing',    icon: Package,         description: 'Export & production' },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStepStatus(pipeline: Pipeline, step: number): StepData['status'] {
  const found = pipeline.stepsData.find((s) => s.step === step);
  if (found) return found.status;
  if (step < pipeline.currentStep) return 'completed';
  if (step === pipeline.currentStep) return 'active';
  return 'pending';
}

function getStepSummary(pipeline: Pipeline, step: number): string | undefined {
  return pipeline.stepsData.find((s) => s.step === step)?.summary;
}

function overallPercent(pipeline: Pipeline): number {
  return Math.round((pipeline.stepsCompleted / 14) * 100);
}

// ─── Step Status Icon ─────────────────────────────────────────────────────────

function StepStatusIcon({ status }: { status: StepData['status'] }) {
  if (status === 'completed')
    return <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />;
  if (status === 'active')
    return <Loader2 size={18} className="text-blue-500 animate-spin shrink-0" />;
  if (status === 'failed')
    return <Circle size={18} className="text-rose-500 shrink-0" />;
  return <Circle size={18} className="text-slate-300 dark:text-slate-600 shrink-0" />;
}

// ─── Step Row ─────────────────────────────────────────────────────────────────

function StepRow({
  def,
  status,
  summary,
  isSelected,
  onClick,
}: {
  def: (typeof PIPELINE_STEPS)[number];
  status: StepData['status'];
  summary?: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  const Icon = def.icon;

  const rowBg =
    isSelected
      ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
      : status === 'active'
      ? 'bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800'
      : status === 'completed'
      ? 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40'
      : 'border-slate-100 dark:border-slate-800 opacity-60';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer ${rowBg}`}
    >
      <div className="mt-0.5">
        <StepStatusIcon status={status} />
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 w-5 text-right">
          {def.step}
        </span>
        <span className="p-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
          <Icon size={12} />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{def.label}</p>
          {status === 'active' && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 shrink-0">
              Active
            </span>
          )}
          {status === 'completed' && (
            <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400 shrink-0">
              Done
            </span>
          )}
        </div>
        <p className="text-xs text-secondary mt-0.5">{def.description}</p>
        {summary && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic truncate">{summary}</p>
        )}
      </div>
    </button>
  );
}

// ─── Right Panel ──────────────────────────────────────────────────────────────

function ActiveStepPanel({
  step,
  pipeline,
  caseId,
  token,
  onAdvance,
  advancing,
}: {
  step: number | null;
  pipeline: Pipeline;
  caseId: string;
  token: string;
  onAdvance: () => void;
  advancing: boolean;
}) {
  if (step === null) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <Circle size={40} className="text-slate-200 dark:text-slate-700" />
        <p className="text-sm text-secondary">Select a step to view details</p>
      </div>
    );
  }

  const def = PIPELINE_STEPS[step - 1];
  const status = getStepStatus(pipeline, step);
  const summary = getStepSummary(pipeline, step);
  const isCurrentStep = pipeline.currentStep === step;
  const Icon = def.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
          <Icon size={22} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-xs text-secondary uppercase tracking-widest font-bold">Step {step}</p>
          <h3 className="text-lg font-semibold text-foreground">{def.label}</h3>
          <p className="text-sm text-secondary">{def.description}</p>
        </div>
        <div className="ml-auto">
          <StatusBadge
            tone={
              status === 'completed' ? 'success'
              : status === 'active' ? 'info'
              : status === 'failed' ? 'danger'
              : 'neutral'
            }
          >
            {status === 'active' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
          </StatusBadge>
        </div>
      </div>

      {status === 'completed' && summary && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-1">Step Output</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{summary}</p>
        </div>
      )}

      {status === 'active' && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 size={14} className="text-blue-500 animate-spin" />
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Processing…</p>
          </div>
          <p className="text-xs text-blue-700 dark:text-blue-400">
            This step is currently running. Results will appear when complete.
          </p>
        </div>
      )}

      {status === 'pending' && isCurrentStep && (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 p-4">
          <p className="text-sm text-secondary">
            This step is ready to begin. Click &ldquo;Advance Pipeline&rdquo; to proceed.
          </p>
        </div>
      )}

      {isCurrentStep && status !== 'completed' && (
        <Button
          variant="primary"
          onClick={onAdvance}
          disabled={advancing}
          className="w-full"
        >
          {advancing ? (
            <><Loader2 size={14} className="animate-spin" /> Processing…</>
          ) : (
            <>Next Step →</>
          )}
        </Button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TreatmentPipelinePanel({
  caseId,
  token,
}: {
  caseId: string;
  token: string;
}) {
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStep, setSelectedStep] = useState<number | null>(null);
  const [advancing, setAdvancing] = useState(false);

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Pipeline>(`/api/stl/pipeline/${caseId}`);
      setPipeline(data);
      if (selectedStep === null) {
        setSelectedStep(data.currentStep);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load pipeline');
    } finally {
      setLoading(false);
    }
  }, [caseId, selectedStep]);

  useEffect(() => {
    void loadPipeline();
  }, [caseId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAdvance = useCallback(async () => {
    if (!pipeline) return;
    setAdvancing(true);
    try {
      const updated = await api.post<Pipeline>(`/api/stl/pipeline/${caseId}/advance`, {
        currentStep: pipeline.currentStep,
      });
      setPipeline(updated);
      setSelectedStep(updated.currentStep);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to advance pipeline');
    } finally {
      setAdvancing(false);
    }
  }, [caseId, pipeline]);

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <Spinner size={18} />
          <p className="text-sm text-secondary">Loading treatment pipeline…</p>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse"
            />
          ))}
        </div>
      </Card>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (error && !pipeline) {
    return (
      <Card className="p-6">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void loadPipeline()}>
            <RefreshCw size={14} /> Retry
          </Button>
        </div>
      </Card>
    );
  }

  if (!pipeline) return null;

  const percent = overallPercent(pipeline);

  return (
    <Card className="p-0 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border bg-slate-50 dark:bg-slate-900/50">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Treatment Pipeline</p>
            <h2 className="mt-0.5 text-lg font-semibold text-foreground">Case {caseId}</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge
              tone={
                pipeline.overallStatus === 'completed' ? 'success'
                : pipeline.overallStatus === 'in_progress' ? 'info'
                : pipeline.overallStatus === 'failed' ? 'danger'
                : 'neutral'
              }
            >
              {pipeline.overallStatus === 'in_progress'
                ? 'In Progress'
                : pipeline.overallStatus.charAt(0).toUpperCase() + pipeline.overallStatus.slice(1)}
            </StatusBadge>
            <Button variant="ghost" size="icon" onClick={() => void loadPipeline()}>
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs text-secondary">
            <span>
              {pipeline.stepsCompleted} of 14 steps completed
            </span>
            <span className="font-semibold text-foreground">{percent}%</span>
          </div>
          <ProgressBar
            value={percent}
            tone={
              pipeline.overallStatus === 'completed'
                ? 'success'
                : pipeline.overallStatus === 'failed'
                ? 'danger'
                : 'primary'
            }
          />
        </div>

        {error && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
        )}
      </div>

      {/* Body */}
      <div className="flex h-[calc(100vh-280px)] min-h-[500px]">
        {/* Left: Stepper */}
        <div className="w-72 shrink-0 border-r border-border overflow-y-auto p-3 space-y-1">
          {PIPELINE_STEPS.map((def) => {
            const status = getStepStatus(pipeline, def.step);
            const summary = getStepSummary(pipeline, def.step);
            return (
              <StepRow
                key={def.step}
                def={def}
                status={status}
                summary={summary}
                isSelected={selectedStep === def.step}
                onClick={() => setSelectedStep(def.step)}
              />
            );
          })}
        </div>

        {/* Right: Detail */}
        <div className="flex-1 overflow-y-auto p-5">
          <ActiveStepPanel
            step={selectedStep}
            pipeline={pipeline}
            caseId={caseId}
            token={token}
            onAdvance={() => void handleAdvance()}
            advancing={advancing}
          />
        </div>
      </div>
    </Card>
  );
}
