"use client";

import { AlertTriangle, ChevronDown, ChevronUp, ShieldAlert } from "lucide-react";
import { useState } from "react";

interface MedicalDisclaimerProps {
  variant?: "banner" | "panel" | "inline" | "compact";
  defaultExpanded?: boolean;
  className?: string;
}

const FULL_DISCLAIMER = `MyOrtho provides software tools intended to assist licensed dental professionals. AI-generated segmentation, treatment recommendations, simulations, staging plans, movement predictions, manufacturing suggestions, and analytics are advisory only. Final diagnosis, treatment planning, clinical decisions, manufacturing approvals, and patient care remain the sole responsibility of the licensed orthodontist or dental professional. MyOrtho is not intended to replace professional clinical judgment.`;

const SHORT_DISCLAIMER = `AI outputs are Clinical Decision Support Only. All clinical decisions remain the sole responsibility of the licensed professional.`;

export function MedicalDisclaimer({ variant = "banner", defaultExpanded = false, className = "" }: MedicalDisclaimerProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (variant === "compact") {
    return (
      <p className={`text-[10px] font-medium text-amber-700 dark:text-amber-400 leading-relaxed ${className}`}>
        <ShieldAlert size={10} className="inline mr-1 -mt-0.5" />
        Clinical Decision Support Only — not a substitute for licensed professional judgment.
      </p>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`flex items-start gap-2 rounded-lg border border-amber-300/50 bg-amber-50/80 px-3 py-2.5 dark:border-amber-700/40 dark:bg-amber-900/10 ${className}`}>
        <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
          <span className="font-bold">Clinical Decision Support Only.</span>{" "}
          {SHORT_DISCLAIMER}
        </p>
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div className={`rounded-xl border border-amber-300/50 bg-amber-50/60 dark:border-amber-700/40 dark:bg-amber-900/10 ${className}`}>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Medical Disclaimer
            </span>
          </div>
          {expanded ? (
            <ChevronUp size={16} className="text-amber-600 dark:text-amber-400" />
          ) : (
            <ChevronDown size={16} className="text-amber-600 dark:text-amber-400" />
          )}
        </button>
        {expanded && (
          <div className="border-t border-amber-300/40 px-4 pb-4 pt-3 dark:border-amber-700/30">
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              {FULL_DISCLAIMER}
            </p>
          </div>
        )}
      </div>
    );
  }

  // banner variant (default)
  return (
    <div className={`flex items-start gap-2.5 border-b border-amber-300/40 bg-amber-50/70 px-4 py-2.5 dark:border-amber-700/30 dark:bg-amber-900/10 ${className}`}>
      <ShieldAlert size={14} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
        <span className="font-bold">Clinical Decision Support Only.</span>{" "}
        AI outputs assist licensed professionals only — not a substitute for clinical judgment. Final decisions are the sole responsibility of the treating orthodontist.
      </p>
    </div>
  );
}

export default MedicalDisclaimer;
