import { validateStl } from './stl-metadata';

// ─── STL builders ─────────────────────────────────────────────────────────────

type Tri = [number, number, number][];

function binaryStl(triangles: Tri[]): Buffer {
  const buf = Buffer.alloc(84 + triangles.length * 50);
  buf.write('unit-test binary stl', 0, 'latin1');
  buf.writeUInt32LE(triangles.length, 80);
  triangles.forEach((tri, t) => {
    const base = 84 + t * 50;
    // normal left as zeros (12 bytes)
    tri.forEach((v, p) => {
      v.forEach((c, a) => buf.writeFloatLE(c, base + 12 + p * 12 + a * 4));
    });
    buf.writeUInt16LE(0, base + 48);
  });
  return buf;
}

function asciiStl(triangles: Tri[]): Buffer {
  const lines = ['solid test'];
  for (const tri of triangles) {
    lines.push('  facet normal 0 0 1', '    outer loop');
    for (const v of tri) lines.push(`      vertex ${v[0]} ${v[1]} ${v[2]}`);
    lines.push('    endloop', '  endfacet');
  }
  lines.push('endsolid test');
  return Buffer.from(lines.join('\n'), 'latin1');
}

/** One 10 mm right triangle in the z=0 plane. */
const TRI_10MM: Tri = [
  [0, 0, 0],
  [10, 0, 0],
  [0, 10, 0],
];

// ─── Binary parsing ───────────────────────────────────────────────────────────

describe('validateStl — binary', () => {
  it('accepts a well-formed binary STL and reports exact metadata', () => {
    const r = validateStl(binaryStl([TRI_10MM]));
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.metadata?.format).toBe('binary');
    expect(r.metadata?.triangleCount).toBe(1);
    expect(r.metadata?.boundingBox.min).toEqual([0, 0, 0]);
    expect(r.metadata?.boundingBox.max).toEqual([10, 10, 0]);
    expect(r.metadata?.boundingBox.size).toEqual([10, 10, 0]);
  });

  it('rejects a truncated binary STL', () => {
    const full = binaryStl([TRI_10MM, TRI_10MM]);
    const truncated = full.subarray(0, full.length - 10);
    const r = validateStl(truncated);
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/does not match binary STL layout/);
  });

  it('rejects an empty file', () => {
    const r = validateStl(Buffer.alloc(0));
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(['File is empty']);
  });

  it('flags non-finite coordinates as errors', () => {
    const bad: Tri = [
      [0, 0, 0],
      [NaN, 0, 0],
      [0, 1, 0],
    ];
    const r = validateStl(binaryStl([TRI_10MM, bad]));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/non-finite/);
    expect(r.metadata?.invalidTriangleCount).toBe(1);
  });

  it('flags zero-area triangles', () => {
    const degenerate: Tri = [
      [5, 5, 5],
      [5, 5, 5],
      [5, 5, 5],
    ];
    const r = validateStl(binaryStl([degenerate]));
    // 100% degenerate → blocking error
    expect(r.valid).toBe(false);
    expect(r.metadata?.degenerateTriangleCount).toBe(1);
  });

  it('warns on sub-millimetre scale (unit mismatch)', () => {
    const tiny: Tri = [
      [0, 0, 0],
      [0.01, 0, 0],
      [0, 0.01, 0],
    ];
    const r = validateStl(binaryStl([tiny]));
    expect(r.valid).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/unusually small/);
  });

  it('warns on metre-scale meshes (unit mismatch)', () => {
    const huge: Tri = [
      [0, 0, 0],
      [5000, 0, 0],
      [0, 5000, 0],
    ];
    const r = validateStl(binaryStl([huge]));
    expect(r.valid).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/unusually large/);
  });
});

// ─── ASCII parsing ────────────────────────────────────────────────────────────

describe('validateStl — ascii', () => {
  it('accepts a well-formed ASCII STL', () => {
    const r = validateStl(asciiStl([TRI_10MM, TRI_10MM]));
    expect(r.valid).toBe(true);
    expect(r.metadata?.format).toBe('ascii');
    expect(r.metadata?.triangleCount).toBe(2);
  });

  it('rejects "solid" text with no triangles', () => {
    const r = validateStl(Buffer.from('solid nothing\nendsolid nothing\n'));
    expect(r.valid).toBe(false);
    expect(r.errors.join(' ')).toMatch(/No triangles/);
  });

  it('rejects arbitrary non-STL content', () => {
    const r = validateStl(Buffer.from('PK\x03\x04 this is a zip archive actually'));
    expect(r.valid).toBe(false);
  });

  it('binary STL whose header begins with "solid" still parses as binary', () => {
    const buf = binaryStl([TRI_10MM]);
    buf.write('solid header trap', 0, 'latin1');
    const r = validateStl(buf);
    expect(r.valid).toBe(true);
    expect(r.metadata?.format).toBe('binary');
  });
});
