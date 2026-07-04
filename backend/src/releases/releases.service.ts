import { Injectable } from '@nestjs/common';

export interface ReleaseAsset {
  platform: 'macos' | 'windows';
  variant: string;
  arch: string;
  filename: string;
  size: string | null;
  url: string | null;
  sha256: string | null;
  minOs: string;
}

export interface Release {
  version: string;
  build: string;
  date: string;
  channel: 'stable' | 'beta';
  assets: ReleaseAsset[];
  releaseNotesUrl: string;
}

const RELEASES: Release[] = [
  {
    version: '2.0.0',
    build: '2026.07.04.001',
    date: '2026-07-04',
    channel: 'stable',
    releaseNotesUrl: '/download/release-notes',
    assets: [
      {
        platform: 'macos',
        variant: 'arm',
        arch: 'Apple Silicon',
        filename: 'MyOrtho-2.0.0-arm64.dmg',
        size: null,
        url: null,
        sha256: null,
        minOs: 'macOS 13 Ventura',
      },
      {
        platform: 'macos',
        variant: 'intel',
        arch: 'Intel x64',
        filename: 'MyOrtho-2.0.0-x64.dmg',
        size: null,
        url: null,
        sha256: null,
        minOs: 'macOS 12 Monterey',
      },
      {
        platform: 'windows',
        variant: 'exe',
        arch: 'Windows x64',
        filename: 'MyOrtho-2.0.0-Setup.exe',
        size: null,
        url: null,
        sha256: null,
        minOs: 'Windows 10 22H2',
      },
      {
        platform: 'windows',
        variant: 'msi',
        arch: 'Windows x64 (MSI)',
        filename: 'MyOrtho-2.0.0-Setup.msi',
        size: null,
        url: null,
        sha256: null,
        minOs: 'Windows 10 22H2',
      },
    ],
  },
];

@Injectable()
export class ReleasesService {
  getLatest(): Release {
    return RELEASES[0];
  }

  getAll(): Release[] {
    return RELEASES;
  }

  findAssetByFilename(filename: string): ReleaseAsset | null {
    for (const release of RELEASES) {
      const asset = release.assets.find((a) => a.filename === filename);
      if (asset) return asset;
    }
    return null;
  }
}
