import { Module } from '@nestjs/common';
import { RefinementController } from './refinement.controller';
import { RefinementService } from './refinement.service';

@Module({
  controllers: [RefinementController],
  providers: [RefinementService],
  exports: [RefinementService],
})
export class RefinementModule {}
