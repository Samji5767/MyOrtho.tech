import { Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { MessagingGateway } from './messaging.gateway';

@Module({
  providers: [MessagingService, MessagingGateway],
  exports: [MessagingService],
})
export class MessagingModule {}
