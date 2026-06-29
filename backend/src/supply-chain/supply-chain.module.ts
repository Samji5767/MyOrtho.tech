import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SupplyChainService } from './supply-chain.service';
import { SupplyChainController } from './supply-chain.controller';

@Module({
  imports: [AuthModule],
  controllers: [SupplyChainController],
  providers: [SupplyChainService],
  exports: [SupplyChainService],
})
export class SupplyChainModule {}
