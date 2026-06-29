import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConsentFormsService } from './consent-forms.service';
import { ConsentFormsController } from './consent-forms.controller';

@Module({
  imports: [AuthModule],
  controllers: [ConsentFormsController],
  providers: [ConsentFormsService],
  exports: [ConsentFormsService],
})
export class ConsentFormsModule {}
