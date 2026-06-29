import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OutcomesService } from './outcomes.service';
import { OutcomesController } from './outcomes.controller';

@Module({
  imports: [AuthModule],
  controllers: [OutcomesController],
  providers: [OutcomesService],
  exports: [OutcomesService],
})
export class OutcomesModule {}
