import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DigitalSetupController } from './digital-setup.controller';
import { DigitalSetupService } from './digital-setup.service';

@Module({
  imports: [AuthModule],
  controllers: [DigitalSetupController],
  providers: [DigitalSetupService],
  exports: [DigitalSetupService],
})
export class DigitalSetupModule {}
