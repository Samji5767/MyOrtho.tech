import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IprPlannerController } from './ipr-planner.controller';
import { IprPlannerService } from './ipr-planner.service';

@Module({
  imports: [AuthModule],
  controllers: [IprPlannerController],
  providers: [IprPlannerService],
  exports: [IprPlannerService],
})
export class IprPlannerModule {}
