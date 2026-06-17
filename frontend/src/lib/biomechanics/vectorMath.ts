import * as THREE from "three";

export interface ToothDisplacement {
  translation: [number, number, number]; // [dx, dy, dz] in mm
  rotation: [number, number, number];    // [pitch, roll, yaw] in radians
}

export interface BiomechanicsWarning {
  toothId: number;
  type: "translation" | "rotation" | "both";
  message: string;
  value: number;
}

// Biological movement velocity thresholds (per stage limits)
export const VELOCITY_THRESHOLDS = {
  MAX_TRANSLATION_MM: 0.25, // max 0.25mm movement per stage to prevent root resorption
  MAX_ROTATION_DEG: 2.0,    // max 2 degrees rotation per stage
};

/**
 * Converts translation and rotation offsets into a unified 4x4 Transformation Matrix
 */
export function getTransformationMatrix(displacement: ToothDisplacement): THREE.Matrix4 {
  const { translation, rotation } = displacement;
  
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3(translation[0], translation[1], translation[2]);
  
  // Create rotation representation from Euler angles
  const euler = new THREE.Euler(rotation[0], rotation[1], rotation[2]);
  const quaternion = new THREE.Quaternion().setFromEuler(euler);
  
  const scale = new THREE.Vector3(1, 1, 1);
  
  matrix.compose(position, quaternion, scale);
  return matrix;
}

/**
 * Validates individual staging movements against biological velocity limits
 */
export function validateMovements(
  toothId: number,
  displacement: ToothDisplacement
): BiomechanicsWarning | null {
  const { translation, rotation } = displacement;

  // Linear displacement magnitude (Euclidean distance)
  const linearMag = Math.sqrt(
    translation[0] ** 2 + translation[1] ** 2 + translation[2] ** 2
  );

  // Rotational magnitude (Euclidean total across axes in degrees)
  const pitchDeg = Math.abs(rotation[0] * (180 / Math.PI));
  const rollDeg = Math.abs(rotation[1] * (180 / Math.PI));
  const yawDeg = Math.abs(rotation[2] * (180 / Math.PI));
  const rotMag = Math.sqrt(pitchDeg ** 2 + rollDeg ** 2 + yawDeg ** 2);

  const isTransExcess = linearMag > VELOCITY_THRESHOLDS.MAX_TRANSLATION_MM;
  const isRotExcess = rotMag > VELOCITY_THRESHOLDS.MAX_ROTATION_DEG;

  if (isTransExcess && isRotExcess) {
    return {
      toothId,
      type: "both",
      message: `FDI #${toothId} exceeds both linear and rotational safety thresholds.`,
      value: linearMag
    };
  } else if (isTransExcess) {
    return {
      toothId,
      type: "translation",
      message: `FDI #${toothId} linear displacement of ${linearMag.toFixed(2)}mm exceeds safety threshold of ${VELOCITY_THRESHOLDS.MAX_TRANSLATION_MM}mm.`,
      value: linearMag
    };
  } else if (isRotExcess) {
    return {
      toothId,
      type: "rotation",
      message: `FDI #${toothId} rotation of ${rotMag.toFixed(1)}° exceeds safety threshold of ${VELOCITY_THRESHOLDS.MAX_ROTATION_DEG}°.`,
      value: rotMag
    };
  }

  return null;
}

/**
 * Aggregates displacement details across all teeth to calculate total treatment loads
 */
export function calculateCumulativeMovements(
  stages: Record<number, ToothDisplacement[]>
): Record<number, { totalTranslation: number; totalRotation: number }> {
  const cumulative: Record<number, { totalTranslation: number; totalRotation: number }> = {};

  Object.entries(stages).forEach(([toothIdStr, displacements]) => {
    const toothId = parseInt(toothIdStr);
    let totalTrans = 0;
    let totalRot = 0;

    displacements.forEach((disp) => {
      const transMag = Math.sqrt(
        disp.translation[0] ** 2 + disp.translation[1] ** 2 + disp.translation[2] ** 2
      );
      
      const pitch = Math.abs(disp.rotation[0] * (180 / Math.PI));
      const roll = Math.abs(disp.rotation[1] * (180 / Math.PI));
      const yaw = Math.abs(disp.rotation[2] * (180 / Math.PI));
      const rotMag = Math.sqrt(pitch ** 2 + roll ** 2 + yaw ** 2);

      totalTrans += transMag;
      totalRot += rotMag;
    });

    cumulative[toothId] = {
      totalTranslation: totalTrans,
      totalRotation: totalRot
    };
  });

  return cumulative;
}
