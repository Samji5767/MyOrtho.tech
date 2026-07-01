import * as THREE from "three";

// Scene unit ↔ mm conversion for the demo tooth geometry
// buildTeethObjects places FDI 13/23 (canines) ~3.3 units apart ≈ 33 mm real → 1 unit = 10 mm
export const MM_TO_SCENE = 0.1;
export const SCENE_TO_MM = 10;

export interface ArchMetrics {
  intercanineWidthMm: number;
  intermolarWidthMm: number;
  upperArchLengthMm: number;
  lowerArchLengthMm: number;
}

interface ToothPos {
  fdi: number;
  pos: THREE.Vector3;
}

function archLength(positions: ToothPos[], fdis: number[]): number {
  let total = 0;
  for (let i = 1; i < fdis.length; i++) {
    const a = positions.find((t) => t.fdi === fdis[i - 1])?.pos;
    const b = positions.find((t) => t.fdi === fdis[i])?.pos;
    if (a && b) total += a.distanceTo(b) * SCENE_TO_MM;
  }
  return total;
}

export function computeArchMetrics(toothPositions: ToothPos[]): ArchMetrics {
  const at = (fdi: number) => toothPositions.find((t) => t.fdi === fdi)?.pos;

  const u13 = at(13);
  const u23 = at(23);
  const u16 = at(16);
  const u26 = at(26);

  const intercanineWidthMm = u13 && u23 ? u13.distanceTo(u23) * SCENE_TO_MM : 0;
  const intermolarWidthMm = u16 && u26 ? u16.distanceTo(u26) * SCENE_TO_MM : 0;

  const upperFdis = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
  const lowerFdis = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

  return {
    intercanineWidthMm,
    intermolarWidthMm,
    upperArchLengthMm: archLength(toothPositions, upperFdis),
    lowerArchLengthMm: archLength(toothPositions, lowerFdis),
  };
}

export function buildToothPositions(
  teeth: { fdi: number; initPosition: THREE.Vector3 }[],
  overrides: Map<number, { position: THREE.Vector3 }>,
): ToothPos[] {
  return teeth.map((t) => ({
    fdi: t.fdi,
    pos: overrides.get(t.fdi)?.position ?? t.initPosition,
  }));
}
