import { Module } from '@nestjs/common';
import { MlopsService } from './mlops.service';
import { MlopsController } from './mlops.controller';
import { AiAuditService } from './ai-audit.service';

@Module({
  providers: [MlopsService, AiAuditService],
  controllers: [MlopsController],
  exports: [MlopsService, AiAuditService],
})
export class MlopsModule {}
