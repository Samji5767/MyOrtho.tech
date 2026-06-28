import { Module } from '@nestjs/common';
import { IprPlannerController } from './ipr-planner.controller';
import { IprPlannerService } from './ipr-planner.service';

@Module({
  controllers: [IprPlannerController],
  providers: [IprPlannerService],
  exports: [IprPlannerService],
})
export class IprPlannerModule {}
