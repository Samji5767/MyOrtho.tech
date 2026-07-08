import { ModuleReadinessScore, PlatformReadinessReport, ReadinessLevel } from './production-readiness.interfaces';

function levelFromScore(score: number): ReadinessLevel {
  if (score >= 85) return 'production';
  if (score >= 70) return 'staging';
  if (score >= 55) return 'beta';
  if (score >= 30) return 'alpha';
  return 'not_started';
}

export class ProductionReadinessService {
  static generateReport(): PlatformReadinessReport {
    const modules: ModuleReadinessScore[] = [
      {
        module: 'Authentication',
        score: 88,
        level: levelFromScore(88),
        implemented: ['JWT + cookie auth', 'Multi-role RBAC', 'Auth guards', 'Refresh token rotation'],
        partial: ['Session management'],
        missing: ['MFA (TOTP/SMS)', 'Session invalidation across devices'],
        notes: 'Core auth is solid. MFA and cross-device session revocation are the remaining gaps before full production sign-off.',
      },
      {
        module: 'Cases',
        score: 85,
        level: levelFromScore(85),
        implemented: ['Full case workflow', 'State machine transitions', 'Analytics', 'Case search and filtering'],
        partial: ['Batch operations UI'],
        missing: ['Bulk case operations API', 'Case archiving policy'],
        notes: 'Workflow coverage is comprehensive. Bulk operations needed for high-volume clinics.',
      },
      {
        module: 'Patients',
        score: 80,
        level: levelFromScore(80),
        implemented: ['Patient CRUD', 'Profile management', 'Search', 'Demographics'],
        partial: ['Document association'],
        missing: ['Document management module', 'Patient merge/deduplication'],
        notes: 'Core patient data management is complete. Document management is the primary missing capability.',
      },
      {
        module: 'Scans',
        score: 78,
        level: levelFromScore(78),
        implemented: ['File upload pipeline', 'Format validation', 'Scan processing orchestration', 'Metadata extraction'],
        partial: ['Error handling on failed transfers'],
        missing: ['Auto-retry with backoff on transfer failures', 'Quarantine queue for invalid files'],
        notes: 'Upload and processing pipeline works. Auto-retry and quarantine logic are needed for production reliability.',
      },
      {
        module: 'CAD Viewer',
        score: 70,
        level: levelFromScore(70),
        implemented: ['Basic 3D mesh rendering', 'Orbit/pan/zoom controls', 'STL/OBJ loading'],
        partial: ['Measurement tools'],
        missing: ['Full 3D manipulation (sectioning, boolean ops)', 'Annotation persistence', 'Multi-model comparison view'],
        notes: 'Viewer is functional for review. Advanced manipulation features require significant WebGL engineering effort.',
      },
      {
        module: 'Treatment Planning',
        score: 82,
        level: levelFromScore(82),
        implemented: ['Prescriptions', 'Treatment simulation', 'QA checks', 'Stage sequencing'],
        partial: ['Refinement workflow'],
        missing: ['Guided refinement wizard', 'Automated re-staging after refinement approval'],
        notes: 'Initial planning workflow is strong. Refinement wizard needed for post-initial-treatment cases.',
      },
      {
        module: 'AI Copilot',
        score: 75,
        level: levelFromScore(75),
        implemented: ['Rule-based clinical engine', 'RAG architecture scaffold', 'Confidence scoring', 'Suggestion ranking'],
        partial: ['LLM prompt pipeline'],
        missing: ['Production LLM provider wiring', 'Fine-tuned model integration', 'Feedback loop for model improvement'],
        notes: 'Architecture is sound but the LLM provider is not wired by default. Clinical rule engine provides value without it.',
      },
      {
        module: 'Manufacturing',
        score: 80,
        level: levelFromScore(80),
        implemented: ['Manufacture prep pipeline', 'Export package generation', 'Batch scheduling', 'QC validation'],
        partial: ['Printer status monitoring'],
        missing: ['Real printer API calls (SprintRay, Formlabs)', 'Automated print queue management'],
        notes: 'Data preparation and export are production-ready. Physical printer integration requires vendor API credentials.',
      },
      {
        module: 'Patient Portal',
        score: 65,
        level: levelFromScore(65),
        implemented: ['Patient-facing case view', 'Treatment progress display', 'Secure messaging'],
        partial: ['Notification delivery'],
        missing: ['Real-time notifications (WebSocket/SSE)', 'Push notification support', 'Patient consent e-signature'],
        notes: 'Portal is functional but lacks real-time feedback. Notification and e-signature gaps reduce patient engagement.',
      },
      {
        module: 'Reporting',
        score: 60,
        level: levelFromScore(60),
        implemented: ['Clinical report data aggregation', 'Report templates', 'Basic chart generation'],
        partial: ['Report rendering'],
        missing: ['PDF generation and download', 'Scheduled report delivery', 'White-label report branding'],
        notes: 'Report data layer is ready. PDF export is the critical missing deliverable.',
      },
      {
        module: 'Administration',
        score: 70,
        level: levelFromScore(70),
        implemented: ['User management', 'Organisation settings', 'Audit log recording', 'Role assignment'],
        partial: ['Audit log querying'],
        missing: ['Audit log UI with filtering and export', 'SSO/SAML integration', 'Custom role builder'],
        notes: 'Admin backend is solid. UI for audit log exploration and SSO are the highest-priority gaps.',
      },
      {
        module: 'Security',
        score: 82,
        level: levelFromScore(82),
        implemented: ['AuthGuard on all routes', 'RBAC enforcement', 'CORS policy', 'Input validation (class-validator)', 'HTTPS enforcement'],
        partial: ['Request throttling'],
        missing: ['CSRF tokens for cookie-based auth', 'Global rate limiting (Throttler)', 'Dependency vulnerability scanning in CI'],
        notes: 'Security posture is good. CSRF protection and rate limiting are required before public production launch.',
      },
      {
        module: 'Performance',
        score: 68,
        level: levelFromScore(68),
        implemented: ['Lazy-loaded frontend modules', 'Code splitting', 'Database query indexing', 'CDN-backed static assets'],
        partial: ['List pagination'],
        missing: ['Virtual scrolling for large patient/case lists', 'HTTP response caching headers', 'Database connection pooling tuning'],
        notes: 'Performance is adequate for small practices. Large-clinic load profiles require virtualization and caching work.',
      },
      {
        module: 'Accessibility',
        score: 60,
        level: levelFromScore(60),
        implemented: ['Semantic HTML structure', 'Basic ARIA labels on interactive elements', 'Colour contrast AA compliance on primary surfaces'],
        partial: ['Keyboard navigation'],
        missing: ['Full keyboard navigation audit', 'Screen reader test pass (NVDA/VoiceOver)', 'Focus trap management in modals', 'WCAG 2.1 AA formal audit'],
        notes: 'Baseline accessibility exists. A formal audit and remediation sprint is required before public launch.',
      },
      {
        module: 'Testing',
        score: 55,
        level: levelFromScore(55),
        implemented: ['Unit tests for core services', 'DTO validation tests', 'Guard and interceptor tests'],
        partial: ['Integration tests'],
        missing: ['Comprehensive E2E test suite (Playwright/Cypress)', 'Code coverage enforcement (target >= 80%)', 'Visual regression tests for 3D viewer'],
        notes: 'Unit coverage exists but overall coverage is below 40%. E2E and visual regression suites are critical gaps.',
      },
      {
        module: 'Documentation',
        score: 50,
        level: levelFromScore(50),
        implemented: ['Inline code comments', 'Interface-level JSDoc', 'Architecture decision notes in key modules'],
        partial: ['API documentation'],
        missing: ['OpenAPI/Swagger spec generation', 'Developer onboarding guide', 'Runbook for operations team', 'Changelog maintenance'],
        notes: 'Documentation is developer-authored but not systematic. API spec generation and an onboarding guide are the highest priorities.',
      },
    ];

    // Weighted average: modules with higher clinical/security impact carry more weight
    const weights: Record<string, number> = {
      Authentication: 1.5,
      Security: 1.5,
      Cases: 1.3,
      Patients: 1.2,
      'Treatment Planning': 1.2,
      Scans: 1.1,
      Manufacturing: 1.1,
      'AI Copilot': 1.0,
      'CAD Viewer': 1.0,
      'Patient Portal': 0.9,
      Reporting: 0.9,
      Administration: 0.9,
      Performance: 0.8,
      Accessibility: 0.8,
      Testing: 1.2,
      Documentation: 0.7,
    };

    let weightedSum = 0;
    let totalWeight = 0;
    for (const m of modules) {
      const w = weights[m.module] ?? 1.0;
      weightedSum += m.score * w;
      totalWeight += w;
    }
    const overallScore = Math.round(weightedSum / totalWeight);

    return {
      overallScore,
      generatedAt: new Date().toISOString(),
      modules,
      criticalIssues: [
        'CSRF protection is absent for cookie-based authentication — required before public launch.',
        'Global rate limiting (NestJS Throttler) is not configured — exposes auth endpoints to brute-force.',
        'PDF report generation is not implemented — clinical reporting is incomplete.',
        'LLM provider is not wired by default — AI Copilot operates on rule engine only.',
        'E2E test coverage is near-zero — regressions will not be caught by CI.',
        'Real printer API integration is missing — manufacturing workflow ends at export package.',
      ],
      recommendations: [
        'Implement CSRF tokens (double-submit cookie pattern) and add Throttler globally before public launch.',
        'Integrate a PDF generation library (e.g. Puppeteer or WeasyPrint) for clinical report downloads.',
        'Wire an LLM provider (Anthropic Claude or equivalent) behind a feature flag for AI Copilot.',
        'Establish a Playwright E2E suite targeting critical user journeys (login → case creation → treatment plan approval).',
        'Obtain SprintRay and Formlabs API credentials and implement printer connector integration tests.',
        'Commission a WCAG 2.1 AA accessibility audit and remediate findings before patient-facing launch.',
        'Generate and publish an OpenAPI spec from NestJS decorators to accelerate partner integration.',
        'Set up automated dependency scanning (e.g. Snyk or Dependabot) in the CI pipeline.',
      ],
    };
  }
}
