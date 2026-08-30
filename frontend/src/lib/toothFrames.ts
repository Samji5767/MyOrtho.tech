/**
 * Per-tooth anatomical coordinate frames derived from arch geometry.
 *
 * MIRROR of ai-engine/src/tooth_frames.py — the same algorithm, kept
 * byte-compatible by a cross-implementation fixture test. Any change here
 * MUST be mirrored there.
 *
 *   - occlusal axis: Newell normal of the tooth-centroid polygon,
 *     sign-aligned to the caller's up hint (the viewer passes scene +Y)
 *   - mesial axis: arch-curve tangent at the tooth, in the arch plane,
 *     signed toward the dental midline
 *   - buccal axis: outward from the arch centre, in the arch plane,
 *     orthogonalized against the mesial axis
 *
 * Pure number-array math (no three.js dependency) so the module can be
 * compiled standalone for the consistency test.
 */

export type V3 = [number, number, number];

const UPPER_ORDER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ORDER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (a: V3): V3 | null => {
  const n = Math.sqrt(dot(a, a));
  return n < 1e-9 ? null : scale(a, 1 / n);
};

export interface ToothFrame {
  fdi: number;
  origin: V3;
  /** unit, + = toward the dental midline along the arch */
  mesial: V3;
  /** unit, + = outward from the arch centre, in the arch plane */
  buccal: V3;
  /** unit arch-plane normal, aligned with the caller's up hint */
  occlusal: V3;
  isUpper: boolean;
  /** true when arch geometry was insufficient for a real frame */
  isFallback: boolean;
}

function fallbackFrame(fdi: number, origin: V3, up: V3): ToothFrame {
  const isRight = (fdi >= 11 && fdi <= 18) || (fdi >= 41 && fdi <= 48);
  const mesialSign = isRight ? 1 : -1;
  const x = normalize(cross([0, 1, 0], up)) ?? [1, 0, 0];
  const y = normalize(cross(up, x)) ?? [0, 0, 1];
  return {
    fdi,
    origin,
    mesial: scale(x, mesialSign),
    buccal: y,
    occlusal: up,
    isUpper: fdi < 30,
    isFallback: true,
  };
}

export function computeToothFrames(
  centroids: Map<number, V3>,
  upHint: V3 = [0, 0, 1],
): Map<number, ToothFrame> {
  const frames = new Map<number, ToothFrame>();
  const upUnit = normalize(upHint) ?? [0, 0, 1];

  for (const order of [UPPER_ORDER, LOWER_ORDER]) {
    const present = order.filter(fdi => centroids.has(fdi));
    const pts = present.map(fdi => centroids.get(fdi)!);
    const n = present.length;

    if (n < 3) {
      for (const fdi of present) frames.set(fdi, fallbackFrame(fdi, centroids.get(fdi)!, upUnit));
      continue;
    }

    const center: V3 = scale(
      pts.reduce((acc, p) => add(acc, p), [0, 0, 0] as V3),
      1 / n,
    );
    let normalAcc: V3 = [0, 0, 0];
    for (let i = 0; i < n - 1; i++) {
      normalAcc = add(normalAcc, cross(sub(pts[i], center), sub(pts[i + 1], center)));
    }
    let occlusal = normalize(normalAcc);
    if (!occlusal) {
      for (const fdi of present) frames.set(fdi, fallbackFrame(fdi, centroids.get(fdi)!, upUnit));
      continue;
    }
    if (dot(occlusal, upUnit) < 0) occlusal = scale(occlusal, -1);

    // First index in the left-side quadrant: increasing arch index moves
    // toward the midline on the right side and away from it on the left.
    const leftSide = (fdi: number) => (fdi >= 21 && fdi <= 28) || (fdi >= 31 && fdi <= 38);
    const midlineIdx = present.some(leftSide) ? present.findIndex(leftSide) : n;

    for (let i = 0; i < n; i++) {
      const fdi = present[i];
      const p = pts[i];
      let tangent = sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)]);
      tangent = sub(tangent, scale(occlusal, dot(tangent, occlusal)));
      const tUnit = normalize(tangent);

      let outward = sub(p, center);
      outward = sub(outward, scale(occlusal, dot(outward, occlusal)));
      const oUnit = normalize(outward);

      if (!tUnit || !oUnit) {
        frames.set(fdi, fallbackFrame(fdi, p, upUnit));
        continue;
      }

      const mesialSign = i < midlineIdx ? 1 : -1;
      const mesial = scale(tUnit, mesialSign);
      const buccal = normalize(sub(oUnit, scale(mesial, dot(oUnit, mesial))));
      if (!buccal) {
        frames.set(fdi, fallbackFrame(fdi, p, upUnit));
        continue;
      }

      frames.set(fdi, {
        fdi, origin: p, mesial, buccal, occlusal,
        isUpper: fdi < 30, isFallback: false,
      });
    }
  }
  return frames;
}

export type Mat3 = [V3, V3, V3];

function axisAngleMatrix(axis: V3, angleRad: number): Mat3 {
  const [x, y, z] = axis;
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  const t = 1 - c;
  return [
    [t * x * x + c, t * x * y - s * z, t * x * z + s * y],
    [t * x * y + s * z, t * y * y + c, t * y * z - s * x],
    [t * x * z - s * y, t * y * z + s * x, t * z * z + c],
  ];
}

function matMul(a: Mat3, b: Mat3): Mat3 {
  const r: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r as Mat3;
}

export interface MovementComponents {
  mesiodistalMm: number;
  buccolingualMm: number;
  occlusogingivalMm: number;
  rotationDeg: number;
  torqueDeg: number;
  tipDeg: number;
}

const DEG = Math.PI / 180;

/**
 * Map canonical signed movement components onto this tooth's frame.
 * Returns rotation matrix R (about the tooth origin) and translation t:
 * v' = R (v - origin) + origin + t. Sign conventions and composition order
 * (R = R_rotation · R_tip · R_torque) mirror tooth_frames.py exactly.
 */
export function movementTransform(frame: ToothFrame, m: MovementComponents): { r: Mat3; t: V3 } {
  const extrusionSign = frame.isUpper ? -1 : 1;
  const isRight = (frame.fdi >= 11 && frame.fdi <= 18) || (frame.fdi >= 41 && frame.fdi <= 48);
  const mesialSign = isRight ? 1 : -1;
  const archSign = frame.isUpper ? 1 : -1;

  const t = add(
    add(scale(frame.mesial, m.mesiodistalMm), scale(frame.buccal, m.buccolingualMm)),
    scale(frame.occlusal, m.occlusogingivalMm * extrusionSign),
  );

  const rTorque = axisAngleMatrix(frame.mesial, m.torqueDeg * DEG * archSign);
  const rTip = axisAngleMatrix(frame.buccal, m.tipDeg * DEG * mesialSign);
  const rRot = axisAngleMatrix(frame.occlusal, m.rotationDeg * DEG * mesialSign);
  const r = matMul(rRot, matMul(rTip, rTorque));
  return { r, t };
}

/** Rotation-matrix → quaternion [x, y, z, w] (for three.js consumption). */
export function matToQuat(r: Mat3): [number, number, number, number] {
  const trace = r[0][0] + r[1][1] + r[2][2];
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return [(r[2][1] - r[1][2]) / s, (r[0][2] - r[2][0]) / s, (r[1][0] - r[0][1]) / s, s / 4];
  }
  if (r[0][0] > r[1][1] && r[0][0] > r[2][2]) {
    const s = Math.sqrt(1 + r[0][0] - r[1][1] - r[2][2]) * 2;
    return [s / 4, (r[0][1] + r[1][0]) / s, (r[0][2] + r[2][0]) / s, (r[2][1] - r[1][2]) / s];
  }
  if (r[1][1] > r[2][2]) {
    const s = Math.sqrt(1 + r[1][1] - r[0][0] - r[2][2]) * 2;
    return [(r[0][1] + r[1][0]) / s, s / 4, (r[1][2] + r[2][1]) / s, (r[0][2] - r[2][0]) / s];
  }
  const s = Math.sqrt(1 + r[2][2] - r[0][0] - r[1][1]) * 2;
  return [(r[0][2] + r[2][0]) / s, (r[1][2] + r[2][1]) / s, s / 4, (r[1][0] - r[0][1]) / s];
}
