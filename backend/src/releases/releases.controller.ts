import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ReleasesService } from './releases.service';

@Controller('releases')
export class ReleasesController {
  constructor(private readonly releases: ReleasesService) {}

  @Get('latest')
  getLatest() {
    return this.releases.getLatest();
  }

  @Get()
  getAll() {
    return this.releases.getAll();
  }
}

@Controller('download')
export class DownloadController {
  constructor(private readonly releases: ReleasesService) {}

  @Get('version')
  getVersion() {
    const latest = this.releases.getLatest();
    return { version: latest.version, build: latest.build, channel: latest.channel };
  }

  @Get('macos')
  getMacos() {
    const latest = this.releases.getLatest();
    return latest.assets.filter((a) => a.platform === 'macos');
  }

  @Get('windows')
  getWindows() {
    const latest = this.releases.getLatest();
    return latest.assets.filter((a) => a.platform === 'windows');
  }

  @Get('checksum/:filename')
  getChecksum(@Param('filename') filename: string) {
    const asset = this.releases.findAssetByFilename(filename);
    if (!asset) throw new NotFoundException('Asset not found');
    return { filename: asset.filename, sha256: asset.sha256, algorithm: 'sha256' };
  }
}
