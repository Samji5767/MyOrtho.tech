import { TreatmentMonitoringService } from './treatment-monitoring.service';

function makeService(queryFn: jest.Mock) {
  const svc = Object.create(TreatmentMonitoringService.prototype) as TreatmentMonitoringService;
  (svc as any).db = { query: queryFn };
  (svc as any).log = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
  return svc;
}

describe('TreatmentMonitoringService', () => {
  // ─── detectAlerts ─────────────────────────────────────────────────────────

  describe('detectAlerts (via keyword analysis in createCheckIn)', () => {
    it('identifies aligner_not_seating alert from "not seating" note', () => {
      const svc = makeService(jest.fn());
      const alerts: { type: string; severity: string }[] = (svc as any).analyzeNoteForAlerts(
        'Patient says upper aligner is not seating properly on #14',
      );
      expect(alerts.some(a => a.type === 'aligner_not_seating')).toBe(true);
      expect(alerts.find(a => a.type === 'aligner_not_seating')?.severity).toBe('critical');
    });

    it('identifies attachment_detached alert from "attachment fell off" note', () => {
      const svc = makeService(jest.fn());
      const alerts: { type: string; severity: string }[] = (svc as any).analyzeNoteForAlerts(
        'Attachment fell off tooth 21 yesterday',
      );
      expect(alerts.some(a => a.type === 'attachment_detached')).toBe(true);
    });

    it('identifies patient_non_compliance from "not wearing" note', () => {
      const svc = makeService(jest.fn());
      const alerts: { type: string; severity: string }[] = (svc as any).analyzeNoteForAlerts(
        'Patient admits not wearing aligners at night',
      );
      expect(alerts.some(a => a.type === 'patient_non_compliance')).toBe(true);
    });

    it('returns empty array for normal clinical note with no issues', () => {
      const svc = makeService(jest.fn());
      const alerts: { type: string }[] = (svc as any).analyzeNoteForAlerts(
        'Good progress. Teeth tracking as expected. No issues reported.',
      );
      expect(alerts).toHaveLength(0);
    });

    it('identifies movement_lagging from pain note', () => {
      const svc = makeService(jest.fn());
      const alerts: { type: string; severity: string }[] = (svc as any).analyzeNoteForAlerts(
        'Patient reports sore teeth in upper left quadrant',
      );
      expect(alerts.some(a => a.type === 'movement_lagging')).toBe(true);
      expect(alerts.find(a => a.type === 'movement_lagging')?.severity).toBe('info');
    });

    it('can detect multiple alerts in a single note', () => {
      const svc = makeService(jest.fn());
      const alerts: { type: string }[] = (svc as any).analyzeNoteForAlerts(
        'Aligner not fitting and attachment fell off. Patient has been non-compliant.',
      );
      const types = alerts.map(a => a.type);
      expect(types).toContain('aligner_not_seating');
      expect(types).toContain('attachment_detached');
      expect(types).toContain('patient_non_compliance');
    });
  });

  // ─── computeWeightedScore ─────────────────────────────────────────────────

  describe('computeWeightedScore', () => {
    it('computes the correct weighted average from component scores', () => {
      const svc = makeService(jest.fn());
      const components = [
        { name: 'movement_safety', score: 100, weight: 0.25 },
        { name: 'pdl_safety',      score: 100, weight: 0.20 },
        { name: 'ipr_safety',      score: 100, weight: 0.15 },
        { name: 'attachment',      score: 100, weight: 0.10 },
        { name: 'simulation',      score: 100, weight: 0.10 },
        { name: 'arch_coord',      score:  75, weight: 0.08 },
        { name: 'retention',       score:  50, weight: 0.07 },
        { name: 'export_readiness',score: 100, weight: 0.05 },
      ];
      const result: number = (svc as any).computeWeightedScore(components);
      // = 100*0.25 + 100*0.20 + 100*0.15 + 100*0.10 + 100*0.10 + 75*0.08 + 50*0.07 + 100*0.05
      // = 25 + 20 + 15 + 10 + 10 + 6 + 3.5 + 5 = 94.5
      expect(result).toBeCloseTo(94.5, 1);
    });

    it('returns 0 when all component scores are 0', () => {
      const svc = makeService(jest.fn());
      const components = [
        { name: 'movement_safety', score: 0, weight: 0.25 },
        { name: 'pdl_safety',      score: 0, weight: 0.75 },
      ];
      expect((svc as any).computeWeightedScore(components)).toBe(0);
    });
  });

  // ─── gradeFromScore ───────────────────────────────────────────────────────

  describe('gradeFromScore', () => {
    const cases: [number, string][] = [
      [95, 'A'],
      [90, 'A'],
      [85, 'B'],
      [80, 'B'],
      [75, 'C'],
      [70, 'C'],
      [65, 'D'],
      [60, 'D'],
      [59, 'F'],
      [0,  'F'],
    ];
    it.each(cases)('score %d → grade %s', (score, grade) => {
      const svc = makeService(jest.fn());
      expect((svc as any).gradeFromScore(score)).toBe(grade);
    });
  });
});
