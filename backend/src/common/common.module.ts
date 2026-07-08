import { Module, Global } from '@nestjs/common';
import { CryptoService } from './crypto.service';
import { CorrelationIdMiddleware } from './correlation-id.middleware';
import { VersionController } from './version.controller';

@Global()
@Module({
  controllers: [VersionController],
  providers: [CryptoService, CorrelationIdMiddleware],
  exports: [CryptoService],
})
export class CommonModule {}
