import { Module } from '@nestjs/common';
import { BiomechanicsController } from './biomechanics.controller';
import { BiomechanicsService } from './biomechanics.service';

@Module({
  controllers: [BiomechanicsController],
  providers: [BiomechanicsService],
  exports: [BiomechanicsService],
})
export class BiomechanicsModule {}
