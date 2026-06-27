import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SurgicalController } from './surgical.controller';
import { SurgicalService } from './surgical.service';

@Module({
  imports: [AuthModule],
  controllers: [SurgicalController],
  providers: [SurgicalService],
  exports: [SurgicalService],
})
export class SurgicalModule {}
