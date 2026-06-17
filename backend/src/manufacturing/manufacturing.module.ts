import { Module } from '@nestjs/common';
import { ManufacturingRouterService } from './manufacturing-router.service';

@Module({
  providers: [ManufacturingRouterService],
  exports: [ManufacturingRouterService],
})
export class ManufacturingModule {}
