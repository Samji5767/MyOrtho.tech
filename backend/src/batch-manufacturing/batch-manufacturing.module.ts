// Not registered in AppModule — planned for v1.1 multi-printer batch workflows
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BatchManufacturingService } from './batch-manufacturing.service';
import { BatchManufacturingController } from './batch-manufacturing.controller';

@Module({
  imports: [AuthModule],
  controllers: [BatchManufacturingController],
  providers: [BatchManufacturingService],
  exports: [BatchManufacturingService],
})
export class BatchManufacturingModule {}
