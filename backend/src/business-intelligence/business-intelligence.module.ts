import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BusinessIntelligenceService } from './business-intelligence.service';
import { BusinessIntelligenceController } from './business-intelligence.controller';

@Module({
  imports: [AuthModule],
  controllers: [BusinessIntelligenceController],
  providers: [BusinessIntelligenceService],
  exports: [BusinessIntelligenceService],
})
export class BusinessIntelligenceModule {}
