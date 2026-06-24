import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RestorativeController } from './restorative.controller';
import { RestorativeService } from './restorative.service';

@Module({
  imports: [AuthModule],
  controllers: [RestorativeController],
  providers: [RestorativeService],
  exports: [RestorativeService],
})
export class RestorativeModule {}
