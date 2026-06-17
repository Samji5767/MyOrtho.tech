import { Module, Global } from '@nestjs/common';
import { ObservabilityService } from './observability.service';
import { ObservabilityController } from './observability.controller';

@Global()
@Module({
  controllers: [ObservabilityController],
  providers: [ObservabilityService],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
