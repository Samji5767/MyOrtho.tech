'use client';

import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  BarChart2,
  CheckCircle2,
  Loader2,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Button, Card, ProgressBar, StatusBadge } from '@/components/DesignSystem';
import { api } from '@/lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type AngleClass = 'Class I' | 'Class II Div 1' | 'Class II Div 2' | 'Class III';

interface AnalysisForm {
  overjet: string;
  overbite: string;
  crowdingUpper: string;
  crowdingLower: string;
  angleClass: AngleClass;
  upperArchWidth: string;
  lowerArchWidth: string;
}

interface BoltonResult {
  overallRatio: number;
  overallReference: number;
  overallStatus: 'excess_upper' | 'excess_lower' | 'balanced';
  overallDiscrepancyMm: number;
  anteriorRatio: number;
  anteriorReference: number;
  anteriorDiscrepancyMm: number;
}

interface ArchMeasurements {
  upperCrowdingMm: number;
  lowerCrowdingMm: number;
  upperSpacingMm: number;
  lowerSpacingMm: number;
  aldUpper: number;
  aldLower: number;
}

interface OcclusalFindings {
  overjet: number;
  overbite: number;
  overbitePercent: number;
  angleClass: AngleClass;
  molarRelationRight?: string;
  molarRelationLeft?: string;
  canineRelationRight?: string;
  canineRelationLeft?: string;
  midlineDeviationMm?: number;
  midlineDevDir?: 'upper' | 'lower' | 'both' | null;
}

interface TransverseFindings {
  upperArchWidthMm: number;
  lowerArchWidthMm: number;
  transverseDiscrepancyMm: number;
  recommendation: 'constriction' | 'expansion' | 'balanced';
}

interface CurveOfSpee {
  depthMm: number;
  recommendation: 'leveling_needed' | 'acceptable' | 'flat';
}

interface DeepClinicalAnalysis {
  id: string;
  caseId: string;
  bolton: BoltonResult;
  archMeasurements: ArchMeasurements;
  occlusal: OcclusalFindings;
  transverse: TransverseFindings;
  curveOfSpee: CurveOfSpee;
  diagnosticSummary: string;
  confidence: number;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rangeStatus(
  value: number,
  min: number,
  max: number,
): 'normal' | 'low' | 'high' {
  if (value < min) return 'low';
  if (value > max) return 'high';
  return 'normal';
}

function rangeTone(status: 'normal' | 'low' | 'high'): 'success' | 'warning' | 'danger' {
  if (status === 'normal') return 'success';
  if (status === 'low') return 'warning';
  return 'danger';
}

function boltonStatusLabel(status: BoltonResult['overallStatus']): string {
  if (status === 'excess_upper') return 'Excess Upper';
  if (status === 'excess_lower') return 'Excess Lower';
  return 'Balanced';
}

function boltonTone(status: BoltonResult['overallStatus']): 'success' | 'warning' {
  return status === 'balanced' ? 'success' : 'warning';
}

function crowdingTone(mm: number): 'success' | 'warning' | 'danger' {
  if (mm <= 0) return 'success';
  if (mm <= 4) return 'warning';
  return 'danger';
}

function transverseTone(rec: TransverseFindings['recommendation']): 'success' | 'warning' {
  return rec === 'balanced' ? 'success' : 'warning';
}

function curveOfSeeTone(mm: number): 'success' | 'warning' | 'danger' {
  if (mm <= 1.5) return 'success';
  if (mm <= 2.5) return 'warning';
  return 'danger';
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({
  label,
  value,
  unit,
  normalRange,
  tone,
}: {
  label: string;
  value: number;
  unit?: string;
  normalRange?: string;
  tone?: 'success' | 'warning' | 'danger';
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
      <span className="text-xs text-secondary">{label}</span>
      <div className="flex items-center gap-2">
        {normalRange && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">({normalRange})</span>
        )}
        <span className="text-sm font-semibold text-foreground tabular-nums">
          {value.toFixed(1)}{unit}
        </span>
        {tone && (
          tone === 'success'
            ? <CheckCircle2 size={13} className="text-emerald-500" />
            : tone === 'warning'
            ? <AlertTriangle size={13} className="text-amber-500" />
            : <XCircle size={13} className="text-rose-500" />
        )}
      </div>
    </div>
  );
}

// ─── Crowding Bar ─────────────────────────────────────────────────────────────

function CrowdingBar({ label, mm }: { label: string; mm: number }) {
  const tone = crowdingTone(mm);
  const label2 = mm > 0 ? `${mm.toFixed(1)} mm crowding` : mm < 0 ? `${Math.abs(mm).toFixed(1)} mm spacing` : 'Balanced';
  const displayValue = Math.min(100, Math.abs(mm) * 10);

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-foreground">{label}</span>
        <span className={`font-semibold tabular-nums ${tone === 'success' ? 'text-emerald-600' : tone === 'warning' ? 'text-amber-600' : 'text-rose-600'}`}>
          {label2}
        </span>
      </div>
      <ProgressBar value={displayValue} tone={mm <= 0 ? 'success' : tone} />
    </div>
  );
}

// ─── Input field ─────────────────────────────────────────────────────────────

function NumericInput({
  label,
  unit,
  value,
  onChange,
  disabled,
  min,
  max,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-secondary block">{label}</label>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          min={min}
          max={max}
          step={0.1}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
        />
        {unit && <span className="text-xs text-secondary shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClinicalAnalysisDeepPanel({
  caseId,
  uploadId,
  token,
}: {
  caseId: string;
  uploadId?: string;
  token: string;
}) {
  const [form, setForm] = useState<AnalysisForm>({
    overjet: '',
    overbite: '',
    crowdingUpper: '',
    crowdingLower: '',
    angleClass: 'Class I',
    upperArchWidth: '',
    lowerArchWidth: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<DeepClinicalAnalysis | null>(null);

  function setField(key: keyof AnalysisForm, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function isFormValid(): boolean {
    return (
      form.overjet !== '' &&
      form.overbite !== '' &&
      form.crowdingUpper !== '' &&
      form.crowdingLower !== '' &&
      form.upperArchWidth !== '' &&
      form.lowerArchWidth !== ''
    );
  }

  const handleSubmit = useCallback(async () => {
    if (!isFormValid()) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        caseId,
        uploadId,
        overjet: parseFloat(form.overjet),
        overbite: parseFloat(form.overbite),
        crowdingUpper: parseFloat(form.crowdingUpper),
        crowdingLower: parseFloat(form.crowdingLower),
        angleClass: form.angleClass,
        upperArchWidth: parseFloat(form.upperArchWidth),
        lowerArchWidth: parseFloat(form.lowerArchWidth),
      };
      const result = await api.post<DeepClinicalAnalysis>('/api/clinical-analysis-deep', payload);
      setAnalysis(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setSubmitting(false);
    }
  }, [form, caseId, uploadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const oj = analysis ? rangeStatus(analysis.occlusal.overjet, 0, 3) : 'normal';
  const ob = analysis ? rangeStatus(analysis.occlusal.overbitePercent, 10, 30) : 'normal';

  return (
    <div className="space-y-5">
      {/* Form */}
      <Card className="p-5 space-y-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-0.5">Clinical Analysis</p>
          <h3 className="text-base font-semibold text-foreground">Enter Direct Measurements</h3>
          <p className="text-xs text-secondary mt-1">
            Provide intraoral measurements to generate comprehensive AI clinical analysis.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NumericInput
            label="Overjet"
            unit="mm"
            value={form.overjet}
            onChange={(v) => setField('overjet', v)}
            disabled={submitting}
          />
          <NumericInput
            label="Overbite"
            unit="mm"
            value={form.overbite}
            onChange={(v) => setField('overbite', v)}
            disabled={submitting}
          />
          <NumericInput
            label="Crowding Upper"
            unit="mm"
            value={form.crowdingUpper}
            onChange={(v) => setField('crowdingUpper', v)}
            disabled={submitting}
            min={-20}
            max={20}
          />
          <NumericInput
            label="Crowding Lower"
            unit="mm"
            value={form.crowdingLower}
            onChange={(v) => setField('crowdingLower', v)}
            disabled={submitting}
            min={-20}
            max={20}
          />
          <NumericInput
            label="Upper Arch Width"
            unit="mm"
            value={form.upperArchWidth}
            onChange={(v) => setField('upperArchWidth', v)}
            disabled={submitting}
          />
          <NumericInput
            label="Lower Arch Width"
            unit="mm"
            value={form.lowerArchWidth}
            onChange={(v) => setField('lowerArchWidth', v)}
            disabled={submitting}
          />
        </div>

        {/* Angle Class */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-secondary block">Angle Classification</label>
          <div className="flex flex-wrap gap-2">
            {(['Class I', 'Class II Div 1', 'Class II Div 2', 'Class III'] as AngleClass[]).map((cls) => (
              <button
                key={cls}
                onClick={() => setField('angleClass', cls)}
                disabled={submitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-50 ${
                  form.angleClass === cls
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-secondary hover:bg-slate-50 dark:hover:bg-slate-900'
                }`}
              >
                {cls}
              </button>
            ))}
          </div>
        </div>

        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={submitting || !isFormValid()}
          className="w-full"
        >
          {submitting ? (
            <><Loader2 size={14} className="animate-spin" /> Generating Analysis…</>
          ) : (
            <><BarChart2 size={14} /> Generate Clinical Analysis</>
          )}
        </Button>

        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <AlertTriangle size={12} /> {error}
          </p>
        )}
      </Card>

      {/* Results */}
      {analysis && (
        <>
          {/* Bolton Analysis */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground flex-1">Bolton Analysis</h3>
              <StatusBadge tone={boltonTone(analysis.bolton.overallStatus)}>
                {boltonStatusLabel(analysis.bolton.overallStatus)}
              </StatusBadge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Overall ratio */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-secondary">Overall Ratio (12 teeth)</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {analysis.bolton.overallRatio.toFixed(1)}%
                  </span>
                  <span className="text-xs text-secondary">ref: {analysis.bolton.overallReference}%</span>
                </div>
                <ProgressBar
                  value={Math.min(100, (analysis.bolton.overallRatio / 100) * 100)}
                  tone={boltonTone(analysis.bolton.overallStatus)}
                />
                <p className="text-xs text-secondary">
                  Discrepancy:{' '}
                  <span className="font-semibold text-foreground">
                    {analysis.bolton.overallDiscrepancyMm > 0 ? '+' : ''}
                    {analysis.bolton.overallDiscrepancyMm.toFixed(2)} mm
                  </span>
                </p>
              </div>

              {/* Anterior ratio */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border p-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-secondary">Anterior Ratio (6 teeth)</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground tabular-nums">
                    {analysis.bolton.anteriorRatio.toFixed(1)}%
                  </span>
                  <span className="text-xs text-secondary">ref: {analysis.bolton.anteriorReference}%</span>
                </div>
                <ProgressBar
                  value={Math.min(100, (analysis.bolton.anteriorRatio / 90) * 100)}
                  tone="primary"
                />
                <p className="text-xs text-secondary">
                  Discrepancy:{' '}
                  <span className="font-semibold text-foreground">
                    {analysis.bolton.anteriorDiscrepancyMm > 0 ? '+' : ''}
                    {analysis.bolton.anteriorDiscrepancyMm.toFixed(2)} mm
                  </span>
                </p>
              </div>
            </div>
          </Card>

          {/* Arch Measurements */}
          <Card className="p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Arch Measurements</h3>
            <div className="space-y-3">
              <CrowdingBar label="Upper Arch" mm={analysis.archMeasurements.upperCrowdingMm} />
              <CrowdingBar label="Lower Arch" mm={analysis.archMeasurements.lowerCrowdingMm} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-border p-3">
                <p className="text-[10px] text-secondary uppercase tracking-wide font-bold">Upper ALD</p>
                <p className="text-lg font-bold text-foreground tabular-nums mt-1">
                  {analysis.archMeasurements.aldUpper.toFixed(1)} mm
                </p>
              </div>
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-border p-3">
                <p className="text-[10px] text-secondary uppercase tracking-wide font-bold">Lower ALD</p>
                <p className="text-lg font-bold text-foreground tabular-nums mt-1">
                  {analysis.archMeasurements.aldLower.toFixed(1)} mm
                </p>
              </div>
            </div>
          </Card>

          {/* Occlusal Findings */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground flex-1">Occlusal Findings</h3>
              <StatusBadge tone="neutral">{analysis.occlusal.angleClass}</StatusBadge>
            </div>

            <div className="space-y-0">
              <StatRow
                label="Overjet"
                value={analysis.occlusal.overjet}
                unit=" mm"
                normalRange="0–3 mm"
                tone={rangeTone(oj)}
              />
              <StatRow
                label="Overbite"
                value={analysis.occlusal.overbite}
                unit=" mm"
                normalRange="1–3 mm"
                tone={rangeTone(rangeStatus(analysis.occlusal.overbite, 1, 3))}
              />
              <StatRow
                label="Overbite %"
                value={analysis.occlusal.overbitePercent}
                unit="%"
                normalRange="10–30%"
                tone={rangeTone(ob)}
              />
            </div>

            {(analysis.occlusal.molarRelationRight || analysis.occlusal.molarRelationLeft) && (
              <div className="grid grid-cols-2 gap-3">
                {analysis.occlusal.molarRelationRight && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-border p-3">
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-wide">Molar — Right</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{analysis.occlusal.molarRelationRight}</p>
                  </div>
                )}
                {analysis.occlusal.molarRelationLeft && (
                  <div className="rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-border p-3">
                    <p className="text-[10px] text-secondary font-bold uppercase tracking-wide">Molar — Left</p>
                    <p className="text-sm font-semibold text-foreground mt-1">{analysis.occlusal.molarRelationLeft}</p>
                  </div>
                )}
              </div>
            )}

            {analysis.occlusal.midlineDeviationMm != null && analysis.occlusal.midlineDeviationMm !== 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
                  Midline deviation ({analysis.occlusal.midlineDevDir ?? 'unknown'})
                </span>
                <span className="text-sm font-bold text-amber-700 dark:text-amber-400 tabular-nums">
                  {analysis.occlusal.midlineDeviationMm.toFixed(1)} mm
                </span>
              </div>
            )}
          </Card>

          {/* Transverse */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground flex-1">Transverse Analysis</h3>
              <StatusBadge tone={transverseTone(analysis.transverse.recommendation)}>
                {analysis.transverse.recommendation === 'balanced'
                  ? 'Balanced'
                  : analysis.transverse.recommendation === 'expansion'
                  ? 'Expansion Needed'
                  : 'Constriction'}
              </StatusBadge>
            </div>
            <div className="space-y-0">
              <StatRow label="Upper Arch Width" value={analysis.transverse.upperArchWidthMm} unit=" mm" />
              <StatRow label="Lower Arch Width" value={analysis.transverse.lowerArchWidthMm} unit=" mm" />
              <StatRow
                label="Transverse Discrepancy"
                value={analysis.transverse.transverseDiscrepancyMm}
                unit=" mm"
                tone={analysis.transverse.recommendation === 'balanced' ? 'success' : 'warning'}
              />
            </div>
          </Card>

          {/* Curve of Spee */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-primary" />
              <h3 className="text-sm font-semibold text-foreground flex-1">Curve of Spee</h3>
              <StatusBadge tone={curveOfSeeTone(analysis.curveOfSpee.depthMm)}>
                {analysis.curveOfSpee.recommendation === 'leveling_needed'
                  ? 'Leveling Needed'
                  : analysis.curveOfSpee.recommendation === 'flat'
                  ? 'Flat'
                  : 'Acceptable'}
              </StatusBadge>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-secondary">Depth</span>
                <span className="font-bold text-foreground tabular-nums">
                  {analysis.curveOfSpee.depthMm.toFixed(1)} mm
                </span>
              </div>
              <ProgressBar
                value={Math.min(100, analysis.curveOfSpee.depthMm * 25)}
                tone={curveOfSeeTone(analysis.curveOfSpee.depthMm)}
              />
              <p className="text-xs text-secondary">
                {analysis.curveOfSpee.depthMm > 2
                  ? 'Leveling recommended: &gt;2 mm depth requires correction.'
                  : 'Curve within acceptable range.'}
              </p>
            </div>
          </Card>

          {/* Diagnostic Summary */}
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground flex-1">AI Diagnostic Summary</h3>
              <StatusBadge tone={analysis.confidence >= 0.85 ? 'success' : analysis.confidence >= 0.6 ? 'warning' : 'danger'}>
                {Math.round(analysis.confidence * 100)}% confidence
              </StatusBadge>
            </div>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-border p-4">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {analysis.diagnosticSummary}
              </p>
            </div>
            <p className="text-[10px] text-secondary">
              Generated on {new Date(analysis.createdAt).toLocaleString()} · Case {caseId}
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
