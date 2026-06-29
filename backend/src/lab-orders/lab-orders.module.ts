import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LabOrdersService } from './lab-orders.service';
import { LabOrdersController } from './lab-orders.controller';

@Module({
  imports: [AuthModule],
  controllers: [LabOrdersController],
  providers: [LabOrdersService],
  exports: [LabOrdersService],
})
export class LabOrdersModule {}
