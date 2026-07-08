// Not registered in AppModule — planned for v1.1 multi-printer batch workflows
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrintFarmService } from './print-farm.service';
import { PrintFarmController } from './print-farm.controller';

@Module({
  imports: [AuthModule],
  controllers: [PrintFarmController],
  providers: [PrintFarmService],
  exports: [PrintFarmService],
})
export class PrintFarmModule {}
