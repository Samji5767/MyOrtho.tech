import { Module } from '@nestjs/common';
import { MlopsService } from './mlops.service';
import { MlopsController } from './mlops.controller';

@Module({
  providers: [MlopsService],
  controllers: [MlopsController],
  exports: [MlopsService],
})
export class MlopsModule {}
