import { describe, it, expect } from "vitest";
import {
  reducer,
  INITIAL_STATE,
  getMovement,
  getIPRForPair,
  hasAttachment,
  getAttachmentsForTooth,
  type CasePlanningState,
  type PlanningAttachment,
  type PlanningIPR,
} from "./CasePlanningContext";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bare(): CasePlanningState {
  return {
    ...INITIAL_STATE,
    movements: {},
    attachments: [],
    iprEntries: [],
    measurements: [],
    workflowSteps: {},
  };
}

// ─── SET_CASE_ID ─────────────────────────────────────────────────────────────

describe("SET_CASE_ID", () => {
  it("stores a new case id", () => {
    const s = reducer(bare(), { type: "SET_CASE_ID", caseId: "case-42" });
    expect(s.caseId).toBe("case-42");
  });

  it("accepts null", () => {
    const s = reducer({ ...bare(), caseId: "old" }, { type: "SET_CASE_ID", caseId: null });
    expect(s.caseId).toBeNull();
  });
});

// ─── UPDATE_MOVEMENT ─────────────────────────────────────────────────────────

describe("UPDATE_MOVEMENT", () => {
  it("creates movement from zero when none exists", () => {
    const s = reducer(bare(), { type: "UPDATE_MOVEMENT", fdi: 11, mov: { tx: 0.3 } });
    expect(s.movements[11]).toBeDefined();
    expect(s.movements[11].tx).toBeCloseTo(0.3);
    expect(s.movements[11].ty).toBe(0);
  });

  it("merges into existing movement without overwriting untouched keys", () => {
    const s0 = reducer(bare(), { type: "UPDATE_MOVEMENT", fdi: 21, mov: { tx: 0.2, ty: 0.1 } });
    const s1 = reducer(s0, { type: "UPDATE_MOVEMENT", fdi: 21, mov: { tip: 5 } });
    expect(s1.movements[21].tx).toBeCloseTo(0.2);
    expect(s1.movements[21].ty).toBeCloseTo(0.1);
    expect(s1.movements[21].tip).toBe(5);
  });

  it("preserves other teeth movements", () => {
    const s0 = reducer(bare(), { type: "UPDATE_MOVEMENT", fdi: 11, mov: { tx: 0.1 } });
    const s1 = reducer(s0, { type: "UPDATE_MOVEMENT", fdi: 21, mov: { tx: 0.2 } });
    expect(s1.movements[11].tx).toBeCloseTo(0.1);
    expect(s1.movements[21].tx).toBeCloseTo(0.2);
  });
});

// ─── RESET_MOVEMENT ──────────────────────────────────────────────────────────

describe("RESET_MOVEMENT", () => {
  it("removes a movement entry", () => {
    const s0 = reducer(bare(), { type: "UPDATE_MOVEMENT", fdi: 13, mov: { tx: 1 } });
    const s1 = reducer(s0, { type: "RESET_MOVEMENT", fdi: 13 });
    expect(s1.movements[13]).toBeUndefined();
  });

  it("is a no-op for a tooth with no movement", () => {
    const s = reducer(bare(), { type: "RESET_MOVEMENT", fdi: 99 });
    expect(Object.keys(s.movements)).toHaveLength(0);
  });

  it("does not affect other teeth", () => {
    const s0 = reducer(bare(), { type: "UPDATE_MOVEMENT", fdi: 11, mov: { tx: 0.1 } });
    const s1 = reducer(s0, { type: "UPDATE_MOVEMENT", fdi: 21, mov: { tx: 0.2 } });
    const s2 = reducer(s1, { type: "RESET_MOVEMENT", fdi: 11 });
    expect(s2.movements[11]).toBeUndefined();
    expect(s2.movements[21].tx).toBeCloseTo(0.2);
  });
});

// ─── RESET_ALL_MOVEMENTS ─────────────────────────────────────────────────────

describe("RESET_ALL_MOVEMENTS", () => {
  it("clears every tooth movement", () => {
    let s = bare();
    s = reducer(s, { type: "UPDATE_MOVEMENT", fdi: 11, mov: { tx: 1 } });
    s = reducer(s, { type: "UPDATE_MOVEMENT", fdi: 21, mov: { tx: 2 } });
    s = reducer(s, { type: "RESET_ALL_MOVEMENTS" });
    expect(Object.keys(s.movements)).toHaveLength(0);
  });

  it("is idempotent on empty movements", () => {
    const s = reducer(bare(), { type: "RESET_ALL_MOVEMENTS" });
    expect(s.movements).toEqual({});
  });
});

// ─── ADD_ATTACHMENT ──────────────────────────────────────────────────────────

describe("ADD_ATTACHMENT", () => {
  const att: PlanningAttachment = {
    id: "att_1", fdi: 13, type: "Rotation", surface: "Buccal", stage: 1,
  };

  it("appends a new attachment", () => {
    const s = reducer(bare(), { type: "ADD_ATTACHMENT", entry: att });
    expect(s.attachments).toHaveLength(1);
    expect(s.attachments[0].id).toBe("att_1");
  });

  it("preserves existing attachments", () => {
    const s0 = reducer(bare(), { type: "ADD_ATTACHMENT", entry: att });
    const att2: PlanningAttachment = { id: "att_2", fdi: 23, type: "Rotation", surface: "Buccal", stage: 2 };
    const s1 = reducer(s0, { type: "ADD_ATTACHMENT", entry: att2 });
    expect(s1.attachments).toHaveLength(2);
  });
});

// ─── REMOVE_ATTACHMENT ───────────────────────────────────────────────────────

describe("REMOVE_ATTACHMENT", () => {
  it("removes by id", () => {
    const att: PlanningAttachment = { id: "del_me", fdi: 14, type: "Vertical Rectangular", surface: "Buccal", stage: 3 };
    const s0 = reducer(bare(), { type: "ADD_ATTACHMENT", entry: att });
    const s1 = reducer(s0, { type: "REMOVE_ATTACHMENT", id: "del_me" });
    expect(s1.attachments.some((a) => a.id === "del_me")).toBe(false);
  });

  it("leaves other attachments intact", () => {
    let s = bare();
    s = reducer(s, { type: "ADD_ATTACHMENT", entry: { id: "a1", fdi: 11, type: "X", surface: "B", stage: 1 } });
    s = reducer(s, { type: "ADD_ATTACHMENT", entry: { id: "a2", fdi: 21, type: "X", surface: "B", stage: 1 } });
    s = reducer(s, { type: "REMOVE_ATTACHMENT", id: "a1" });
    expect(s.attachments).toHaveLength(1);
    expect(s.attachments[0].id).toBe("a2");
  });
});

// ─── ADD_IPR / REMOVE_IPR ────────────────────────────────────────────────────

describe("ADD_IPR", () => {
  const ipr: PlanningIPR = { id: "ipr_1", toothA: 12, toothB: 13, amount: 0.2, stage: 3, safety: "safe" };

  it("appends IPR entry", () => {
    const s = reducer(bare(), { type: "ADD_IPR", entry: ipr });
    expect(s.iprEntries).toHaveLength(1);
    expect(s.iprEntries[0].amount).toBeCloseTo(0.2);
  });
});

describe("REMOVE_IPR", () => {
  it("removes IPR entry by id", () => {
    const ipr: PlanningIPR = { id: "ipr_del", toothA: 22, toothB: 23, amount: 0.2, stage: 3, safety: "safe" };
    let s = reducer(bare(), { type: "ADD_IPR", entry: ipr });
    s = reducer(s, { type: "REMOVE_IPR", id: "ipr_del" });
    expect(s.iprEntries.some((e) => e.id === "ipr_del")).toBe(false);
  });
});

// ─── TOGGLE booleans ─────────────────────────────────────────────────────────

describe("TOGGLE_OCCLUSION_CONTACTS", () => {
  it("flips false → true", () => {
    const s = reducer(bare(), { type: "TOGGLE_OCCLUSION_CONTACTS" });
    expect(s.showOcclusionContacts).toBe(true);
  });

  it("flips true → false", () => {
    const s0 = { ...bare(), showOcclusionContacts: true };
    const s1 = reducer(s0, { type: "TOGGLE_OCCLUSION_CONTACTS" });
    expect(s1.showOcclusionContacts).toBe(false);
  });
});

describe("TOGGLE_IPR_OVERLAY", () => {
  it("flips false → true", () => {
    const s = reducer(bare(), { type: "TOGGLE_IPR_OVERLAY" });
    expect(s.showIPROverlay).toBe(true);
  });

  it("flips true → false", () => {
    const s0 = { ...bare(), showIPROverlay: true };
    expect(reducer(s0, { type: "TOGGLE_IPR_OVERLAY" }).showIPROverlay).toBe(false);
  });
});

describe("TOGGLE_ALIGNER_SHELL", () => {
  it("flips false → true", () => {
    expect(reducer(bare(), { type: "TOGGLE_ALIGNER_SHELL" }).showAlignerShell).toBe(true);
  });
});

describe("TOGGLE_GHOST_ARCH", () => {
  it("flips false → true", () => {
    expect(reducer(bare(), { type: "TOGGLE_GHOST_ARCH" }).showGhostArch).toBe(true);
  });
});

describe("TOGGLE_ROOTS", () => {
  it("flips false → true", () => {
    expect(reducer(bare(), { type: "TOGGLE_ROOTS" }).showRoots).toBe(true);
  });
});

// ─── Scalar setters ───────────────────────────────────────────────────────────

describe("SET_ALIGNER_THICKNESS", () => {
  it("stores new thickness", () => {
    const s = reducer(bare(), { type: "SET_ALIGNER_THICKNESS", thickness: 0.75 });
    expect(s.alignerThickness).toBeCloseTo(0.75);
  });
});

describe("SET_ALIGNER_ARCH", () => {
  it("stores arch selection", () => {
    const s = reducer(bare(), { type: "SET_ALIGNER_ARCH", arch: "upper" });
    expect(s.alignerArch).toBe("upper");
  });
});

describe("SET_REVIEW_NOTES", () => {
  it("stores review notes", () => {
    const s = reducer(bare(), { type: "SET_REVIEW_NOTES", notes: "Needs re-check on FDI 13" });
    expect(s.reviewNotes).toBe("Needs re-check on FDI 13");
  });
});

describe("SET_STAGE", () => {
  it("updates currentStage", () => {
    const s = reducer(bare(), { type: "SET_STAGE", stage: 7 });
    expect(s.currentStage).toBe(7);
  });
});

describe("SET_TOTAL_STAGES", () => {
  it("updates totalStages", () => {
    const s = reducer(bare(), { type: "SET_TOTAL_STAGES", total: 30 });
    expect(s.totalStages).toBe(30);
  });
});

describe("SET_GHOST_OPACITY", () => {
  it("updates ghostOpacity", () => {
    const s = reducer(bare(), { type: "SET_GHOST_OPACITY", opacity: 0.5 });
    expect(s.ghostOpacity).toBeCloseTo(0.5);
  });
});

describe("SET_CLIPPING_AXIS", () => {
  it("stores axis", () => {
    const s = reducer(bare(), { type: "SET_CLIPPING_AXIS", axis: "coronal" });
    expect(s.clippingAxis).toBe("coronal");
  });
});

describe("SET_CLIPPING_POSITION", () => {
  it("stores position", () => {
    const s = reducer(bare(), { type: "SET_CLIPPING_POSITION", position: 2.5 });
    expect(s.clippingPosition).toBeCloseTo(2.5);
  });
});

// ─── SET_MEASUREMENTS / UPDATE_MEASUREMENT ───────────────────────────────────

describe("SET_MEASUREMENTS", () => {
  it("replaces entire measurements array", () => {
    const m = [{ id: "overjet", label: "Overjet", value: "3.0", unit: "mm", note: "" }];
    const s = reducer(bare(), { type: "SET_MEASUREMENTS", measurements: m });
    expect(s.measurements).toHaveLength(1);
    expect(s.measurements[0].value).toBe("3.0");
  });
});

describe("UPDATE_MEASUREMENT", () => {
  it("updates the value of a specific measurement by id", () => {
    const m = [
      { id: "overjet", label: "Overjet", value: "4.2", unit: "mm", note: "" },
      { id: "overbite", label: "Overbite", value: "3.1", unit: "mm", note: "" },
    ];
    const s0 = reducer(bare(), { type: "SET_MEASUREMENTS", measurements: m });
    const s1 = reducer(s0, { type: "UPDATE_MEASUREMENT", id: "overjet", value: "2.8" });
    const overjet = s1.measurements.find((m) => m.id === "overjet");
    expect(overjet?.value).toBe("2.8");
    // Other measurement unchanged
    const overbite = s1.measurements.find((m) => m.id === "overbite");
    expect(overbite?.value).toBe("3.1");
  });
});

// ─── SET_WORKFLOW_STEP ────────────────────────────────────────────────────────

describe("SET_WORKFLOW_STEP", () => {
  it("sets a step status", () => {
    const s = reducer(bare(), { type: "SET_WORKFLOW_STEP", stepId: "scan", status: "complete" });
    expect(s.workflowSteps["scan"]).toBe("complete");
  });

  it("overwrites existing step status", () => {
    const s0 = reducer(bare(), { type: "SET_WORKFLOW_STEP", stepId: "scan", status: "in_progress" });
    const s1 = reducer(s0, { type: "SET_WORKFLOW_STEP", stepId: "scan", status: "complete" });
    expect(s1.workflowSteps["scan"]).toBe("complete");
  });
});

// ─── LOAD_PERSISTED ───────────────────────────────────────────────────────────

describe("LOAD_PERSISTED", () => {
  it("merges partial state over defaults", () => {
    const s = reducer(bare(), {
      type: "LOAD_PERSISTED",
      partial: { reviewNotes: "loaded note", alignerThickness: 0.9 },
    });
    expect(s.reviewNotes).toBe("loaded note");
    expect(s.alignerThickness).toBeCloseTo(0.9);
  });

  it("does not lose keys not present in partial", () => {
    const s = reducer(bare(), {
      type: "LOAD_PERSISTED",
      partial: { reviewNotes: "x" },
    });
    expect(s.currentStage).toBe(INITIAL_STATE.currentStage);
  });
});

// ─── Selector: getMovement ───────────────────────────────────────────────────

describe("getMovement selector", () => {
  it("returns zero movement for a tooth with no entry", () => {
    const m = getMovement(bare(), 11);
    expect(m.fdi).toBe(11);
    expect(m.tx).toBe(0);
  });

  it("returns stored movement when present", () => {
    const s = reducer(bare(), { type: "UPDATE_MOVEMENT", fdi: 21, mov: { tx: 0.5, tip: 3 } });
    const m = getMovement(s, 21);
    expect(m.tx).toBeCloseTo(0.5);
    expect(m.tip).toBe(3);
  });
});

// ─── Selector: getIPRForPair ─────────────────────────────────────────────────

describe("getIPRForPair selector", () => {
  it("returns 0 when no IPR planned", () => {
    expect(getIPRForPair(bare(), 12, 13)).toBe(0);
  });

  it("returns amount for a planned pair", () => {
    const s = reducer(bare(), {
      type: "ADD_IPR",
      entry: { id: "x", toothA: 12, toothB: 13, amount: 0.25, stage: 3, safety: "safe" },
    });
    expect(getIPRForPair(s, 12, 13)).toBeCloseTo(0.25);
  });

  it("is commutative (toothA/toothB order-independent)", () => {
    const s = reducer(bare(), {
      type: "ADD_IPR",
      entry: { id: "y", toothA: 22, toothB: 23, amount: 0.15, stage: 4, safety: "safe" },
    });
    expect(getIPRForPair(s, 23, 22)).toBeCloseTo(0.15);
  });
});

// ─── Selector: hasAttachment ─────────────────────────────────────────────────

describe("hasAttachment selector", () => {
  it("returns false when no attachment for tooth", () => {
    expect(hasAttachment(bare(), 11)).toBe(false);
  });

  it("returns true when attachment exists for tooth", () => {
    const s = reducer(bare(), {
      type: "ADD_ATTACHMENT",
      entry: { id: "a1", fdi: 13, type: "Rotation", surface: "Buccal", stage: 1 },
    });
    expect(hasAttachment(s, 13)).toBe(true);
  });
});

// ─── Selector: getAttachmentsForTooth ───────────────────────────────────────

describe("getAttachmentsForTooth selector", () => {
  it("returns empty array when no attachments", () => {
    expect(getAttachmentsForTooth(bare(), 11)).toHaveLength(0);
  });

  it("returns only attachments for the requested tooth", () => {
    let s = bare();
    s = reducer(s, { type: "ADD_ATTACHMENT", entry: { id: "a1", fdi: 13, type: "R", surface: "B", stage: 1 } });
    s = reducer(s, { type: "ADD_ATTACHMENT", entry: { id: "a2", fdi: 13, type: "V", surface: "B", stage: 2 } });
    s = reducer(s, { type: "ADD_ATTACHMENT", entry: { id: "a3", fdi: 23, type: "R", surface: "B", stage: 1 } });
    const result = getAttachmentsForTooth(s, 13);
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.fdi === 13)).toBe(true);
  });
});
