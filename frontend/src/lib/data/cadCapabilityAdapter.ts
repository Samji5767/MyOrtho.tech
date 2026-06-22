/**
 * Adapter seam for CAD capability state.
 *
 * Today this returns the static registry from `lib/cad/capabilities`. When the
 * NestJS/Supabase backend exposes per-design capability state (e.g. which
 * margins are finalized, which attachments are placed for a given case), this
 * is the single place to wire it up — the UI already consumes these shapes.
 *
 * Mirrors the pattern in `lib/data/cadAdapter.ts`.
 */
import {
  CAD_CAPABILITIES,
  CadCapability,
  CapabilityMaturity,
  maturityCounts,
} from "@/lib/cad/capabilities";

export interface CapabilitySnapshot {
  capabilities: CadCapability[];
  counts: Record<CapabilityMaturity, number>;
  /** Coverage = implemented / total, 0..1. */
  coverage: number;
}

/**
 * Returns the current capability snapshot. `caseId` is accepted now so callers
 * are stable once per-case capability state is fetched from the backend.
 */
export async function getCapabilitySnapshot(_caseId?: string): Promise<CapabilitySnapshot> {
  const counts = maturityCounts();
  const total = CAD_CAPABILITIES.length || 1;
  return {
    capabilities: CAD_CAPABILITIES,
    counts,
    coverage: counts.implemented / total,
  };
}
