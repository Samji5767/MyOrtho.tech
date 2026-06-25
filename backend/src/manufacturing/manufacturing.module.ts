import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ManufacturingRouterService } from './manufacturing-router.service';
import { ManufacturingController, PrinterRegistryController } from './manufacturing.controller';
import { ManufacturingService } from './manufacturing.service';

@Module({
  imports: [AuthModule],
  controllers: [ManufacturingController, PrinterRegistryController],
  providers: [ManufacturingRouterService, ManufacturingService],
  exports: [ManufacturingRouterService, ManufacturingService],
})
export class ManufacturingModule {}
