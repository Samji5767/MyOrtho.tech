import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MovementConstraintsService } from './movement-constraints.service';
import { MovementConstraintsController } from './movement-constraints.controller';

@Module({
  imports: [AuthModule],
  controllers: [MovementConstraintsController],
  providers: [MovementConstraintsService],
  exports: [MovementConstraintsService],
})
export class MovementConstraintsModule {}
