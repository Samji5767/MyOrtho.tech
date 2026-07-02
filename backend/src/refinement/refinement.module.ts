import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RefinementController } from './refinement.controller';
import { RefinementService } from './refinement.service';

@Module({
  imports: [AuthModule],
  controllers: [RefinementController],
  providers: [RefinementService],
  exports: [RefinementService],
})
export class RefinementModule {}
