import { describe, it, expect } from "vitest";
import {
  VELOCITY_THRESHOLDS,
  validateMovements,
  calculateCumulativeMovements,
  getTransformationMatrix,
  type ToothDisplacement,
} from "./vectorMath";

const DEG = Math.PI / 180;

// ─── VELOCITY_THRESHOLDS ────────────────────────────────────────────────────

describe("VELOCITY_THRESHOLDS", () => {
  it("MAX_TRANSLATION_MM is 0.25 mm (Keim 2008 / Proffit guidelines)", () => {
    expect(VELOCITY_THRESHOLDS.MAX_TRANSLATION_MM).toBe(0.25);
  });

  it("MAX_ROTATION_DEG is 2.0° per stage", () => {
    expect(VELOCITY_THRESHOLDS.MAX_ROTATION_DEG).toBe(2.0);
  });
});

// ─── validateMovements ──────────────────────────────────────────────────────

describe("validateMovements", () => {
  it("returns null for safe translation (0.2 mm)", () => {
    const disp: ToothDisplacement = {
      translation: [0.1, 0.1, 0.1], // magnitude ≈ 0.173 mm
      rotation: [0, 0, 0],
    };
    expect(validateMovements(11, disp)).toBeNull();
  });

  it("returns null when exactly at threshold (0.25 mm)", () => {
    const disp: ToothDisplacement = {
      translation: [0.25, 0, 0],
      rotation: [0, 0, 0],
    };
    expect(validateMovements(11, disp)).toBeNull();
  });

  it("detects translation excess at 0.3 mm", () => {
    const disp: ToothDisplacement = {
      translation: [0.3, 0, 0],
      rotation: [0, 0, 0],
    };
    const w = validateMovements(21, disp);
    expect(w).not.toBeNull();
    expect(w!.type).toBe("translation");
    expect(w!.toothId).toBe(21);
    expect(w!.value).toBeCloseTo(0.3, 5);
  });

  it("detects rotation excess at 3°", () => {
    const disp: ToothDisplacement = {
      translation: [0, 0, 0],
      rotation: [3 * DEG, 0, 0],
    };
    const w = validateMovements(13, disp);
    expect(w).not.toBeNull();
    expect(w!.type).toBe("rotation");
    expect(w!.toothId).toBe(13);
  });

  it("detects combined excess", () => {
    const disp: ToothDisplacement = {
      translation: [0.4, 0, 0],
      rotation: [5 * DEG, 0, 0],
    };
    const w = validateMovements(16, disp);
    expect(w).not.toBeNull();
    expect(w!.type).toBe("both");
  });

  it("safe rotation (1.5°) returns null", () => {
    const disp: ToothDisplacement = {
      translation: [0, 0, 0],
      rotation: [1.5 * DEG, 0, 0],
    };
    expect(validateMovements(14, disp)).toBeNull();
  });

  it("message includes FDI number", () => {
    const disp: ToothDisplacement = {
      translation: [0.5, 0, 0],
      rotation: [0, 0, 0],
    };
    const w = validateMovements(26, disp)!;
    expect(w.message).toContain("26");
  });

  it("zero displacement returns null", () => {
    const disp: ToothDisplacement = {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
    };
    expect(validateMovements(11, disp)).toBeNull();
  });
});

// ─── calculateCumulativeMovements ───────────────────────────────────────────

describe("calculateCumulativeMovements", () => {
  it("sums translations across stages for a single tooth", () => {
    const stages: Record<number, ToothDisplacement[]> = {
      11: [
        { translation: [0.1, 0, 0], rotation: [0, 0, 0] },
        { translation: [0.1, 0, 0], rotation: [0, 0, 0] },
        { translation: [0.1, 0, 0], rotation: [0, 0, 0] },
      ],
    };
    const result = calculateCumulativeMovements(stages);
    expect(result[11].totalTranslation).toBeCloseTo(0.3, 5);
  });

  it("handles multiple teeth independently", () => {
    const stages: Record<number, ToothDisplacement[]> = {
      11: [{ translation: [0.2, 0, 0], rotation: [0, 0, 0] }],
      21: [{ translation: [0, 0.15, 0], rotation: [0, 0, 0] }],
    };
    const result = calculateCumulativeMovements(stages);
    expect(result[11].totalTranslation).toBeCloseTo(0.2, 5);
    expect(result[21].totalTranslation).toBeCloseTo(0.15, 5);
  });

  it("sums rotation magnitudes across stages", () => {
    const stages: Record<number, ToothDisplacement[]> = {
      13: [
        { translation: [0, 0, 0], rotation: [1 * DEG, 0, 0] },
        { translation: [0, 0, 0], rotation: [1 * DEG, 0, 0] },
      ],
    };
    const result = calculateCumulativeMovements(stages);
    expect(result[13].totalRotation).toBeCloseTo(2, 4);
  });

  it("returns empty object for no stages", () => {
    expect(calculateCumulativeMovements({})).toEqual({});
  });
});

// ─── getTransformationMatrix ─────────────────────────────────────────────────

describe("getTransformationMatrix", () => {
  it("returns a 4×4 matrix", () => {
    const disp: ToothDisplacement = {
      translation: [1, 2, 3],
      rotation: [0, 0, 0],
    };
    const m = getTransformationMatrix(disp);
    expect(m.elements).toHaveLength(16);
  });

  it("translation is encoded in matrix elements [12], [13], [14]", () => {
    const disp: ToothDisplacement = {
      translation: [1, 2, 3],
      rotation: [0, 0, 0],
    };
    const m = getTransformationMatrix(disp);
    // THREE.Matrix4 stores column-major: [12]=tx, [13]=ty, [14]=tz
    expect(m.elements[12]).toBeCloseTo(1, 5);
    expect(m.elements[13]).toBeCloseTo(2, 5);
    expect(m.elements[14]).toBeCloseTo(3, 5);
  });

  it("identity rotation produces no rotation in matrix", () => {
    const disp: ToothDisplacement = {
      translation: [0, 0, 0],
      rotation: [0, 0, 0],
    };
    const m = getTransformationMatrix(disp);
    expect(m.elements[0]).toBeCloseTo(1, 5); // scale x
    expect(m.elements[5]).toBeCloseTo(1, 5); // scale y
    expect(m.elements[10]).toBeCloseTo(1, 5); // scale z
    expect(m.elements[15]).toBeCloseTo(1, 5); // w
  });
});
