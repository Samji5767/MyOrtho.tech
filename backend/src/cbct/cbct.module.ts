import { Module } from '@nestjs/common';
import { CbctController } from './cbct.controller';
import { CbctService } from './cbct.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [CbctController],
  providers: [CbctService],
  exports: [CbctService],
})
export class CbctModule {}
