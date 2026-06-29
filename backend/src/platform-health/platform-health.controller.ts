import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PlatformHealthService } from './platform-health.service';

@Controller('api/platform-health')
@UseGuards(AuthGuard)
export class PlatformHealthController {
  constructor(private readonly svc: PlatformHealthService) {}

  @Get()
  getReport() { return this.svc.getHealthReport(); }
}
