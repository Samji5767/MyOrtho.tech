import { Module } from '@nestjs/common';
import { ClinicalKnowledgeService } from './clinical-knowledge.service';
import { ClinicalKnowledgeController } from './clinical-knowledge.controller';

@Module({
  providers: [ClinicalKnowledgeService],
  controllers: [ClinicalKnowledgeController],
  exports: [ClinicalKnowledgeService],
})
export class ClinicalKnowledgeModule {}
