import { Module } from '@nestjs/common';
import { AttachmentIntelligenceService } from './attachment-intelligence.service';
import { AttachmentIntelligenceController } from './attachment-intelligence.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [AttachmentIntelligenceService],
  controllers: [AttachmentIntelligenceController],
})
export class AttachmentIntelligenceModule {}
