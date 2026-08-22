/**
 * STL parsing and validation for uploaded dental scans.
 *
 * Supports binary and ASCII STL. Pure functions over a Buffer — no I/O.
 * Metadata is computed from the actual file content; nothing is estimated.
 */

export interface StlMetadata {
  format: 'binary' | 'ascii';
  triangleCount: number;
  /** Axis-aligned bounding box in file units (dental scans: millimetres). */
  boundingBox: {
    min: [number, number, number];
    max: [number, number, number];
    size: [number, number, number];
  };
  /** Triangles whose three vertices are not all finite numbers. */
  invalidTriangleCount: number;
  /** Triangles with (near-)zero area. */
  degenerateTriangleCount: number;
}

export interface StlValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  metadata: StlMetadata | null;
}

const BINARY_HEADER_BYTES = 84;
const BINARY_TRIANGLE_BYTES = 50;

/** Largest triangle count we accept (≈ 5 GB binary STL — far beyond any scan). */
const MAX_TRIANGLES = 100_000_000;

/** Dental scans are mm-scale: warn outside these overall extents. */
const MIN_REASONABLE_EXTENT_MM = 1;
const MAX_REASONABLE_EXTENT_MM = 1000;

const DEGENERATE_AREA_EPSILON = 1e-12;

function looksBinary(buf: Buffer): boolean {
  if (buf.length < BINARY_HEADER_BYTES) return false;
  const declared = buf.readUInt32LE(80);
  if (declared === 0) return false;
  return buf.length === BINARY_HEADER_BYTES + declared * BINARY_TRIANGLE_BYTES;
}

interface TriangleAccumulator {
  count: number;
  invalid: number;
  degenerate: number;
  min: [number, number, number];
  max: [number, number, number];
}

function newAccumulator(): TriangleAccumulator {
  return {
    count: 0,
    invalid: 0,
    degenerate: 0,
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}

/** v0..v2 are 9 floats (x,y,z per vertex). */
function accumulateTriangle(acc: TriangleAccumulator, v: number[]): void {
  acc.count++;
  let finite = true;
  for (let i = 0; i < 9; i++) {
    if (!Number.isFinite(v[i])) { finite = false; break; }
  }
  if (!finite) { acc.invalid++; return; }

  for (let p = 0; p < 3; p++) {
    for (let a = 0; a < 3; a++) {
      const c = v[p * 3 + a];
      if (c < acc.min[a]) acc.min[a] = c;
      if (c > acc.max[a]) acc.max[a] = c;
    }
  }

  // Cross product magnitude → 2× triangle area
  const ux = v[3] - v[0], uy = v[4] - v[1], uz = v[5] - v[2];
  const wx = v[6] - v[0], wy = v[7] - v[1], wz = v[8] - v[2];
  const cx = uy * wz - uz * wy;
  const cy = uz * wx - ux * wz;
  const cz = ux * wy - uy * wx;
  if (cx * cx + cy * cy + cz * cz < DEGENERATE_AREA_EPSILON) acc.degenerate++;
}

function finishMetadata(acc: TriangleAccumulator, format: 'binary' | 'ascii'): StlMetadata {
  const hasBox = acc.count > acc.invalid;
  const min: [number, number, number] = hasBox ? acc.min : [0, 0, 0];
  const max: [number, number, number] = hasBox ? acc.max : [0, 0, 0];
  return {
    format,
    triangleCount: acc.count,
    boundingBox: {
      min,
      max,
      size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
    },
    invalidTriangleCount: acc.invalid,
    degenerateTriangleCount: acc.degenerate,
  };
}

function parseBinary(buf: Buffer): StlMetadata {
  const declared = buf.readUInt32LE(80);
  const acc = newAccumulator();
  const v = new Array<number>(9);
  for (let t = 0; t < declared; t++) {
    // 12 bytes normal skipped, then 3 vertices × 3 floats
    const base = BINARY_HEADER_BYTES + t * BINARY_TRIANGLE_BYTES + 12;
    for (let i = 0; i < 9; i++) v[i] = buf.readFloatLE(base + i * 4);
    accumulateTriangle(acc, v);
  }
  return finishMetadata(acc, 'binary');
}

function parseAscii(buf: Buffer): StlMetadata {
  const text = buf.toString('latin1');
  const acc = newAccumulator();
  const vertexRe = /vertex\s+([^\s]+)\s+([^\s]+)\s+([^\s]+)/g;
  const v = new Array<number>(9);
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = vertexRe.exec(text)) !== null) {
    v[idx * 3] = Number(m[1]);
    v[idx * 3 + 1] = Number(m[2]);
    v[idx * 3 + 2] = Number(m[3]);
    idx++;
    if (idx === 3) {
      accumulateTriangle(acc, v);
      idx = 0;
    }
  }
  return finishMetadata(acc, 'ascii');
}

/**
 * Parse and validate an STL buffer. Returns metadata plus blocking errors
 * (malformed/empty/unusable) and non-blocking warnings (scale, degenerate
 * triangles).
 */
export function validateStl(buf: Buffer): StlValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (buf.length === 0) {
    return { valid: false, errors: ['File is empty'], warnings, metadata: null };
  }

  let metadata: StlMetadata;
  if (looksBinary(buf)) {
    const declared = buf.readUInt32LE(80);
    if (declared > MAX_TRIANGLES) {
      return {
        valid: false,
        errors: [`Declared triangle count ${declared} exceeds limit`],
        warnings,
        metadata: null,
      };
    }
    metadata = parseBinary(buf);
  } else if (buf.subarray(0, 512).toString('latin1').toLowerCase().includes('solid')) {
    metadata = parseAscii(buf);
    if (metadata.triangleCount === 0) {
      return {
        valid: false,
        errors: ['No triangles found — file is not a parseable STL mesh'],
        warnings,
        metadata: null,
      };
    }
  } else {
    // Neither a size-consistent binary STL nor ASCII "solid" content.
    const declared = buf.length >= BINARY_HEADER_BYTES ? buf.readUInt32LE(80) : 0;
    return {
      valid: false,
      errors: [
        buf.length >= BINARY_HEADER_BYTES
          ? `File size does not match binary STL layout (declared ${declared} triangles)`
          : 'File is too small to be an STL mesh',
      ],
      warnings,
      metadata: null,
    };
  }

  if (metadata.triangleCount === 0) {
    errors.push('Mesh contains no triangles');
  }
  if (metadata.invalidTriangleCount > 0) {
    errors.push(`${metadata.invalidTriangleCount} triangles contain non-finite coordinates`);
  }
  if (metadata.degenerateTriangleCount > 0) {
    const pct = (metadata.degenerateTriangleCount / metadata.triangleCount) * 100;
    (pct > 10 ? errors : warnings).push(
      `${metadata.degenerateTriangleCount} zero-area triangles (${pct.toFixed(1)}%)`,
    );
  }

  const extent = Math.max(...metadata.boundingBox.size);
  if (errors.length === 0 && extent > 0) {
    if (extent < MIN_REASONABLE_EXTENT_MM) {
      warnings.push(
        `Mesh extent ${extent.toFixed(3)} mm is unusually small — check units (expected millimetres)`,
      );
    } else if (extent > MAX_REASONABLE_EXTENT_MM) {
      warnings.push(
        `Mesh extent ${extent.toFixed(0)} mm is unusually large — check units (expected millimetres)`,
      );
    }
  }

  return { valid: errors.length === 0, errors, warnings, metadata };
}
