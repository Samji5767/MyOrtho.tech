import { Module } from '@nestjs/common';
import { ArchCoordinationService } from './arch-coordination.service';
import { ArchCoordinationController } from './arch-coordination.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [ArchCoordinationService],
  controllers: [ArchCoordinationController],
})
export class ArchCoordinationModule {}
