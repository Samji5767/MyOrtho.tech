import { Module } from '@nestjs/common';
import { CephService } from './ceph.service';
import { CephController } from './ceph.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [CephService],
  controllers: [CephController],
})
export class CephModule {}
