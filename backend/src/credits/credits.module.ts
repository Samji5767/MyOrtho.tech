import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CreditsService } from './credits.service';
import { CreditsController, SubscriptionsController } from './credits.controller';

@Module({
  imports: [AuthModule],
  controllers: [CreditsController, SubscriptionsController],
  providers: [CreditsService],
  exports: [CreditsService],
})
export class CreditsModule {}
