import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { ManufacturingAnalyticsService } from './manufacturing-analytics.service';
import { ManufacturingAnalyticsController } from './manufacturing-analytics.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [ManufacturingAnalyticsController],
  providers: [ManufacturingAnalyticsService],
  exports: [ManufacturingAnalyticsService],
})
export class ManufacturingAnalyticsModule {}
