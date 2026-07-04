import { Module } from '@nestjs/common';
import { ReleasesController, DownloadController } from './releases.controller';
import { ReleasesService } from './releases.service';

@Module({
  controllers: [ReleasesController, DownloadController],
  providers: [ReleasesService],
  exports: [ReleasesService],
})
export class ReleasesModule {}
