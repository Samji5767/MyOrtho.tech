// Pure formatting utilities — no imports, no side effects, safe for server and
// client components alike. All locale-sensitive functions fall back to the
// runtime's default locale when none is specified.

// ─── Date ─────────────────────────────────────────────────────────────────────

export function formatDate(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const d = new Date(iso);
  // Guard against garbage input (e.g. null cast to string, empty string).
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, opts);
}

// ─── Duration ─────────────────────────────────────────────────────────────────

// Fractional month values produce a floor–ceil range ("6–7 months") to reflect
// the inherent uncertainty in estimated treatment durations.
export function formatDuration(months: number): string {
  const lo = Math.floor(months);
  const hi = Math.ceil(months);
  if (lo === hi) {
    return `${lo} ${lo === 1 ? "month" : "months"}`;
  }
  return `${lo}–${hi} months`;
}

// ─── Clinical measurements ────────────────────────────────────────────────────

export function formatMm(mm: number, precision: number = 1): string {
  return `${mm.toFixed(precision)} mm`;
}

// ─── Scores and ratios ────────────────────────────────────────────────────────

export function formatScore(score: number): string {
  return `${Math.round(score)}/100`;
}

// Expects a 0–1 ratio. formatPercent(0.75) → "75%"
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

// ─── Strings ──────────────────────────────────────────────────────────────────

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  // Reserve one character for the ellipsis so the output is exactly maxLen wide.
  return `${str.slice(0, maxLen - 1)}…`;
}

export function pluralize(n: number, singular: string, plural?: string): string {
  if (n === 1) return `${n} ${singular}`;
  return `${n} ${plural ?? `${singular}s`}`;
}
