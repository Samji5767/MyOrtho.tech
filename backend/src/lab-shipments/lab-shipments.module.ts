import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { LabShipmentsService } from './lab-shipments.service';
import { LabShipmentsController } from './lab-shipments.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [LabShipmentsController],
  providers: [LabShipmentsService],
  exports: [LabShipmentsService],
})
export class LabShipmentsModule {}
