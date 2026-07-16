import { Module } from '@nestjs/common';
import { PilotFeedbackService } from './pilot-feedback.service';
import { PilotFeedbackController } from './pilot-feedback.controller';

@Module({
  providers: [PilotFeedbackService],
  controllers: [PilotFeedbackController],
  exports: [PilotFeedbackService],
})
export class PilotFeedbackModule {}
