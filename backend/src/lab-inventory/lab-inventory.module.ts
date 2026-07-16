import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { LabInventoryService } from './lab-inventory.service';
import { LabInventoryController } from './lab-inventory.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [LabInventoryController],
  providers: [LabInventoryService],
  exports: [LabInventoryService],
})
export class LabInventoryModule {}
