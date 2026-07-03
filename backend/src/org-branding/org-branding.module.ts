import { Module } from '@nestjs/common';
import { OrgBrandingService } from './org-branding.service';
import { OrgBrandingController } from './org-branding.controller';

@Module({
  controllers: [OrgBrandingController],
  providers: [OrgBrandingService],
  exports: [OrgBrandingService],
})
export class OrgBrandingModule {}
