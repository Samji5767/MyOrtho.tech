import { Module } from '@nestjs/common';
import { IprIntelligenceService } from './ipr-intelligence.service';
import { IprIntelligenceController } from './ipr-intelligence.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [IprIntelligenceService],
  controllers: [IprIntelligenceController],
})
export class IprIntelligenceModule {}
