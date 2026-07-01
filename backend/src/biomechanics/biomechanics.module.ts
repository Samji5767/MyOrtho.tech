import { Module } from '@nestjs/common';
import { BiomechanicsController, BiomechanicsLegacyController } from './biomechanics.controller';
import { BiomechanicsService } from './biomechanics.service';

@Module({
  controllers: [BiomechanicsController, BiomechanicsLegacyController],
  providers: [BiomechanicsService],
  exports: [BiomechanicsService],
})
export class BiomechanicsModule {}
