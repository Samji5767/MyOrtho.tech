import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IntakeFormsService } from './intake-forms.service';
import { IntakeFormsController } from './intake-forms.controller';

@Module({
  imports: [AuthModule],
  controllers: [IntakeFormsController],
  providers: [IntakeFormsService],
  exports: [IntakeFormsService],
})
export class IntakeFormsModule {}
