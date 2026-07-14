import { Module } from '@nestjs/common';
import { IntegrationProvidersService } from './integration-providers.service';
import { IntegrationProvidersController } from './integration-providers.controller';

@Module({
  providers: [IntegrationProvidersService],
  controllers: [IntegrationProvidersController],
  exports: [IntegrationProvidersService],
})
export class IntegrationProvidersModule {}
