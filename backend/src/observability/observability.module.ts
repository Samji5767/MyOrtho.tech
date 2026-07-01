import { Module, Global } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [ObservabilityController],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
