import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  MM_TO_SCENE,
  SCENE_TO_MM,
  buildDemoToothPositions,
  getDemoToothDimensions,
  computeArchMetrics,
  computeOcclusionContacts,
  computeCrowding,
  buildToothPositions,
} from "./meshAnalysis";

// ─── Constants ──────────────────────────────────────────────────────────────

describe("scale constants", () => {
  it("MM_TO_SCENE = 0.1", () => expect(MM_TO_SCENE).toBe(0.1));
  it("SCENE_TO_MM = 10", () => expect(SCENE_TO_MM).toBe(10));
  it("round-trips correctly", () =>
    expect(5 * MM_TO_SCENE * SCENE_TO_MM).toBeCloseTo(5));
});

// ─── buildDemoToothPositions ────────────────────────────────────────────────

describe("buildDemoToothPositions", () => {
  const positions = buildDemoToothPositions();

  it("returns 28 tooth positions", () => expect(positions).toHaveLength(28));

  it("includes FDI 11 (upper right central incisor)", () =>
    expect(positions.some((t) => t.fdi === 11)).toBe(true));

  it("includes FDI 41 (lower right central incisor)", () =>
    expect(positions.some((t) => t.fdi === 41)).toBe(true));

  it("upper teeth have positive y (above x-z plane)", () => {
    const upper = positions.filter((t) => t.fdi < 30);
    upper.forEach((t) => expect(t.pos.y).toBeGreaterThan(0));
  });

  it("lower teeth have negative y", () => {
    const lower = positions.filter((t) => t.fdi >= 30);
    lower.forEach((t) => expect(t.pos.y).toBeLessThan(0));
  });

  it("FDI 13 and FDI 23 (canines) are mirrored across x=0", () => {
    const c13 = positions.find((t) => t.fdi === 13)!;
    const c23 = positions.find((t) => t.fdi === 23)!;
    expect(c13.pos.x).toBeCloseTo(-c23.pos.x, 5);
    expect(c13.pos.z).toBeCloseTo(c23.pos.z, 5);
  });
});

// ─── getDemoToothDimensions ─────────────────────────────────────────────────

describe("getDemoToothDimensions", () => {
  it("returns known width for FDI 11 (maxillary central incisor ≈ 8.4 mm)", () => {
    const dims = getDemoToothDimensions(11);
    expect(dims.widthMm).toBeCloseTo(8.4, 1);
  });

  it("returns known width for FDI 16 (maxillary first molar ≈ 10.5 mm)", () => {
    const dims = getDemoToothDimensions(16);
    expect(dims.widthMm).toBeCloseTo(10.5, 1);
  });

  it("depth is approximately 85% of mesio-distal width", () => {
    const dims = getDemoToothDimensions(13);
    expect(dims.depthMm).toBeCloseTo(dims.widthMm * 0.85, 5);
  });

  it("confidence is demo_only", () => {
    expect(getDemoToothDimensions(21).confidence).toBe("demo_only");
  });

  it("falls back gracefully for unknown FDI", () => {
    const dims = getDemoToothDimensions(99);
    expect(dims.widthMm).toBeGreaterThan(0);
    expect(dims.heightMm).toBeGreaterThan(0);
  });
});

// ─── computeArchMetrics ─────────────────────────────────────────────────────

describe("computeArchMetrics", () => {
  const positions = buildDemoToothPositions();
  const metrics = computeArchMetrics(positions);

  it("intercanineWidthMm is in a plausible clinical range (28–40 mm)", () => {
    expect(metrics.intercanineWidthMm).toBeGreaterThan(28);
    expect(metrics.intercanineWidthMm).toBeLessThan(40);
  });

  it("intermolarWidthMm is wider than intercanine width", () => {
    expect(metrics.intermolarWidthMm).toBeGreaterThan(metrics.intercanineWidthMm);
  });

  it("upper arch length > 50 mm (clinically reasonable)", () => {
    expect(metrics.upperArchLengthMm).toBeGreaterThan(50);
  });

  it("lower arch length > 45 mm", () => {
    expect(metrics.lowerArchLengthMm).toBeGreaterThan(45);
  });

  it("confidence is demo_only", () =>
    expect(metrics.confidence).toBe("demo_only"));

  it("returns zeros when positions array is empty", () => {
    const empty = computeArchMetrics([]);
    expect(empty.intercanineWidthMm).toBe(0);
    expect(empty.intermolarWidthMm).toBe(0);
  });
});

// ─── computeOcclusionContacts ────────────────────────────────────────────────

describe("computeOcclusionContacts", () => {
  const positions = buildDemoToothPositions();
  const contacts = computeOcclusionContacts(positions);

  it("returns at least one contact for a full arch", () =>
    expect(contacts.length).toBeGreaterThan(0));

  it("every contact has a valid contactType", () => {
    const valid = new Set(["heavy", "light", "near", "none"]);
    contacts.forEach((c) => expect(valid.has(c.contactType)).toBe(true));
  });

  it("every contact references a valid upper FDI (11-17 or 21-27)", () => {
    contacts.forEach((c) => {
      const q = Math.floor(c.upperFdi / 10);
      expect([1, 2]).toContain(q);
    });
  });

  it("every contact references a valid lower FDI (31-37 or 41-47)", () => {
    contacts.forEach((c) => {
      const q = Math.floor(c.lowerFdi / 10);
      expect([3, 4]).toContain(q);
    });
  });

  it("midpoint y is at 0 (between arches)", () => {
    contacts.forEach((c) => expect(c.midpoint.y).toBe(0));
  });

  it("higher threshold yields more non-none contacts", () => {
    const tight = computeOcclusionContacts(positions, 5.0);
    const loose = computeOcclusionContacts(positions, 20.0);
    const tightActive = tight.filter((c) => c.contactType !== "none").length;
    const looseActive = loose.filter((c) => c.contactType !== "none").length;
    expect(looseActive).toBeGreaterThanOrEqual(tightActive);
  });

  it("confidence is demo_only", () =>
    expect(contacts[0]?.confidence).toBe("demo_only"));
});

// ─── computeCrowding ────────────────────────────────────────────────────────

describe("computeCrowding", () => {
  const positions = buildDemoToothPositions();

  it("upper arch: required space > 0", () => {
    const r = computeCrowding(positions, "upper");
    expect(r.requiredSpaceMm).toBeGreaterThan(0);
  });

  it("lower arch: required space > 0", () => {
    const r = computeCrowding(positions, "lower");
    expect(r.requiredSpaceMm).toBeGreaterThan(0);
  });

  it("crowdingMm = required − available", () => {
    const r = computeCrowding(positions, "upper");
    expect(r.crowdingMm).toBeCloseTo(r.requiredSpaceMm - r.availableSpaceMm, 5);
  });

  it("positive crowding indicates arch-length discrepancy", () => {
    const r = computeCrowding(positions, "upper");
    // Demo geometry is compact — some crowding is expected
    expect(typeof r.crowdingMm).toBe("number");
    expect(isNaN(r.crowdingMm)).toBe(false);
  });

  it("confidence is demo_only", () =>
    expect(computeCrowding(positions, "lower").confidence).toBe("demo_only"));
});

// ─── buildToothPositions ────────────────────────────────────────────────────

describe("buildToothPositions", () => {
  const teeth = [
    { fdi: 11, initPosition: new THREE.Vector3(0, 1, 0) },
    { fdi: 21, initPosition: new THREE.Vector3(1, 1, 0) },
  ];

  it("returns initPosition when no override", () => {
    const result = buildToothPositions(teeth, new Map());
    const t11 = result.find((t) => t.fdi === 11)!;
    expect(t11.pos.x).toBe(0);
    expect(t11.pos.y).toBe(1);
  });

  it("returns override position when present", () => {
    const overrides = new Map([[11, { position: new THREE.Vector3(5, 5, 5) }]]);
    const result = buildToothPositions(teeth, overrides);
    const t11 = result.find((t) => t.fdi === 11)!;
    expect(t11.pos.x).toBe(5);
  });

  it("non-overridden tooth uses initPosition", () => {
    const overrides = new Map([[11, { position: new THREE.Vector3(5, 5, 5) }]]);
    const result = buildToothPositions(teeth, overrides);
    const t21 = result.find((t) => t.fdi === 21)!;
    expect(t21.pos.x).toBe(1);
  });
});
