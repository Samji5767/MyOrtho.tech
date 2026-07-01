import { Module } from '@nestjs/common';
import { DigitalSetupController } from './digital-setup.controller';
import { DigitalSetupService } from './digital-setup.service';

@Module({
  controllers: [DigitalSetupController],
  providers: [DigitalSetupService],
  exports: [DigitalSetupService],
})
export class DigitalSetupModule {}
