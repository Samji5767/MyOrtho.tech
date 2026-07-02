import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TimingMiddleware } from './common/timing.middleware';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { WorkflowModule } from './workflow/workflow.module';
import { CasesModule } from './cases/cases.module';
import { PatientsModule } from './patients/patients.module';
import { PrintersModule } from './printers/printers.module';
import { AiModule } from './ai/ai.module';
import { ReportingModule } from './reporting/reporting.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { ManufacturingModule } from './manufacturing/manufacturing.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { RestorativeModule } from './restorative/restorative.module';
import { ScannerModule } from './scanner/scanner.module';
import { EventsModule } from './events/events.module';
import { BillingModule } from './billing/billing.module';
import { ObservabilityModule } from './observability/observability.module';
import { MessagingModule } from './messaging/messaging.module';
import { ScansModule } from './scans/scans.module';
import { TreatmentPlansModule } from './treatment-plans/treatment-plans.module';
import { CreditsModule } from './credits/credits.module';
import { AdminModule } from './admin/admin.module';
import { AnalysisModule } from './analysis/analysis.module';
import { SurgicalModule } from './surgical/surgical.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PhotosModule } from './photos/photos.module';
import { CephModule } from './ceph/ceph.module';
import { StagesModule } from './stages/stages.module';
import { QcModule } from './qc/qc.module';
import { SegmentationModule } from './segmentation/segmentation.module';
import { AiProposalModule } from './ai-proposal/ai-proposal.module';
import { PreexportQaModule } from './preexport-qa/preexport-qa.module';
import { ManufacturePrepModule } from './manufacture-prep/manufacture-prep.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { BiomechanicsModule } from './biomechanics/biomechanics.module';
import { AttachmentPlannerModule } from './attachment-planner/attachment-planner.module';
import { IprPlannerModule } from './ipr-planner/ipr-planner.module';
import { RefinementModule } from './refinement/refinement.module';
import { ToothMovementModule } from './tooth-movement/tooth-movement.module';
import { AlignerGenerationModule } from './aligner-generation/aligner-generation.module';
import { AttachmentIntelligenceModule } from './attachment-intelligence/attachment-intelligence.module';
import { IprIntelligenceModule } from './ipr-intelligence/ipr-intelligence.module';
import { TreatmentSimulationModule } from './treatment-simulation/treatment-simulation.module';
import { CopilotModule } from './copilot/copilot.module';
import { ArchCoordinationModule } from './arch-coordination/arch-coordination.module';
import { RetentionModule } from './retention/retention.module';
import { ExportPackageModule } from './export-package/export-package.module';
import { ScanProcessingModule } from './scan-processing/scan-processing.module';
import { TreatmentMonitoringModule } from './treatment-monitoring/treatment-monitoring.module';
import { CbctModule } from './cbct/cbct.module';
import { SystemStatusModule } from './system-status/system-status.module';
import { ConsentFormsModule } from './consent-forms/consent-forms.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ClinicalReportsModule } from './clinical-reports/clinical-reports.module';
import { LabOrdersModule } from './lab-orders/lab-orders.module';
import { ReferralsModule } from './referrals/referrals.module';
import { PatientPortalModule } from './patient-portal/patient-portal.module';
import { InsuranceModule } from './insurance/insurance.module';
import { InventoryModule } from './inventory/inventory.module';
import { PrescriptionsModule } from './prescriptions/prescriptions.module';
import { RemoteMonitoringModule } from './remote-monitoring/remote-monitoring.module';
import { OutcomesModule } from './outcomes/outcomes.module';
import { TrainingModule } from './training/training.module';
import { PrinterMaintenanceModule } from './printer-maintenance/printer-maintenance.module';
import { FhirModule } from './fhir/fhir.module';
import { WhiteLabelModule } from './white-label/white-label.module';
import { BusinessIntelligenceModule } from './business-intelligence/business-intelligence.module';
import { SupplyChainModule } from './supply-chain/supply-chain.module';
import { CrmModule } from './crm/crm.module';
import { WorkflowBuilderModule } from './workflow-builder/workflow-builder.module';
import { CommandPaletteModule } from './command-palette/command-palette.module';
import { ClinicalDecisionSupportModule } from './clinical-decision-support/cds.module';
import { TaskManagementModule } from './task-management/task-management.module';
import { SurveysModule } from './surveys/surveys.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { QualityMetricsModule } from './quality-metrics/quality-metrics.module';
import { RegulatoryComplianceModule } from './regulatory-compliance/regulatory-compliance.module';
import { DocumentsModule } from './documents/documents.module';
import { PatientEducationModule } from './patient-education/patient-education.module';
import { RadiologyModule } from './radiology/radiology.module';
import { OcclusionAnalysisModule } from './occlusion-analysis/occlusion-analysis.module';
import { GrowthPredictionModule } from './growth-prediction/growth-prediction.module';
import { OrgLocationsModule } from './org-locations/org-locations.module';
import { EmergencyProtocolsModule } from './emergency-protocols/emergency-protocols.module';
import { AttachmentLibraryModule } from './attachment-library/attachment-library.module';
import { MovementConstraintsModule } from './movement-constraints/movement-constraints.module';
import { PrintFarmModule } from './print-farm/print-farm.module';
import { BatchManufacturingModule } from './batch-manufacturing/batch-manufacturing.module';
import { DeviceTrackingModule } from './device-tracking/device-tracking.module';
import { MaterialTestingModule } from './material-testing/material-testing.module';
import { IntakeFormsModule } from './intake-forms/intake-forms.module';
import { RevenueCycleModule } from './revenue-cycle/revenue-cycle.module';
import { PlatformHealthModule } from './platform-health/platform-health.module';
import { StlProcessingModule } from './stl-processing/stl-processing.module';
import { ToothSegmentationModule } from './tooth-segmentation/tooth-segmentation.module';
import { ClinicalAnalysisDeepModule } from './clinical-analysis-deep/clinical-analysis-deep.module';
import { TreatmentGoalsModule } from './treatment-goals/treatment-goals.module';
import { DigitalSetupModule } from './digital-setup/digital-setup.module';
import { TreatmentStagesModule } from './treatment-stages/treatment-stages.module';
import { TreatmentQAModule } from './treatment-qa/treatment-qa.module';
import { AlignerDesignModule } from './aligner-design/aligner-design.module';
import { AiSuggestionsModule } from './ai-suggestions/ai-suggestions.module';

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
    DatabaseModule,
    RedisModule,
    // Core
    AuthModule,
    AuditModule,
    WorkflowModule,
    // Clinical data
    CasesModule,
    PatientsModule,
    // Platform features
    HealthModule,
    PrintersModule,
    AiModule,
    ReportingModule,
    CollaborationModule,
    ManufacturingModule,
    WebhooksModule,
    RestorativeModule,
    ScannerModule,
    EventsModule,
    BillingModule,
    ObservabilityModule,
    MessagingModule,
    ScansModule,
    TreatmentPlansModule,
    CreditsModule,
    AdminModule,
    AnalysisModule,
    SurgicalModule,
    NotificationsModule,
    PhotosModule,
    CephModule,
    StagesModule,
    QcModule,
    SegmentationModule,
    AiProposalModule,
    PreexportQaModule,
    ManufacturePrepModule,
    AnalyticsModule,
    BiomechanicsModule,
    AttachmentPlannerModule,
    IprPlannerModule,
    RefinementModule,
    ToothMovementModule,
    AlignerGenerationModule,
    AttachmentIntelligenceModule,
    IprIntelligenceModule,
    TreatmentSimulationModule,
    CopilotModule,
    ArchCoordinationModule,
    RetentionModule,
    ExportPackageModule,
    ScanProcessingModule,
    TreatmentMonitoringModule,
    CbctModule,
    SystemStatusModule,
    ConsentFormsModule,
    AppointmentsModule,
    ClinicalReportsModule,
    LabOrdersModule,
    ReferralsModule,
    PatientPortalModule,
    InsuranceModule,
    InventoryModule,
    PrescriptionsModule,
    RemoteMonitoringModule,
    OutcomesModule,
    TrainingModule,
    PrinterMaintenanceModule,
    FhirModule,
    WhiteLabelModule,
    BusinessIntelligenceModule,
    SupplyChainModule,
    CrmModule,
    WorkflowBuilderModule,
    CommandPaletteModule,
    ClinicalDecisionSupportModule,
    TaskManagementModule,
    SurveysModule,
    FeatureFlagsModule,
    QualityMetricsModule,
    RegulatoryComplianceModule,
    DocumentsModule,
    PatientEducationModule,
    RadiologyModule,
    OcclusionAnalysisModule,
    GrowthPredictionModule,
    OrgLocationsModule,
    EmergencyProtocolsModule,
    AttachmentLibraryModule,
    MovementConstraintsModule,
    PrintFarmModule,
    BatchManufacturingModule,
    DeviceTrackingModule,
    MaterialTestingModule,
    IntakeFormsModule,
    RevenueCycleModule,
    PlatformHealthModule,
    StlProcessingModule,
    ToothSegmentationModule,
    ClinicalAnalysisDeepModule,
    TreatmentGoalsModule,
    DigitalSetupModule,
    TreatmentStagesModule,
    TreatmentQAModule,
    AlignerDesignModule,
    AiSuggestionsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    TimingMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TimingMiddleware).forRoutes('*');
  }
}
