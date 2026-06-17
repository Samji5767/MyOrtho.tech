import { Module } from '@nestjs/common';
import { RestorativeController } from './restorative.controller';
import { RestorativeService } from './restorative.service';

@Module({
  controllers: [RestorativeController],
  providers: [RestorativeService],
  exports: [RestorativeService],
})
export class RestorativeModule {}
