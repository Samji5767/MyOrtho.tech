import { Module } from '@nestjs/common';
import { IntegrationProvidersService } from './integration-providers.service';
import { IntegrationProvidersController } from './integration-providers.controller';
import { BackgroundJobsModule } from '../background-jobs/background-jobs.module';

@Module({
  imports: [BackgroundJobsModule],
  providers: [IntegrationProvidersService],
  controllers: [IntegrationProvidersController],
  exports: [IntegrationProvidersService],
})
export class IntegrationProvidersModule {}
