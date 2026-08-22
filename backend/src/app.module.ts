import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TimingMiddleware } from './common/timing.middleware';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { CsrfMiddleware } from './common/csrf.middleware';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { WorkflowModule } from './workflow/workflow.module';
import { CasesModule } from './cases/cases.module';
import { PatientsModule } from './patients/patients.module';
import { ScansModule } from './scans/scans.module';
import { AiModule } from './ai/ai.module';
import { SegmentationModule } from './segmentation/segmentation.module';
import { TreatmentPlansModule } from './treatment-plans/treatment-plans.module';
import { AlignerGenerationModule } from './aligner-generation/aligner-generation.module';
import { ManufacturingModule } from './manufacturing/manufacturing.module';
import { ManufacturePrepModule } from './manufacture-prep/manufacture-prep.module';
import { AdminModule } from './admin/admin.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OrgLocationsModule } from './org-locations/org-locations.module';
import { OrgBrandingModule } from './org-branding/org-branding.module';
import { NotificationsModule } from './notifications/notifications.module';
import { BillingModule } from './billing/billing.module';
import { PhotosModule } from './photos/photos.module';
import { BackgroundJobsModule } from './background-jobs/background-jobs.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }]),
    // Infrastructure
    CommonModule,
    DatabaseModule,
    RedisModule,
    HealthModule,
    // Auth
    AuthModule,
    AuditModule,
    // Clinical workflow
    WorkflowModule,
    CasesModule,
    PatientsModule,
    // Scans & AI
    ScansModule,
    AiModule,
    SegmentationModule,
    // Treatment planning
    TreatmentPlansModule,
    AlignerGenerationModule,
    // Manufacturing & export
    ManufacturingModule,
    ManufacturePrepModule,
    // Platform
    AdminModule,
    OrganizationsModule,
    OrgLocationsModule,
    OrgBrandingModule,
    NotificationsModule,
    BillingModule,
    PhotosModule,
    BackgroundJobsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    CorrelationIdMiddleware,
    TimingMiddleware,
    CsrfMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, TimingMiddleware, CsrfMiddleware)
      .forRoutes('*');
  }
}
