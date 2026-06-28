import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
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

@Module({
  imports: [
    // Infrastructure (global — available to all modules via @Global())
    DatabaseModule,
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
  ],
})
export class AppModule {}
