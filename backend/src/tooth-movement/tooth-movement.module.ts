import { Module } from '@nestjs/common';
import { ToothMovementService } from './tooth-movement.service';
import { ToothMovementController } from './tooth-movement.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [ToothMovementService],
  controllers: [ToothMovementController],
})
export class ToothMovementModule {}
