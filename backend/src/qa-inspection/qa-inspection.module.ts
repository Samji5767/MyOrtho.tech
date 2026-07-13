import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { QaInspectionService } from './qa-inspection.service';
import { QaInspectionController } from './qa-inspection.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [QaInspectionController],
  providers: [QaInspectionService],
  exports: [QaInspectionService],
})
export class QaInspectionModule {}
