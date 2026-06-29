import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrgLocationsService } from './org-locations.service';
import { OrgLocationsController } from './org-locations.controller';

@Module({
  imports: [AuthModule],
  controllers: [OrgLocationsController],
  providers: [OrgLocationsService],
  exports: [OrgLocationsService],
})
export class OrgLocationsModule {}
