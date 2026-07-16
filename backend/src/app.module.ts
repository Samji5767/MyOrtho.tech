import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TimingMiddleware } from './common/timing.middleware';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { SsoModule } from './sso/sso.module';
import { WorkflowModule } from './workflow/workflow.module';
import { CasesModule } from './cases/cases.module';
import { PatientsModule } from './patients/patients.module';
// ─── Scans / STL ─────────────────────────────────────────────────────────────
import { ScansModule } from './scans/scans.module';
import { ScanProcessingModule } from './scan-processing/scan-processing.module';
import { StlProcessingModule } from './stl-processing/stl-processing.module';
import { ScannerModule } from './scanner/scanner.module';
// ─── AI / Segmentation ───────────────────────────────────────────────────────
import { AiModule } from './ai/ai.module';
import { SegmentationModule } from './segmentation/segmentation.module';
import { ToothSegmentationModule } from './tooth-segmentation/tooth-segmentation.module';
import { AiProposalModule } from './ai-proposal/ai-proposal.module';
import { AiSuggestionsModule } from './ai-suggestions/ai-suggestions.module';
import { CopilotModule } from './copilot/copilot.module';
// ─── Clinical Analysis ────────────────────────────────────────────────────────
import { AnalysisModule } from './analysis/analysis.module';
import { ClinicalAnalysisDeepModule } from './clinical-analysis-deep/clinical-analysis-deep.module';
import { OcclusionAnalysisModule } from './occlusion-analysis/occlusion-analysis.module';
import { BiomechanicsModule } from './biomechanics/biomechanics.module';
import { CephModule } from './ceph/ceph.module';
import { GrowthPredictionModule } from './growth-prediction/growth-prediction.module';
import { ClinicalDecisionSupportModule } from './clinical-decision-support/cds.module';
// ─── Treatment Planning ───────────────────────────────────────────────────────
import { TreatmentPlansModule } from './treatment-plans/treatment-plans.module';
import { TreatmentGoalsModule } from './treatment-goals/treatment-goals.module';
import { TreatmentSimulationModule } from './treatment-simulation/treatment-simulation.module';
// ─── CAD / Tooth Movement ────────────────────────────────────────────────────
import { DigitalSetupModule } from './digital-setup/digital-setup.module';
import { ToothMovementModule } from './tooth-movement/tooth-movement.module';
import { MovementConstraintsModule } from './movement-constraints/movement-constraints.module';
import { ArchCoordinationModule } from './arch-coordination/arch-coordination.module';
import { RefinementModule } from './refinement/refinement.module';
import { RetentionModule } from './retention/retention.module';
// ─── Attachments & IPR ───────────────────────────────────────────────────────
import { AttachmentPlannerModule } from './attachment-planner/attachment-planner.module';
import { AttachmentLibraryModule } from './attachment-library/attachment-library.module';
import { AttachmentIntelligenceModule } from './attachment-intelligence/attachment-intelligence.module';
import { IprPlannerModule } from './ipr-planner/ipr-planner.module';
import { IprIntelligenceModule } from './ipr-intelligence/ipr-intelligence.module';
// ─── Staging & Aligner Generation ────────────────────────────────────────────
import { StagesModule } from './stages/stages.module';
import { TreatmentStagesModule } from './treatment-stages/treatment-stages.module';
import { AlignerGenerationModule } from './aligner-generation/aligner-generation.module';
import { AlignerDesignModule } from './aligner-design/aligner-design.module';
// ─── QA & Export ─────────────────────────────────────────────────────────────
import { PreexportQaModule } from './preexport-qa/preexport-qa.module';
import { TreatmentQAModule } from './treatment-qa/treatment-qa.module';
import { QcModule } from './qc/qc.module';
import { QaInspectionModule } from './qa-inspection/qa-inspection.module';
import { ExportPackageModule } from './export-package/export-package.module';
// ─── Export / Print Prep ─────────────────────────────────────────────────────
import { ManufacturingModule } from './manufacturing/manufacturing.module';
import { ManufacturePrepModule } from './manufacture-prep/manufacture-prep.module';
import { PrintersModule } from './printers/printers.module';
// ─── Clinical Reports & Photos ────────────────────────────────────────────────
import { ClinicalReportsModule } from './clinical-reports/clinical-reports.module';
import { PhotosModule } from './photos/photos.module';
// ─── Imaging ─────────────────────────────────────────────────────────────────
import { RadiologyModule } from './radiology/radiology.module';
import { CbctModule } from './cbct/cbct.module';
// ─── Platform ────────────────────────────────────────────────────────────────
import { ObservabilityModule } from './observability/observability.module';
import { PlatformHealthModule } from './platform-health/platform-health.module';
import { SystemStatusModule } from './system-status/system-status.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { OrgLocationsModule } from './org-locations/org-locations.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { EventsModule } from './events/events.module';
import { MessagingModule } from './messaging/messaging.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { FhirModule } from './fhir/fhir.module';
import { EmergencyProtocolsModule } from './emergency-protocols/emergency-protocols.module';
import { BillingModule } from './billing/billing.module';
import { OrgBrandingModule } from './org-branding/org-branding.module';
import { ReleasesModule } from './releases/releases.module';
import { WorkingHoursModule } from './working-hours/working-hours.module';
import { ReportsModule } from './reports/reports.module';
import { LabDashboardModule } from './lab-dashboard/lab-dashboard.module';
import { LabInventoryModule } from './lab-inventory/lab-inventory.module';
import { LabShipmentsModule } from './lab-shipments/lab-shipments.module';
import { ManufacturingAnalyticsModule } from './manufacturing-analytics/manufacturing-analytics.module';
import { BatchManufacturingModule } from './batch-manufacturing/batch-manufacturing.module';
import { PrintFarmModule } from './print-farm/print-farm.module';
// ─── Enterprise 2.0 Platform ──────────────────────────────────────────────────
import { IntegrationProvidersModule } from './integration-providers/integration-providers.module';
import { BackgroundJobsModule } from './background-jobs/background-jobs.module';
import { ClinicalKnowledgeModule } from './clinical-knowledge/clinical-knowledge.module';
import { MlopsModule } from './mlops/mlops.module';
// ─── MyOrtho 3.0 Intelligent Clinical Platform ───────────────────────────────
import { SearchModule } from './search/search.module';
import { DiscussionsModule } from './discussions/discussions.module';
import { PredictionsModule } from './predictions/predictions.module';
// ─── Pilot Readiness & Clinical Safety ───────────────────────────────────────
import { ClinicalSafetyGateModule } from './clinical-safety-gate/clinical-safety-gate.module';
import { ManufacturingReadinessGateModule } from './manufacturing-readiness-gate/manufacturing-readiness-gate.module';
import { PilotFeedbackModule } from './pilot-feedback/pilot-feedback.module';

@Module({
  imports: [
    // Global rate limiting: 100 req/60s per IP (auth routes further restricted in AuthController)
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
    // Infrastructure (global — available to all modules via @Global())
    CommonModule,
    DatabaseModule,
    RedisModule,
    // Core
    AuthModule,
    AuditModule,
    SsoModule,
    WorkflowModule,
    // Clinical data
    CasesModule,
    PatientsModule,
    // Scans / STL
    ScansModule,
    ScanProcessingModule,
    StlProcessingModule,
    ScannerModule,
    // AI / Segmentation
    AiModule,
    SegmentationModule,
    ToothSegmentationModule,
    AiProposalModule,
    AiSuggestionsModule,
    CopilotModule,
    // Clinical Analysis
    AnalysisModule,
    ClinicalAnalysisDeepModule,
    OcclusionAnalysisModule,
    BiomechanicsModule,
    CephModule,
    GrowthPredictionModule,
    ClinicalDecisionSupportModule,
    // Treatment Planning
    TreatmentPlansModule,
    TreatmentGoalsModule,
    TreatmentSimulationModule,
    // CAD / Tooth Movement
    DigitalSetupModule,
    ToothMovementModule,
    MovementConstraintsModule,
    ArchCoordinationModule,
    RefinementModule,
    RetentionModule,
    // Attachments & IPR
    AttachmentPlannerModule,
    AttachmentLibraryModule,
    AttachmentIntelligenceModule,
    IprPlannerModule,
    IprIntelligenceModule,
    // Staging & Aligner Generation
    StagesModule,
    TreatmentStagesModule,
    AlignerGenerationModule,
    AlignerDesignModule,
    // QA & Export
    PreexportQaModule,
    TreatmentQAModule,
    QcModule,
    QaInspectionModule,
    ExportPackageModule,
    // Export / Print Prep
    ManufacturingModule,
    ManufacturePrepModule,
    PrintersModule,
    // Clinical Reports & Photos
    ClinicalReportsModule,
    PhotosModule,
    // Imaging
    RadiologyModule,
    CbctModule,
    // Platform
    HealthModule,
    ObservabilityModule,
    PlatformHealthModule,
    SystemStatusModule,
    NotificationsModule,
    AdminModule,
    OrgLocationsModule,
    WebhooksModule,
    EventsModule,
    MessagingModule,
    CollaborationModule,
    FeatureFlagsModule,
    FhirModule,
    EmergencyProtocolsModule,
    BillingModule,
    OrgBrandingModule,
    ReleasesModule,
    WorkingHoursModule,
    ReportsModule,
    LabDashboardModule,
    LabInventoryModule,
    LabShipmentsModule,
    ManufacturingAnalyticsModule,
    BatchManufacturingModule,
    PrintFarmModule,
    // Enterprise 2.0 Platform
    IntegrationProvidersModule,
    BackgroundJobsModule,
    ClinicalKnowledgeModule,
    MlopsModule,
    // MyOrtho 3.0 Intelligent Clinical Platform
    SearchModule,
    DiscussionsModule,
    PredictionsModule,
    // Pilot Readiness & Clinical Safety
    ClinicalSafetyGateModule,
    ManufacturingReadinessGateModule,
    PilotFeedbackModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    CorrelationIdMiddleware,
    TimingMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, TimingMiddleware)
      .forRoutes('*');
  }
}
