/**
 * Unit tests for STL/PLY/OBJ magic-byte validation in ScansService.
 *
 * The private validateScanMagicBytes() method is exercised indirectly through
 * create(), which also calls verifyCaseOwnership() and writes to disk.
 * We stub the pool, the filesystem, and inject real file buffers to isolate the
 * validation logic.
 */

// Must be set before ScansService is imported so the module-level UPLOAD_DIR
// constant captures the temp directory instead of the default /app/uploads.
process.env.UPLOADS_DIR = require('os').tmpdir();

import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ScansService } from './scans.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeService(): ScansService {
  const mockPool = {
    query: jest.fn().mockResolvedValue({
      rows: [{ id: 'case-1' }],
    }),
  };
  // ScansService constructor takes only pool
  return new (ScansService as any)(mockPool);
}

/**
 * Write a buffer to a temp file and return a minimal Express.Multer.File-like
 * object pointing to it.
 */
function writeTempFile(buf: Buffer, originalname: string): Express.Multer.File {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stl-test-'));
  const tmpPath = path.join(tmpDir, originalname);
  fs.writeFileSync(tmpPath, buf);
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype: 'application/octet-stream',
    destination: tmpDir,
    filename: originalname,
    path: tmpPath,
    size: buf.length,
    buffer: buf,
    stream: null as any,
  } as Express.Multer.File;
}

/**
 * Build a minimal valid binary STL buffer.
 * Format: 80-byte ASCII header | uint32LE triangle count | N × 50-byte triangles
 * Each triangle: 3×float32 normal + 3×(3×float32 vertex) + uint16 attribute = 50 bytes
 */
function makeBinaryStl(triangleCount: number, headerPrefix = ''): Buffer {
  const header = Buffer.alloc(80, 0);
  const prefix = Buffer.from(headerPrefix.slice(0, 80), 'ascii');
  prefix.copy(header, 0);

  const countBuf = Buffer.alloc(4);
  countBuf.writeUInt32LE(triangleCount, 0);

  const triangleData = Buffer.alloc(triangleCount * 50, 0);
  return Buffer.concat([header, countBuf, triangleData]);
}

/** Build a minimal ASCII STL string. */
function makeAsciiStl(name = 'test'): Buffer {
  const stl = `solid ${name}\n  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex 1 0 0\n      vertex 0 1 0\n    endloop\n  endfacet\nendsolid ${name}\n`;
  return Buffer.from(stl, 'ascii');
}

// ─── Binary STL ───────────────────────────────────────────────────────────────

describe('ScansService — binary STL validation', () => {
  let service: ScansService;

  beforeEach(() => {
    service = makeService();
  });

  it('accepts a valid binary STL with 4 triangles', async () => {
    const buf = makeBinaryStl(4);
    const file = writeTempFile(buf, 'scan.stl');

    // Should not throw; pool mock returns caseId row for ownership check
    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).resolves.not.toThrow();
  });

  it('accepts a binary STL with 10 000 triangles (dental scan scale)', async () => {
    const buf = makeBinaryStl(10_000);
    const file = writeTempFile(buf, 'dental.stl');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'mandibular', 'dr@test.com'),
    ).resolves.not.toThrow();
  });

  it('accepts a binary STL whose 80-byte header begins with "solid " (common in practice)', async () => {
    // Many binary STLs (e.g. from dental scanners) write "solid <name>" in
    // the 80-byte ASCII header field. Old code misclassified these as ASCII STLs.
    const buf = makeBinaryStl(6, 'solid MyScannerName');
    const file = writeTempFile(buf, 'scanner-output.stl');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).resolves.not.toThrow();
  });

  it('rejects a truncated binary STL (file too small for declared triangle count)', async () => {
    // Declare 1 000 triangles but only write 0 bytes of triangle data
    const header = Buffer.alloc(80, 0);
    const countBuf = Buffer.alloc(4);
    countBuf.writeUInt32LE(1_000, 0);
    const truncated = Buffer.concat([header, countBuf]); // missing 50 000 bytes

    const file = writeTempFile(truncated, 'truncated.stl');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a binary STL shorter than 84 bytes (no room for header + count)', async () => {
    const short = Buffer.alloc(83, 0);
    const file = writeTempFile(short, 'short.stl');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a binary STL with triangle count = 0', async () => {
    const buf = makeBinaryStl(0);
    const file = writeTempFile(buf, 'empty-triangles.stl');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an empty file (0 bytes)', async () => {
    const file = writeTempFile(Buffer.alloc(0), 'empty.stl');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── ASCII STL ────────────────────────────────────────────────────────────────

describe('ScansService — ASCII STL validation', () => {
  let service: ScansService;

  beforeEach(() => {
    service = makeService();
  });

  it('accepts a valid ASCII STL', async () => {
    const buf = makeAsciiStl('mandible');
    const file = writeTempFile(buf, 'ascii.stl');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'mandibular', 'dr@test.com'),
    ).resolves.not.toThrow();
  });

  it('rejects a file with .stl extension but OBJ content', async () => {
    const objContent = Buffer.from('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n', 'ascii');
    const file = writeTempFile(objContent, 'bad.stl');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── PLY files ────────────────────────────────────────────────────────────────

describe('ScansService — PLY validation', () => {
  let service: ScansService;

  beforeEach(() => {
    service = makeService();
  });

  it('accepts a valid PLY file (starts with "ply")', async () => {
    const plyHeader = 'ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nend_header\n0 0 0\n1 0 0\n0 1 0\n';
    const buf = Buffer.from(plyHeader, 'ascii');
    const file = writeTempFile(buf, 'scan.ply');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).resolves.not.toThrow();
  });

  it('rejects a .ply file that does not start with "ply"', async () => {
    const bogus = Buffer.from('not-a-ply-file\n', 'ascii');
    const file = writeTempFile(bogus, 'bad.ply');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── OBJ files ────────────────────────────────────────────────────────────────

describe('ScansService — OBJ validation', () => {
  let service: ScansService;

  beforeEach(() => {
    service = makeService();
  });

  it('accepts a valid OBJ file', async () => {
    const obj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
    const file = writeTempFile(Buffer.from(obj, 'ascii'), 'scan.obj');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).resolves.not.toThrow();
  });

  it('rejects a .obj file with non-OBJ content', async () => {
    const bogus = Buffer.from('this is not obj content at all\n', 'ascii');
    const file = writeTempFile(bogus, 'bad.obj');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── jaw_type validation ──────────────────────────────────────────────────────

describe('ScansService — jaw_type validation', () => {
  let service: ScansService;

  beforeEach(() => {
    service = makeService();
  });

  it('rejects an invalid jaw_type before reading the file', async () => {
    const buf = makeBinaryStl(4);
    const file = writeTempFile(buf, 'scan.stl');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'invalid' as any, 'dr@test.com'),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── Unsupported extension ────────────────────────────────────────────────────

describe('ScansService — unsupported extension rejection', () => {
  let service: ScansService;

  beforeEach(() => {
    service = makeService();
  });

  it('rejects a .png file with a clear 400 message (not 500)', async () => {
    // PNG magic bytes: \x89PNG
    const pngBuf = Buffer.from('\x89PNG\r\n\x1a\n', 'binary');
    const file = writeTempFile(pngBuf, 'scan.png');

    const err = await service
      .create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com')
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).message).toContain('stl');
  });

  it('rejects a .dcm (DICOM) file', async () => {
    const buf = Buffer.alloc(256, 0);
    const file = writeTempFile(buf, 'scan.dcm');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a file with no extension', async () => {
    const buf = makeBinaryStl(4);
    const file = writeTempFile(buf, 'scanfile');

    await expect(
      service.create('case-1', 'org-1', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).rejects.toThrow(BadRequestException);
  });
});

// ─── Cross-org isolation ──────────────────────────────────────────────────────

describe('ScansService — cross-org case isolation', () => {
  it('rejects upload when case belongs to a different org', async () => {
    const mockPool = {
      query: jest.fn().mockResolvedValue({ rows: [] }), // case not found for this org
    };
    const service = new (ScansService as any)(mockPool);

    const buf = makeBinaryStl(4);
    const file = writeTempFile(buf, 'scan.stl');

    await expect(
      service.create('case-other-org', 'org-attacker', 'user-1', file, 'maxillary', 'dr@test.com'),
    ).rejects.toThrow();
  });
});
