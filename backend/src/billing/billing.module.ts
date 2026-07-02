import { Module, Global } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingService } from './billing.service';
import { BillingController, BillingWebhookController } from './billing.controller';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [BillingController, BillingWebhookController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
