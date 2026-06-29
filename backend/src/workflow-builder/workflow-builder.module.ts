import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WorkflowBuilderService } from './workflow-builder.service';
import { WorkflowBuilderController } from './workflow-builder.controller';

@Module({
  imports: [AuthModule],
  controllers: [WorkflowBuilderController],
  providers: [WorkflowBuilderService],
  exports: [WorkflowBuilderService],
})
export class WorkflowBuilderModule {}
