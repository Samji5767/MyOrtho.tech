import { Module } from '@nestjs/common';
import { PrintersController } from './printers.controller';
import { PrintersService } from './printers.service';
import { NestingService } from './nesting.service';

@Module({
  controllers: [PrintersController],
  providers: [PrintersService, NestingService],
  exports: [PrintersService, NestingService],
})
export class PrintersModule {}
