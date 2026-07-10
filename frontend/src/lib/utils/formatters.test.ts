import { describe, it, expect } from "vitest";
import {
  formatDate,
  formatDuration,
  formatMm,
  formatScore,
  formatPercent,
  truncate,
  pluralize,
} from "./formatters";

// ─── formatDate ───────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a valid ISO date string to a human-readable date", () => {
    const result = formatDate("2026-01-15");
    // Must include the year and be a non-empty string
    expect(typeof result).toBe("string");
    expect(result).toContain("2026");
  });

  it("returns the input unchanged for an invalid date string", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("returns the input unchanged for an empty string", () => {
    expect(formatDate("")).toBe("");
  });

  it("accepts a custom Intl.DateTimeFormatOptions", () => {
    const result = formatDate("2026-06-15", { year: "numeric" });
    expect(result).toContain("2026");
  });

  it("handles ISO datetime strings (includes time component)", () => {
    const result = formatDate("2026-07-10T12:00:00.000Z");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("2026-07-10T12:00:00.000Z"); // Was actually parsed
  });
});

// ─── formatDuration ───────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it('formats 1 month as "1 month" (singular)', () => {
    expect(formatDuration(1)).toBe("1 month");
  });

  it('formats 0 months as "0 months"', () => {
    expect(formatDuration(0)).toBe("0 months");
  });

  it('formats 12 months as "12 months"', () => {
    expect(formatDuration(12)).toBe("12 months");
  });

  it("formats fractional months as a floor–ceil range", () => {
    expect(formatDuration(6.5)).toBe("6–7 months");
  });

  it("formats 1.5 months as a range", () => {
    expect(formatDuration(1.5)).toBe("1–2 months");
  });

  it("formats 18.3 months as 18-19 months range", () => {
    expect(formatDuration(18.3)).toBe("18–19 months");
  });

  it("integer months never produce a range", () => {
    [2, 6, 18, 24].forEach((n) => {
      expect(formatDuration(n)).not.toContain("–");
    });
  });

  it("fractional months always produce a range with em dash", () => {
    expect(formatDuration(3.7)).toContain("–");
  });
});

// ─── formatMm ─────────────────────────────────────────────────────────────────

describe("formatMm", () => {
  it('formats 1.5 mm with default precision 1 as "1.5 mm"', () => {
    expect(formatMm(1.5)).toBe("1.5 mm");
  });

  it('formats 0 mm as "0.0 mm"', () => {
    expect(formatMm(0)).toBe("0.0 mm");
  });

  it("respects custom precision", () => {
    expect(formatMm(1.234, 2)).toBe("1.23 mm");
    expect(formatMm(1.234, 0)).toBe("1 mm");
  });

  it("appends ' mm' suffix", () => {
    expect(formatMm(5)).toMatch(/ mm$/);
  });

  it("formats negative measurements (e.g. intrusion)", () => {
    expect(formatMm(-0.3)).toBe("-0.3 mm");
  });

  it("formats large values correctly", () => {
    expect(formatMm(100, 1)).toBe("100.0 mm");
  });
});

// ─── formatScore ──────────────────────────────────────────────────────────────

describe("formatScore", () => {
  it('formats 85 as "85/100"', () => {
    expect(formatScore(85)).toBe("85/100");
  });

  it('formats 0 as "0/100"', () => {
    expect(formatScore(0)).toBe("0/100");
  });

  it('formats 100 as "100/100"', () => {
    expect(formatScore(100)).toBe("100/100");
  });

  it("rounds fractional scores", () => {
    expect(formatScore(84.6)).toBe("85/100");
    expect(formatScore(84.4)).toBe("84/100");
  });

  it('always ends with "/100"', () => {
    expect(formatScore(72.1)).toMatch(/\/100$/);
  });
});

// ─── formatPercent ────────────────────────────────────────────────────────────

describe("formatPercent", () => {
  it('formats 0.75 as "75%"', () => {
    expect(formatPercent(0.75)).toBe("75%");
  });

  it('formats 0 as "0%"', () => {
    expect(formatPercent(0)).toBe("0%");
  });

  it('formats 1 as "100%"', () => {
    expect(formatPercent(1)).toBe("100%");
  });

  it("rounds the result", () => {
    expect(formatPercent(0.333)).toBe("33%");
    expect(formatPercent(0.666)).toBe("67%");
  });

  it('appends "%" suffix', () => {
    expect(formatPercent(0.5)).toMatch(/%$/);
  });
});

// ─── truncate ─────────────────────────────────────────────────────────────────

describe("truncate", () => {
  it("returns the string unchanged when it fits within maxLen", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns the string unchanged when it equals maxLen exactly", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("truncates to maxLen characters including the ellipsis", () => {
    const result = truncate("hello world", 8);
    expect(result.length).toBe(8);
  });

  it("appends '…' (horizontal ellipsis) when truncated", () => {
    const result = truncate("hello world", 8);
    expect(result.endsWith("…")).toBe(true);
  });

  it("the truncated content fills all but the last character", () => {
    const result = truncate("abcdefghij", 5);
    expect(result).toBe("abcd…");
  });

  it("handles empty string", () => {
    expect(truncate("", 5)).toBe("");
  });

  it("works with maxLen of 1 (only ellipsis)", () => {
    const result = truncate("hello", 1);
    expect(result).toBe("…");
    expect(result.length).toBe(1);
  });
});

// ─── pluralize ────────────────────────────────────────────────────────────────

describe("pluralize", () => {
  it('returns "1 month" for n=1 (singular)', () => {
    expect(pluralize(1, "month")).toBe("1 month");
  });

  it('returns "2 months" for n=2 (auto-plural with "s")', () => {
    expect(pluralize(2, "month")).toBe("2 months");
  });

  it('returns "0 months" for n=0', () => {
    expect(pluralize(0, "month")).toBe("0 months");
  });

  it("uses the explicit plural when provided", () => {
    expect(pluralize(2, "tooth", "teeth")).toBe("2 teeth");
    expect(pluralize(1, "tooth", "teeth")).toBe("1 tooth");
  });

  it("auto-plural with explicit plural overrides the auto-s rule", () => {
    expect(pluralize(3, "child", "children")).toBe("3 children");
  });

  it("singular form for n=1 even when explicit plural given", () => {
    expect(pluralize(1, "analysis", "analyses")).toBe("1 analysis");
  });

  it("handles n=-1 (not singular)", () => {
    expect(pluralize(-1, "point")).toBe("-1 points");
  });

  it("handles large numbers", () => {
    expect(pluralize(1000, "stage")).toBe("1000 stages");
  });
});
