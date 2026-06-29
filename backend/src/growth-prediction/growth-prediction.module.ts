import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GrowthPredictionService } from './growth-prediction.service';
import { GrowthPredictionController } from './growth-prediction.controller';

@Module({
  imports: [AuthModule],
  controllers: [GrowthPredictionController],
  providers: [GrowthPredictionService],
  exports: [GrowthPredictionService],
})
export class GrowthPredictionModule {}
