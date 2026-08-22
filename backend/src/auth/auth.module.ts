import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { AuthController, MeController } from './auth.controller';
import { AuditModule } from '../audit/audit.module';
import { EmailService } from '../notifications/email.service';

@Global()
@Module({
  imports: [AuditModule],
  controllers: [AuthController, MeController],
  providers: [AuthService, AuthGuard, PermissionsGuard, EmailService],
  exports: [AuthService, AuthGuard, PermissionsGuard],
})
export class AuthModule {}
