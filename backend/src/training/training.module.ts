import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrainingService } from './training.service';
import { TrainingController } from './training.controller';

@Module({
  imports: [AuthModule],
  controllers: [TrainingController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
