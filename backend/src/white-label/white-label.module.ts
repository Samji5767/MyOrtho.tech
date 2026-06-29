import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhiteLabelService } from './white-label.service';
import { WhiteLabelController } from './white-label.controller';

@Module({
  imports: [AuthModule],
  controllers: [WhiteLabelController],
  providers: [WhiteLabelService],
  exports: [WhiteLabelService],
})
export class WhiteLabelModule {}
