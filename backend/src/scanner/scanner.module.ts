import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
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
  imports: [AuthModule],
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
