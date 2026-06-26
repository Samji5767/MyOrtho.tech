/**
 * Tooth numbering conversion utilities.
 *
 * FDI (ISO 3950)  — used internationally and stored in the DB.
 *   Upper Right 11-18 · Upper Left 21-28 · Lower Left 31-38 · Lower Right 41-48
 *
 * Universal (ADA) — used in US orthodontic practice.
 *   Upper Right #1-8 · Upper Left #9-16 · Lower Left #17-24 · Lower Right #25-32
 *
 * The DB stores FDI. Display in the UI follows the user's notation preference.
 */

export type ToothNotation = 'FDI' | 'Universal';

// FDI → Universal
const FDI_TO_UNI: Record<number, number> = {
  18: 1,  17: 2,  16: 3,  15: 4,  14: 5,  13: 6,  12: 7,  11: 8,
  21: 9,  22: 10, 23: 11, 24: 12, 25: 13, 26: 14, 27: 15, 28: 16,
  38: 17, 37: 18, 36: 19, 35: 20, 34: 21, 33: 22, 32: 23, 31: 24,
  41: 25, 42: 26, 43: 27, 44: 28, 45: 29, 46: 30, 47: 31, 48: 32,
};

// Universal → FDI (derived)
const UNI_TO_FDI: Record<number, number> = Object.fromEntries(
  Object.entries(FDI_TO_UNI).map(([fdi, uni]) => [uni, Number(fdi)])
);

export function fdiToUniversal(fdi: number): number {
  return FDI_TO_UNI[fdi] ?? fdi;
}

export function universalToFdi(uni: number): number {
  return UNI_TO_FDI[uni] ?? uni;
}

/**
 * Format a tooth number for display.
 * @param fdi - always the FDI number (what the DB stores)
 * @param notation - which system to display in
 */
export function formatTooth(fdi: number, notation: ToothNotation): string {
  if (notation === 'Universal') return `#${fdiToUniversal(fdi)}`;
  return `${fdi}`;
}

/**
 * Quadrant label for display in a given notation.
 * FDI quadrants: UR / UL / LL / LR
 * Universal quadrants: UR (#1-8) / UL (#9-16) / LL (#17-24) / LR (#25-32)
 */
export function quadrantLabel(fdiQuadrant: 'UR' | 'UL' | 'LL' | 'LR', notation: ToothNotation): string {
  if (notation === 'FDI') return fdiQuadrant;
  const map = { UR: '#1–8', UL: '#9–16', LL: '#17–24', LR: '#25–32' };
  return `${fdiQuadrant} ${map[fdiQuadrant]}`;
}

/** All FDI groups in both quadrant order (same as FDI_GROUPS in ToothTransformPanel). */
export const FDI_GROUPS: { label: 'UR' | 'UL' | 'LL' | 'LR'; teeth: number[] }[] = [
  { label: 'UR', teeth: [11, 12, 13, 14, 15, 16, 17, 18] },
  { label: 'UL', teeth: [21, 22, 23, 24, 25, 26, 27, 28] },
  { label: 'LL', teeth: [31, 32, 33, 34, 35, 36, 37, 38] },
  { label: 'LR', teeth: [41, 42, 43, 44, 45, 46, 47, 48] },
];

const STORAGE_KEY = 'myortho_tooth_notation';

export function loadNotationPref(): ToothNotation {
  if (typeof window === 'undefined') return 'FDI';
  return (localStorage.getItem(STORAGE_KEY) as ToothNotation | null) ?? 'FDI';
}

export function saveNotationPref(n: ToothNotation) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, n);
}
