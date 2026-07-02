import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiSuggestionsController } from './ai-suggestions.controller';
import { AiSuggestionsService } from './ai-suggestions.service';

@Module({
  imports: [AuthModule],
  controllers: [AiSuggestionsController],
  providers: [AiSuggestionsService],
  exports: [AiSuggestionsService],
})
export class AiSuggestionsModule {}
