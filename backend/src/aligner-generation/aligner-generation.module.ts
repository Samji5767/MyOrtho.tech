import { Module } from '@nestjs/common';
import { AlignerGenerationService } from './aligner-generation.service';
import { AlignerGenerationController } from './aligner-generation.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [AlignerGenerationService],
  controllers: [AlignerGenerationController],
})
export class AlignerGenerationModule {}
