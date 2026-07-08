import { Controller, Get } from '@nestjs/common';
import { getVersionInfo, VersionInfo } from './version';

@Controller()
export class VersionController {
  @Get('api/version')
  getVersion(): VersionInfo {
    return getVersionInfo();
  }

  @Get('api/version/health')
  healthWithVersion() {
    return { status: 'ok', ...getVersionInfo() };
  }
}
