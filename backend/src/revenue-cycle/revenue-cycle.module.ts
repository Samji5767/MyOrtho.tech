import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RevenueCycleService } from './revenue-cycle.service';
import { RevenueCycleController } from './revenue-cycle.controller';

@Module({
  imports: [AuthModule],
  controllers: [RevenueCycleController],
  providers: [RevenueCycleService],
  exports: [RevenueCycleService],
})
export class RevenueCycleModule {}
