"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CAD_CAPABILITIES,
  CAPABILITY_PHASES,
  MATURITY_META,
  CadCapability,
  CapabilityMaturity,
  CapabilityPhase,
} from "@/lib/cad/capabilities";

// Maturity → dot colour. Kept in sync with MATURITY_META tones.
const DOT: Record<CapabilityMaturity, string> = {
  implemented: "var(--success, #10b981)",
  simulated: "var(--info, #3b82f6)",
  planned: "color-mix(in srgb, var(--muted-foreground) 55%, transparent)",
};

const BADGE: Record<CapabilityMaturity, string> = {
  implemented:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
  simulated: "border-sky-500/30 bg-sky-500/10 text-sky-500",
  planned:
    "border-[color:var(--border)] bg-[color-mix(in_srgb,var(--border)_45%,transparent)] text-[color:var(--muted-foreground)]",
};

function MaturityBadge({ maturity }: { maturity: CapabilityMaturity }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${BADGE[maturity]}`}
    >
      {MATURITY_META[maturity].label}
    </span>
  );
}

function CapabilityRow({ cap }: { cap: CadCapability }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="group flex w-full flex-col gap-1 border-b border-[color:var(--border)] px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[color-mix(in_srgb,var(--primary)_5%,transparent)]"
    >
      <div className="flex items-center gap-2.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: DOT[cap.maturity] }}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[color:var(--foreground)]">
          {cap.name}
        </span>
        <MaturityBadge maturity={cap.maturity} />
        <ChevronDown
          size={13}
          className={`shrink-0 text-[color:var(--muted-foreground)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </div>
      <p className="pl-4 text-[11.5px] leading-snug text-[color:var(--muted-foreground)]">
        {cap.summary}
      </p>
      {open && (
        <div className="mt-1 pl-4">
          <p className="text-[11px] leading-relaxed text-[color:var(--muted-foreground)]">
            <span className="font-semibold text-[color:var(--foreground)]">Status: </span>
            {cap.statusNote}
          </p>
          {cap.surface && (
            <p className="mt-0.5 text-[10.5px] font-medium text-[color:var(--primary)]">
              Surface · {cap.surface}
            </p>
          )}
        </div>
      )}
    </button>
  );
}

export default function CADCapabilityMatrix() {
  const counts = useMemo(
    () =>
      CAD_CAPABILITIES.reduce(
        (acc, c) => {
          acc[c.maturity] += 1;
          return acc;
        },
        { implemented: 0, simulated: 0, planned: 0 } as Record<CapabilityMaturity, number>,
      ),
    [],
  );
  const total = CAD_CAPABILITIES.length;

  const grouped = useMemo(() => {
    const map = new Map<CapabilityPhase, CadCapability[]>();
    for (const phase of CAPABILITY_PHASES) map.set(phase.key, []);
    for (const cap of CAD_CAPABILITIES) map.get(cap.phase)?.push(cap);
    return map;
  }, []);

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-[var(--shadow-sm)]">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-[color:var(--border)] p-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--muted-foreground)]">
            Dental CAD
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-tight text-[color:var(--foreground)]">
            Capability Coverage
          </h2>
          <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">
            {total} orthodontic CAD capabilities · transparent maturity
          </p>
        </div>
        {/* Legend / counts */}
        <div className="flex flex-wrap gap-1.5">
          {(["implemented", "simulated", "planned"] as CapabilityMaturity[]).map((m) => (
            <span
              key={m}
              title={MATURITY_META[m].description}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${BADGE[m]}`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: DOT[m] }}
                aria-hidden
              />
              {counts[m]} {MATURITY_META[m].label}
            </span>
          ))}
        </div>
      </div>

      {/* Phase groups */}
      <div className="divide-y divide-[color:var(--border)]">
        {CAPABILITY_PHASES.map((phase) => {
          const caps = grouped.get(phase.key) ?? [];
          if (caps.length === 0) return null;
          return (
            <div key={phase.key}>
              <div className="flex items-center justify-between bg-[color-mix(in_srgb,var(--border)_22%,transparent)] px-3 py-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted-foreground)]">
                  {phase.label}
                </span>
                <span className="text-[10px] font-medium text-[color:var(--muted-foreground)]">
                  {caps.length}
                </span>
              </div>
              {caps.map((cap) => (
                <CapabilityRow key={cap.id} cap={cap} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Honesty footer */}
      <div className="border-t border-[color:var(--border)] px-4 py-2.5">
        <p className="text-[10.5px] leading-relaxed text-[color:var(--muted-foreground)]">
          Maturity is reported conservatively. <span className="font-semibold text-[color:var(--foreground)]">Implemented</span> means a
          working interaction exists today; <span className="font-semibold text-[color:var(--foreground)]">Simulated</span> means realistic
          UI with representative (not validated) computation; <span className="font-semibold text-[color:var(--foreground)]">Planned</span> means
          the typed model and integration seam exist but the interaction is not built yet. No clinical AI is represented as complete unless it is.
        </p>
      </div>
    </div>
  );
}
