import { Module } from '@nestjs/common';
import { ManufacturingRouterService } from './manufacturing-router.service';
import { ManufacturingController, PrinterRegistryController } from './manufacturing.controller';
import { ManufacturingService } from './manufacturing.service';

@Module({
  controllers: [ManufacturingController, PrinterRegistryController],
  providers: [ManufacturingRouterService, ManufacturingService],
  exports: [ManufacturingRouterService, ManufacturingService],
})
export class ManufacturingModule {}
