import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RadiologyService } from './radiology.service';
import { RadiologyController } from './radiology.controller';

@Module({
  imports: [AuthModule],
  controllers: [RadiologyController],
  providers: [RadiologyService],
  exports: [RadiologyService],
})
export class RadiologyModule {}
