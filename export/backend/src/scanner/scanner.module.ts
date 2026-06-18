import { Module } from '@nestjs/common';
import { ScannerService } from './scanner.service';
import { ScannerController } from './scanner.controller';
import { 
  ThreeShapeConnector, 
  MeditLinkConnector, 
  IteroConnector, 
  Shining3DConnector,
  CarestreamConnector
} from './connectors/scanner.connector';

@Module({
  controllers: [ScannerController],
  providers: [
    ScannerService,
    ThreeShapeConnector,
    MeditLinkConnector,
    IteroConnector,
    Shining3DConnector,
    CarestreamConnector,
  ],
  exports: [ScannerService],
})
export class ScannerModule {}
