import { describe, it, expect } from "vitest";
import {
  getCaseStatusLabel,
  getCaseStatusBadgeClass,
  getCaseStatusColor,
  getCaseStatusDotColor,
  CASE_STATUS_CONFIG,
  type CaseStatus,
} from "./caseStatus";

// All 16 defined statuses
const ALL_STATUSES = Object.keys(CASE_STATUS_CONFIG) as CaseStatus[];

// ─── getCaseStatusLabel ───────────────────────────────────────────────────────

describe("getCaseStatusLabel", () => {
  it('returns "New" for status "new"', () => {
    expect(getCaseStatusLabel("new")).toBe("New");
  });

  it('returns "Completed" for status "completed"', () => {
    expect(getCaseStatusLabel("completed")).toBe("Completed");
  });

  it('returns "Cancelled" for status "cancelled"', () => {
    expect(getCaseStatusLabel("cancelled")).toBe("Cancelled");
  });

  it('returns "Plan Approved" for status "plan_approved"', () => {
    expect(getCaseStatusLabel("plan_approved")).toBe("Plan Approved");
  });

  it('returns "Manufacturing QC" for status "manufacturing_qc"', () => {
    expect(getCaseStatusLabel("manufacturing_qc")).toBe("Manufacturing QC");
  });

  it('returns "Segmentation Review" for status "segmentation_review"', () => {
    expect(getCaseStatusLabel("segmentation_review")).toBe("Segmentation Review");
  });

  it('returns "Unknown" for an unrecognized status', () => {
    expect(getCaseStatusLabel("not_a_real_status")).toBe("Unknown");
  });

  it('returns "Unknown" for empty string', () => {
    expect(getCaseStatusLabel("")).toBe("Unknown");
  });

  it("every defined status returns a non-empty label", () => {
    ALL_STATUSES.forEach((s) => {
      expect(getCaseStatusLabel(s).length).toBeGreaterThan(0);
    });
  });

  it("returns consistent result with CASE_STATUS_CONFIG for all statuses", () => {
    ALL_STATUSES.forEach((s) => {
      expect(getCaseStatusLabel(s)).toBe(CASE_STATUS_CONFIG[s].label);
    });
  });
});

// ─── getCaseStatusBadgeClass ──────────────────────────────────────────────────

describe("getCaseStatusBadgeClass", () => {
  it("returns a non-empty badge class for all known statuses", () => {
    ALL_STATUSES.forEach((s) => {
      const cls = getCaseStatusBadgeClass(s);
      expect(typeof cls).toBe("string");
      expect(cls.length).toBeGreaterThan(0);
    });
  });

  it("badge class for unknown status uses the muted fallback", () => {
    const cls = getCaseStatusBadgeClass("unknown_xyz");
    expect(cls).toContain("muted-foreground");
  });

  it("badge class for 'cancelled' uses clinical-danger CSS variable", () => {
    const cls = getCaseStatusBadgeClass("cancelled");
    expect(cls).toContain("clinical-danger");
  });

  it("badge class for 'plan_approved' uses clinical-safe CSS variable", () => {
    const cls = getCaseStatusBadgeClass("plan_approved");
    expect(cls).toContain("clinical-safe");
  });

  it("badge class for 'new' uses primary CSS variable", () => {
    const cls = getCaseStatusBadgeClass("new");
    expect(cls).toContain("primary");
  });

  it("returns consistent result with CASE_STATUS_CONFIG", () => {
    ALL_STATUSES.forEach((s) => {
      expect(getCaseStatusBadgeClass(s)).toBe(CASE_STATUS_CONFIG[s].bgClass);
    });
  });
});

// ─── getCaseStatusColor ───────────────────────────────────────────────────────

describe("getCaseStatusColor", () => {
  it("returns a CSS variable string for all known statuses", () => {
    ALL_STATUSES.forEach((s) => {
      const color = getCaseStatusColor(s);
      expect(color).toMatch(/^var\(--/);
    });
  });

  it("'cancelled' color uses --clinical-danger", () => {
    expect(getCaseStatusColor("cancelled")).toBe("var(--clinical-danger)");
  });

  it("'in_treatment' color uses --clinical-safe", () => {
    expect(getCaseStatusColor("in_treatment")).toBe("var(--clinical-safe)");
  });

  it("unknown status color uses --muted-foreground fallback", () => {
    expect(getCaseStatusColor("not_real")).toBe("var(--muted-foreground)");
  });

  it("returns consistent result with CASE_STATUS_CONFIG", () => {
    ALL_STATUSES.forEach((s) => {
      expect(getCaseStatusColor(s)).toBe(CASE_STATUS_CONFIG[s].color);
    });
  });
});

// ─── getCaseStatusDotColor ────────────────────────────────────────────────────

describe("getCaseStatusDotColor", () => {
  it("returns a CSS variable string for all known statuses", () => {
    ALL_STATUSES.forEach((s) => {
      const dot = getCaseStatusDotColor(s);
      expect(dot).toMatch(/^var\(--/);
    });
  });

  it("'on_hold' dot color uses --clinical-warn", () => {
    expect(getCaseStatusDotColor("on_hold")).toBe("var(--clinical-warn)");
  });

  it("'shipped' dot color uses --primary", () => {
    expect(getCaseStatusDotColor("shipped")).toBe("var(--primary)");
  });

  it("unknown status dot color uses --muted-foreground fallback", () => {
    expect(getCaseStatusDotColor("xyz")).toBe("var(--muted-foreground)");
  });

  it("returns consistent result with CASE_STATUS_CONFIG", () => {
    ALL_STATUSES.forEach((s) => {
      expect(getCaseStatusDotColor(s)).toBe(CASE_STATUS_CONFIG[s].dotColor);
    });
  });
});

// ─── CASE_STATUS_CONFIG integrity ─────────────────────────────────────────────

describe("CASE_STATUS_CONFIG integrity", () => {
  it("has exactly 16 entries", () => {
    expect(ALL_STATUSES).toHaveLength(16);
  });

  it("every entry has a non-empty label", () => {
    ALL_STATUSES.forEach((s) => {
      expect(CASE_STATUS_CONFIG[s].label.length).toBeGreaterThan(0);
    });
  });

  it("every entry has a non-empty description", () => {
    ALL_STATUSES.forEach((s) => {
      expect(CASE_STATUS_CONFIG[s].description.length).toBeGreaterThan(0);
    });
  });

  it("every color is a CSS var() reference", () => {
    ALL_STATUSES.forEach((s) => {
      expect(CASE_STATUS_CONFIG[s].color).toMatch(/^var\(--/);
      expect(CASE_STATUS_CONFIG[s].dotColor).toMatch(/^var\(--/);
    });
  });
});
