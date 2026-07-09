"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";

const DEFAULT_MESSAGE =
  "AI outputs are Clinical Decision Support Only. All diagnoses, treatment planning, and clinical decisions remain the sole responsibility of the licensed dental professional. Not a substitute for professional judgment.";

interface ClinicalWarningBannerProps {
  message?: string;
  className?: string;
}

export function ClinicalWarningBanner({
  message = DEFAULT_MESSAGE,
  className = "",
}: ClinicalWarningBannerProps) {
  return (
    <div
      role="note"
      className={`flex items-start gap-2.5 rounded-[var(--radius-md)] border border-amber-300/50 bg-amber-50/80 px-3.5 py-2.5 dark:border-amber-700/35 dark:bg-amber-900/10 ${className}`}
    >
      <ShieldAlert
        size={14}
        className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
        <span className="font-semibold">Clinical Decision Support Only. </span>
        {message}
      </p>
    </div>
  );
}

export default ClinicalWarningBanner;
