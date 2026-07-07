import * as THREE from "three";

// Scene unit ↔ mm conversion for the demo tooth geometry
// buildTeethObjects places FDI 13/23 (canines) ~3.3 units apart ≈ 33 mm real → 1 unit = 10 mm
export const MM_TO_SCENE = 0.1;
export const SCENE_TO_MM = 10;

// ─── Confidence labels ─────────────────────────────────────────────────────────

export type MeasurementConfidence = "real_geometry" | "estimated_mesh" | "estimated" | "demo_only";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ToothPos {
  fdi: number;
  pos: THREE.Vector3;
}

export interface ToothDimensions {
  fdi: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  confidence: MeasurementConfidence;
}

export interface ArchMetrics {
  intercanineWidthMm: number;
  intermolarWidthMm: number;
  upperArchLengthMm: number;
  lowerArchLengthMm: number;
  confidence: MeasurementConfidence;
}

export interface OcclusionContact {
  upperFdi: number;
  lowerFdi: number;
  distanceMm: number;
  contactType: "heavy" | "light" | "near" | "none";
  midpoint: THREE.Vector3;
  confidence: MeasurementConfidence;
}

export interface CrowdingResult {
  arch: "upper" | "lower";
  availableSpaceMm: number;
  requiredSpaceMm: number;
  crowdingMm: number; // positive = crowding, negative = spacing
  confidence: MeasurementConfidence;
}

// ─── Average tooth widths (mesiodistal, mm) — population means ────────────────

const TOOTH_WIDTHS_MM: Record<number, number> = {
  11: 8.4, 12: 6.8, 13: 7.8, 14: 7.1, 15: 6.8, 16: 10.5, 17: 9.8,
  21: 8.4, 22: 6.8, 23: 7.8, 24: 7.1, 25: 6.8, 26: 10.5, 27: 9.8,
  41: 5.4, 42: 5.8, 43: 6.6, 44: 7.3, 45: 7.2, 46: 11.1, 47: 10.2,
  31: 5.4, 32: 5.8, 33: 6.6, 34: 7.3, 35: 7.2, 36: 11.1, 37: 10.2,
};

const TOOTH_HEIGHTS_MM: Record<number, number> = {
  11: 10.8, 12: 9.0, 13: 11.0, 14: 8.5, 15: 8.3, 16: 7.5, 17: 6.8,
  21: 10.8, 22: 9.0, 23: 11.0, 24: 8.5, 25: 8.3, 26: 7.5, 27: 6.8,
  41: 9.0,  42: 9.5, 43: 10.5, 44: 8.8, 45: 8.0, 46: 7.5, 47: 7.0,
  31: 9.0,  32: 9.5, 33: 10.5, 34: 8.8, 35: 8.0, 36: 7.5, 37: 7.0,
};

// ─── Demo arch topology (mirrors CADEngine buildTeethObjects positions exactly) ─

const UPPER_FDIS_DEMO = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27];
const LOWER_FDIS_DEMO = [41, 42, 43, 44, 45, 46, 47, 31, 32, 33, 34, 35, 36, 37];

export function buildDemoToothPositions(): ToothPos[] {
  const positions: ToothPos[] = [];

  UPPER_FDIS_DEMO.forEach((fdi) => {
    const isQ1 = fdi < 21;
    const idx = isQ1 ? fdi - 11 : fdi - 21;
    const side = isQ1 ? -1 : 1;
    const t = idx / 6.0;
    const x = side * (0.35 + idx * 0.64);
    const z = -(0.55 + t * t * 1.1);
    positions.push({ fdi, pos: new THREE.Vector3(x, 0.55, z) });
  });

  LOWER_FDIS_DEMO.forEach((fdi) => {
    const isQ4 = fdi > 40;
    const idx = isQ4 ? fdi - 41 : fdi - 31;
    const side = isQ4 ? -1 : 1;
    const t = idx / 6.0;
    const x = side * (0.35 + idx * 0.62);
    const z = 0.55 + t * t * 1.05;
    positions.push({ fdi, pos: new THREE.Vector3(x, -0.55, z) });
  });

  return positions;
}

// ─── Tooth dimensions lookup (demo population averages) ───────────────────────

export function getDemoToothDimensions(fdi: number): ToothDimensions {
  return {
    fdi,
    widthMm: TOOTH_WIDTHS_MM[fdi] ?? 7.5,
    heightMm: TOOTH_HEIGHTS_MM[fdi] ?? 9.0,
    depthMm: (TOOTH_WIDTHS_MM[fdi] ?? 7.5) * 0.85, // buccolingual ≈ 85% of MD width
    confidence: "estimated",
  };
}

// ─── Arch length computation ──────────────────────────────────────────────────

function archLength(positions: ToothPos[], fdis: number[]): number {
  let total = 0;
  for (let i = 1; i < fdis.length; i++) {
    const a = positions.find((t) => t.fdi === fdis[i - 1])?.pos;
    const b = positions.find((t) => t.fdi === fdis[i])?.pos;
    if (a && b) total += a.distanceTo(b) * SCENE_TO_MM;
  }
  return total;
}

// ─── Arch metrics ─────────────────────────────────────────────────────────────

export function computeArchMetrics(toothPositions: ToothPos[]): ArchMetrics {
  const at = (fdi: number) => toothPositions.find((t) => t.fdi === fdi)?.pos;

  const u13 = at(13);
  const u23 = at(23);
  const u16 = at(16);
  const u26 = at(26);

  const intercanineWidthMm = u13 && u23 ? u13.distanceTo(u23) * SCENE_TO_MM : 0;
  const intermolarWidthMm  = u16 && u26 ? u16.distanceTo(u26) * SCENE_TO_MM : 0;

  const upperFdis = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
  const lowerFdis = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

  return {
    intercanineWidthMm,
    intermolarWidthMm,
    upperArchLengthMm: archLength(toothPositions, upperFdis),
    lowerArchLengthMm: archLength(toothPositions, lowerFdis),
    confidence: "estimated",
  };
}

// ─── Occlusion contact detection ──────────────────────────────────────────────

// Clinically relevant upper/lower antagonist pairs (FDI)
const OCCLUSION_PAIRS: [number, number][] = [
  [16, 46], [16, 47],
  [17, 47],
  [15, 45], [15, 44],
  [14, 44], [14, 45],
  [13, 43],
  [12, 42], [12, 41],
  [11, 41], [11, 42],
  [21, 31], [21, 32],
  [22, 32], [22, 31],
  [23, 33],
  [24, 34], [24, 35],
  [25, 35], [25, 34],
  [26, 36], [26, 37],
  [27, 37],
];

function toContactType(distMm: number, threshold: number): OcclusionContact["contactType"] {
  if (distMm < threshold * 0.25) return "heavy";
  if (distMm < threshold * 0.5)  return "light";
  if (distMm < threshold)         return "near";
  return "none";
}

export function computeOcclusionContacts(
  toothPositions: ToothPos[],
  thresholdMm = 8.0,
): OcclusionContact[] {
  const contacts: OcclusionContact[] = [];

  for (const [upperFdi, lowerFdi] of OCCLUSION_PAIRS) {
    const upper = toothPositions.find((t) => t.fdi === upperFdi)?.pos;
    const lower = toothPositions.find((t) => t.fdi === lowerFdi)?.pos;
    if (!upper || !lower) continue;

    // Proximity in the XZ plane (ignore the Y/vertical arch separation)
    const dx = upper.x - lower.x;
    const dz = upper.z - lower.z;
    const distMm = Math.sqrt(dx * dx + dz * dz) * SCENE_TO_MM;
    const contactType = toContactType(distMm, thresholdMm);

    contacts.push({
      upperFdi,
      lowerFdi,
      distanceMm: distMm,
      contactType,
      midpoint: new THREE.Vector3(
        (upper.x + lower.x) / 2,
        0,
        (upper.z + lower.z) / 2,
      ),
      confidence: "estimated",
    });
  }

  return contacts;
}

// ─── Crowding / spacing analysis ──────────────────────────────────────────────

export function computeCrowding(
  toothPositions: ToothPos[],
  arch: "upper" | "lower",
): CrowdingResult {
  const fdis = arch === "upper"
    ? [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27]
    : [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

  const availableSpaceMm = archLength(toothPositions, fdis);
  const requiredSpaceMm  = fdis.reduce((s, fdi) => s + (TOOTH_WIDTHS_MM[fdi] ?? 7.5), 0);

  return {
    arch,
    availableSpaceMm,
    requiredSpaceMm,
    crowdingMm: requiredSpaceMm - availableSpaceMm,
    confidence: "estimated",
  };
}

// ─── Smile arc quality ────────────────────────────────────────────────────────

export interface SmileArcResult {
  /** 0–1; 1 = perfectly consonant arc (upper anteriors follow a smooth parabola) */
  consonanceScore: number;
  arcType: "consonant" | "flat" | "reverse";
  /** Estimated radius of curvature of the anterior arch segment (mm) */
  anteriorRadiusMm: number;
  /** RMS deviation of tooth positions from the best-fit parabolic arc (mm) */
  residualRmsMm: number;
  confidence: MeasurementConfidence;
}

/**
 * Evaluate smile arc consonance from upper anterior tooth positions.
 *
 * Fits a parabola (Z = a·X² + b·X + c) to teeth 13/12/11/21/22/23 in the
 * arch plane (XZ) and reports how tightly they follow a smooth curve (R²).
 * A positive leading coefficient (arch opens posteriorly) is "consonant".
 */
export function computeSmileArcQuality(toothPositions: ToothPos[]): SmileArcResult {
  const anteriorFdis = [13, 12, 11, 21, 22, 23];
  const pts = anteriorFdis
    .map((fdi) => toothPositions.find((t) => t.fdi === fdi)?.pos)
    .filter((p): p is THREE.Vector3 => p != null);

  if (pts.length < 3) {
    return { consonanceScore: 0, arcType: "flat", anteriorRadiusMm: 0, residualRmsMm: 0, confidence: "estimated" };
  }

  const xs = pts.map((p) => p.x);
  const zs = pts.map((p) => p.z);
  const n = pts.length;

  // Accumulate sums for least-squares fit of Z = a·X² + b·X + c
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  let t0 = 0, t1 = 0, t2 = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i], z = zs[i];
    s1 += x; s2 += x * x; s3 += x * x * x; s4 += x * x * x * x;
    t0 += z; t1 += x * z; t2 += x * x * z;
  }
  const A = [[s4, s3, s2], [s3, s2, s1], [s2, s1, n]];
  const bv = [t2, t1, t0];

  const det3 = (m: number[][]): number =>
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  const D = det3(A);
  let a = 0, coefB = 0, coefC = 0;
  if (Math.abs(D) > 1e-12) {
    const A0 = [[bv[0], A[0][1], A[0][2]], [bv[1], A[1][1], A[1][2]], [bv[2], A[2][1], A[2][2]]];
    const A1 = [[A[0][0], bv[0], A[0][2]], [A[1][0], bv[1], A[1][2]], [A[2][0], bv[2], A[2][2]]];
    const A2 = [[A[0][0], A[0][1], bv[0]], [A[1][0], A[1][1], bv[1]], [A[2][0], A[2][1], bv[2]]];
    a     = det3(A0) / D;
    coefB = det3(A1) / D;
    coefC = det3(A2) / D;
  }

  // Compute R² for the parabola fit
  const zMean = t0 / n;
  let ssTot = 0, ssRes = 0;
  for (let i = 0; i < n; i++) {
    const zPred = a * xs[i] * xs[i] + coefB * xs[i] + coefC;
    ssTot += (zs[i] - zMean) ** 2;
    ssRes += (zs[i] - zPred) ** 2;
  }
  const r2 = ssTot > 1e-12 ? Math.max(0, 1 - ssRes / ssTot) : 1;
  const residualRmsMm = Math.round(Math.sqrt(ssRes / n) * SCENE_TO_MM * 100) / 100;

  // Radius of curvature at arc vertex ≈ 1 / (2·|a|) in scene units
  const anteriorRadiusMm = Math.abs(a) > 1e-6
    ? Math.round((1 / (2 * Math.abs(a))) * SCENE_TO_MM * 10) / 10
    : 999;

  // Upper arch parabola opens posteriorly (a > 0) → consonant
  const arcType: SmileArcResult["arcType"] =
    a > 0.05 ? "consonant" : a < -0.05 ? "reverse" : "flat";

  const directionWeight = arcType === "consonant" ? 1 : arcType === "flat" ? 0.5 : 0;
  const consonanceScore = Math.round(r2 * directionWeight * 100) / 100;

  return { consonanceScore, arcType, anteriorRadiusMm, residualRmsMm, confidence: "estimated" };
}

// ─── Build tooth positions from gizmo overrides ───────────────────────────────

export function buildToothPositions(
  teeth: { fdi: number; initPosition: THREE.Vector3 }[],
  overrides: Map<number, { position: THREE.Vector3 }>,
): ToothPos[] {
  return teeth.map((t) => ({
    fdi: t.fdi,
    pos: overrides.get(t.fdi)?.position ?? t.initPosition,
  }));
}
