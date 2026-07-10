import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  fdiToUniversal,
  universalToFdi,
  formatTooth,
  quadrantLabel,
  FDI_GROUPS,
  loadNotationPref,
  saveNotationPref,
  type ToothNotation,
} from "./toothNotation";

// ─── fdiToUniversal ───────────────────────────────────────────────────────────

describe("fdiToUniversal", () => {
  // Upper Right quadrant: FDI 11-18 → Universal #8 down to #1
  it("11 (UR central incisor) → #8", () => expect(fdiToUniversal(11)).toBe(8));
  it("12 (UR lateral incisor) → #7", () => expect(fdiToUniversal(12)).toBe(7));
  it("13 (UR canine) → #6",          () => expect(fdiToUniversal(13)).toBe(6));
  it("14 (UR 1st premolar) → #5",    () => expect(fdiToUniversal(14)).toBe(5));
  it("15 (UR 2nd premolar) → #4",    () => expect(fdiToUniversal(15)).toBe(4));
  it("16 (UR 1st molar) → #3",       () => expect(fdiToUniversal(16)).toBe(3));
  it("17 (UR 2nd molar) → #2",       () => expect(fdiToUniversal(17)).toBe(2));
  it("18 (UR 3rd molar) → #1",       () => expect(fdiToUniversal(18)).toBe(1));

  // Upper Left quadrant: FDI 21-28 → Universal #9 up to #16
  it("21 (UL central incisor) → #9",  () => expect(fdiToUniversal(21)).toBe(9));
  it("22 (UL lateral incisor) → #10", () => expect(fdiToUniversal(22)).toBe(10));
  it("28 (UL 3rd molar) → #16",       () => expect(fdiToUniversal(28)).toBe(16));

  // Lower Left quadrant: FDI 31-38 → Universal #24 down to #17
  it("31 (LL central incisor) → #24", () => expect(fdiToUniversal(31)).toBe(24));
  it("38 (LL 3rd molar) → #17",       () => expect(fdiToUniversal(38)).toBe(17));

  // Lower Right quadrant: FDI 41-48 → Universal #25 up to #32
  it("41 (LR central incisor) → #25", () => expect(fdiToUniversal(41)).toBe(25));
  it("48 (LR 3rd molar) → #32",       () => expect(fdiToUniversal(48)).toBe(32));

  it("unknown FDI returns the input unchanged", () => {
    expect(fdiToUniversal(99)).toBe(99);
    expect(fdiToUniversal(0)).toBe(0);
  });

  it("covers all 32 permanent teeth", () => {
    const ALL_FDI = [
      11, 12, 13, 14, 15, 16, 17, 18,
      21, 22, 23, 24, 25, 26, 27, 28,
      31, 32, 33, 34, 35, 36, 37, 38,
      41, 42, 43, 44, 45, 46, 47, 48,
    ];
    const universalNumbers = ALL_FDI.map(fdiToUniversal);
    // All 32 Universal numbers 1-32 must appear exactly once
    const sorted = [...universalNumbers].sort((a, b) => a - b);
    expect(sorted).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });
});

// ─── universalToFdi ───────────────────────────────────────────────────────────

describe("universalToFdi", () => {
  it("#8 (UR central incisor) → FDI 11", () => expect(universalToFdi(8)).toBe(11));
  it("#1 (UR 3rd molar) → FDI 18",       () => expect(universalToFdi(1)).toBe(18));
  it("#9 (UL central incisor) → FDI 21", () => expect(universalToFdi(9)).toBe(21));
  it("#16 (UL 3rd molar) → FDI 28",      () => expect(universalToFdi(16)).toBe(28));
  it("#24 (LL central incisor) → FDI 31",() => expect(universalToFdi(24)).toBe(31));
  it("#17 (LL 3rd molar) → FDI 38",      () => expect(universalToFdi(17)).toBe(38));
  it("#25 (LR central incisor) → FDI 41",() => expect(universalToFdi(25)).toBe(41));
  it("#32 (LR 3rd molar) → FDI 48",      () => expect(universalToFdi(32)).toBe(48));

  it("unknown Universal number returns input unchanged", () => {
    expect(universalToFdi(0)).toBe(0);
    expect(universalToFdi(99)).toBe(99);
  });

  it("fdiToUniversal and universalToFdi are inverse functions", () => {
    const ALL_FDI = [
      11, 12, 13, 14, 15, 16, 17, 18,
      21, 22, 23, 24, 25, 26, 27, 28,
      31, 32, 33, 34, 35, 36, 37, 38,
      41, 42, 43, 44, 45, 46, 47, 48,
    ];
    ALL_FDI.forEach((fdi) => {
      expect(universalToFdi(fdiToUniversal(fdi))).toBe(fdi);
    });
  });
});

// ─── formatTooth ──────────────────────────────────────────────────────────────

describe("formatTooth", () => {
  it("FDI notation returns the FDI number as a string", () => {
    expect(formatTooth(11, "FDI")).toBe("11");
    expect(formatTooth(48, "FDI")).toBe("48");
    expect(formatTooth(21, "FDI")).toBe("21");
  });

  it("Universal notation returns '#N' with the Universal number", () => {
    expect(formatTooth(11, "Universal")).toBe("#8");
    expect(formatTooth(18, "Universal")).toBe("#1");
    expect(formatTooth(48, "Universal")).toBe("#32");
  });

  it("Universal notation prefixes with '#'", () => {
    const result = formatTooth(21, "Universal");
    expect(result.startsWith("#")).toBe(true);
  });

  it("FDI notation does NOT prefix with '#'", () => {
    expect(formatTooth(21, "FDI").startsWith("#")).toBe(false);
  });
});

// ─── quadrantLabel ────────────────────────────────────────────────────────────

describe("quadrantLabel", () => {
  const quadrants: Array<"UR" | "UL" | "LL" | "LR"> = ["UR", "UL", "LL", "LR"];

  it("FDI notation returns the quadrant label unchanged", () => {
    quadrants.forEach((q) => {
      expect(quadrantLabel(q, "FDI")).toBe(q);
    });
  });

  it("Universal notation includes the tooth-number range for each quadrant", () => {
    expect(quadrantLabel("UR", "Universal")).toContain("#1–8");
    expect(quadrantLabel("UL", "Universal")).toContain("#9–16");
    expect(quadrantLabel("LL", "Universal")).toContain("#17–24");
    expect(quadrantLabel("LR", "Universal")).toContain("#25–32");
  });

  it("Universal notation still includes the quadrant abbreviation", () => {
    quadrants.forEach((q) => {
      expect(quadrantLabel(q, "Universal")).toContain(q);
    });
  });
});

// ─── FDI_GROUPS ───────────────────────────────────────────────────────────────

describe("FDI_GROUPS", () => {
  it("has exactly 4 groups (UR, UL, LL, LR)", () => {
    expect(FDI_GROUPS).toHaveLength(4);
  });

  it("quadrant labels are UR, UL, LL, LR in order", () => {
    expect(FDI_GROUPS.map((g) => g.label)).toEqual(["UR", "UL", "LL", "LR"]);
  });

  it("each quadrant has exactly 8 teeth", () => {
    FDI_GROUPS.forEach((g) => {
      expect(g.teeth).toHaveLength(8);
    });
  });

  it("UR teeth are 11-18", () => {
    expect(FDI_GROUPS[0].teeth).toEqual([11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it("UL teeth are 21-28", () => {
    expect(FDI_GROUPS[1].teeth).toEqual([21, 22, 23, 24, 25, 26, 27, 28]);
  });

  it("LL teeth are 31-38", () => {
    expect(FDI_GROUPS[2].teeth).toEqual([31, 32, 33, 34, 35, 36, 37, 38]);
  });

  it("LR teeth are 41-48", () => {
    expect(FDI_GROUPS[3].teeth).toEqual([41, 42, 43, 44, 45, 46, 47, 48]);
  });

  it("total tooth count across all groups is 32", () => {
    const total = FDI_GROUPS.reduce((sum, g) => sum + g.teeth.length, 0);
    expect(total).toBe(32);
  });
});

// ─── loadNotationPref / saveNotationPref ──────────────────────────────────────

describe("loadNotationPref / saveNotationPref", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("loadNotationPref returns 'FDI' when no pref is stored", () => {
    expect(loadNotationPref()).toBe("FDI");
  });

  it("saveNotationPref persists the preference and loadNotationPref reads it back", () => {
    saveNotationPref("Universal");
    expect(loadNotationPref()).toBe("Universal");
  });

  it("can switch back to FDI after setting Universal", () => {
    saveNotationPref("Universal");
    saveNotationPref("FDI");
    expect(loadNotationPref()).toBe("FDI");
  });
});
