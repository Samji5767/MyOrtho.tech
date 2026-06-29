import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TaskManagementService } from './task-management.service';
import { TaskManagementController } from './task-management.controller';

@Module({
  imports: [AuthModule],
  controllers: [TaskManagementController],
  providers: [TaskManagementService],
  exports: [TaskManagementService],
})
export class TaskManagementModule {}
