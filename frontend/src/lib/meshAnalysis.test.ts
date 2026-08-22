import { describe, it, expect } from "vitest";
import { MM_TO_SCENE, SCENE_TO_MM } from "./meshAnalysis";

describe("scale constants", () => {
  it("MM_TO_SCENE = 0.1", () => expect(MM_TO_SCENE).toBe(0.1));
  it("SCENE_TO_MM = 10", () => expect(SCENE_TO_MM).toBe(10));
  it("round-trips correctly", () =>
    expect(5 * MM_TO_SCENE * SCENE_TO_MM).toBeCloseTo(5));
});
