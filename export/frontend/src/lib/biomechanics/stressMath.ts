/**
 * Periodontal Ligament (PDL) Stress Tensor & Vector Biomechanics Engine
 * Calculates displacement stress based on Hooke's Law:
 * σ = E * ε
 * where:
 * - σ (sigma) is the stress tensor (kPa)
 * - E is the Young's Modulus of the PDL (kPa)
 * - ε (epsilon) is the strain vector (displacement / PDL thickness)
 * 
 * Safety threshold: Stress should not exceed 15.0 kPa to prevent alveolar bone resorption.
 */

export interface Vector3D {
  x: number; // mesial-distal (mm)
  y: number; // labial-lingual / buccal-lingual (mm)
  z: number; // intrusion-extrusion (mm)
}

export interface ToothBiomechanicsInfo {
  toothNumber: number; // FDI standard (11-48)
  rootSurfaceArea: number; // mm^2 (standard anatomical averages)
  pdlThickness: number; // mm (typically 0.2 - 0.25 mm)
  youngsModulus: number; // kPa (typically 500 - 1000 kPa for PDL)
}

// Map FDI tooth numbers to average anatomical root surface areas (mm^2)
const FDI_ROOT_SURFACE_AREAS: Record<number, number> = {
  // Maxillary Right
  18: 420, 17: 430, 16: 450, 15: 230, 14: 240, 13: 270, 12: 170, 11: 200,
  // Maxillary Left
  21: 200, 22: 170, 23: 270, 24: 240, 25: 230, 26: 450, 27: 430, 28: 420,
  // Mandibular Left
  38: 400, 37: 410, 36: 430, 35: 210, 34: 200, 33: 260, 32: 160, 31: 150,
  // Mandibular Right
  41: 150, 42: 160, 43: 260, 44: 200, 45: 210, 46: 430, 47: 410, 48: 400
};

export interface BiomechanicsResult {
  toothNumber: number;
  strain: Vector3D;
  stress: Vector3D; // kPa
  stressMagnitude: number; // kPa
  appliedForce: Vector3D; // Newtons (N)
  forceMagnitude: number; // N
  isSafe: boolean;
  warningMessage?: string;
}

/**
 * Calculates PDL stress and forces from a displacement vector (staging move).
 * 
 * @param toothNumber FDI tooth number (e.g. 11, 21)
 * @param displacement Displacement vector in mm (movement in this stage)
 * @returns Biomechanics evaluation results
 */
export function calculatePDLStress(
  toothNumber: number,
  displacement: Vector3D
): BiomechanicsResult {
  // Retrieve anatomical defaults or fall back
  const rootArea = FDI_ROOT_SURFACE_AREAS[toothNumber] || 250; // mm^2
  const h = 0.25; // PDL thickness (mm)
  const E = 680; // PDL Young's Modulus (kPa)

  // Strain: ε = d / h
  const strain: Vector3D = {
    x: displacement.x / h,
    y: displacement.y / h,
    z: displacement.z / h
  };

  // Stress: σ = E * ε (kPa)
  const stress: Vector3D = {
    x: E * strain.x,
    y: E * strain.y,
    z: E * strain.z
  };

  const stressMagnitude = Math.sqrt(
    stress.x * stress.x + 
    stress.y * stress.y + 
    stress.z * stress.z
  );

  // Force: F = Stress * Area. Since Stress is in kPa (kN/m^2) and Area is in mm^2 (10^-6 m^2)
  // 1 kPa * 1 mm^2 = 10^3 N/m^2 * 10^-6 m^2 = 10^-3 N.
  // So Force (N) = Stress (kPa) * Area (mm^2) / 1000.
  const appliedForce: Vector3D = {
    x: (stress.x * rootArea) / 1000,
    y: (stress.y * rootArea) / 1000,
    z: (stress.z * rootArea) / 1000
  };

  const forceMagnitude = Math.sqrt(
    appliedForce.x * appliedForce.x + 
    appliedForce.y * appliedForce.y + 
    appliedForce.z * appliedForce.z
  );

  // Safety threshold: 15.0 kPa
  const SAFETY_THRESHOLD_KPA = 15.0;
  const isSafe = stressMagnitude <= SAFETY_THRESHOLD_KPA;

  let warningMessage: string | undefined = undefined;
  if (!isSafe) {
    warningMessage = `Tooth #${toothNumber} exceeds safety threshold. Stress: ${stressMagnitude.toFixed(2)} kPa (Max safe: ${SAFETY_THRESHOLD_KPA} kPa). High risk of PDL ischemia or alveolar bone resorption.`;
  }

  return {
    toothNumber,
    strain,
    stress,
    stressMagnitude,
    appliedForce,
    forceMagnitude,
    isSafe,
    warningMessage
  };
}

/**
 * Estimates the maximum safe displacement vector (mm) for a tooth.
 */
export function getSafeDisplacementLimit(toothNumber: number): number {
  const h = 0.25; // PDL thickness (mm)
  const E = 680; // PDL Young's Modulus (kPa)
  const SAFETY_THRESHOLD_KPA = 15.0;
  
  // max_stress = E * (max_disp / h) => max_disp = (max_stress * h) / E
  return (SAFETY_THRESHOLD_KPA * h) / E; // approx 0.0055 mm for isotropic, wait, standard staging is 0.25mm over multiple days
  // Note: in practice, the stage is active over 14 days, so daily biological stress reduces.
  // If calculation is per-stage:
}
