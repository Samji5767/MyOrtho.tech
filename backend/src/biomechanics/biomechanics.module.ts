import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BiomechanicsController, BiomechanicsLegacyController } from './biomechanics.controller';
import { BiomechanicsService } from './biomechanics.service';

@Module({
  imports: [AuthModule],
  controllers: [BiomechanicsController, BiomechanicsLegacyController],
  providers: [BiomechanicsService],
  exports: [BiomechanicsService],
})
export class BiomechanicsModule {}
