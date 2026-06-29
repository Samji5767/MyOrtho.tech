import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmergencyProtocolsService } from './emergency-protocols.service';
import { EmergencyProtocolsController } from './emergency-protocols.controller';

@Module({
  imports: [AuthModule],
  controllers: [EmergencyProtocolsController],
  providers: [EmergencyProtocolsService],
  exports: [EmergencyProtocolsService],
})
export class EmergencyProtocolsModule {}
