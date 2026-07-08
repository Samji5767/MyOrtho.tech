// Canonical source for case status display metadata. All components that need
// to render a status label, badge, or color indicator should import from here
// rather than maintaining local maps.

export type CaseStatus =
  | "new"
  | "intake"
  | "scan_uploaded"
  | "segmenting"
  | "segmentation_review"
  | "treatment_planning"
  | "plan_review"
  | "plan_approved"
  | "manufacturing"
  | "manufacturing_qc"
  | "shipped"
  | "in_treatment"
  | "completed"
  | "on_hold"
  | "archived"
  | "cancelled";

export interface CaseStatusEntry {
  label: string;
  // CSS variable reference — resolves to the correct light/dark token.
  color: string;
  // Tailwind arbitrary-value classes for a pill/badge background + text.
  bgClass: string;
  // CSS variable reference used for dot/indicator fills.
  dotColor: string;
  description: string;
}

// The CSS variable strings below reference tokens defined in globals.css and
// adapt automatically to light and dark themes without extra Tailwind variants.
export const CASE_STATUS_CONFIG: Record<CaseStatus, CaseStatusEntry> = {
  new: {
    label: "New",
    color: "var(--primary)",
    bgClass: "bg-[color:var(--primary-glow)] text-[color:var(--primary)]",
    dotColor: "var(--primary)",
    description: "Case has been created and is awaiting intake",
  },
  intake: {
    label: "Intake",
    color: "var(--primary)",
    bgClass: "bg-[color:var(--primary-glow)] text-[color:var(--primary)]",
    dotColor: "var(--primary)",
    description: "Patient intake is in progress",
  },
  scan_uploaded: {
    label: "Scan Uploaded",
    color: "var(--clinical-highlight)",
    bgClass:
      "bg-[color:var(--clinical-neutral-tint)] text-[color:var(--clinical-highlight)]",
    dotColor: "var(--clinical-highlight)",
    description: "Scan files have been uploaded and are ready for segmentation",
  },
  segmenting: {
    label: "Segmenting",
    color: "var(--clinical-highlight)",
    bgClass:
      "bg-[color:var(--clinical-neutral-tint)] text-[color:var(--clinical-highlight)]",
    dotColor: "var(--clinical-highlight)",
    description: "AI segmentation is running",
  },
  segmentation_review: {
    label: "Segmentation Review",
    color: "var(--clinical-warn)",
    bgClass:
      "bg-[color:var(--clinical-warn-tint)] text-[color:var(--clinical-warn)]",
    dotColor: "var(--clinical-warn)",
    description: "Segmentation output is pending clinical review",
  },
  treatment_planning: {
    label: "Treatment Planning",
    color: "var(--clinical-warn)",
    bgClass:
      "bg-[color:var(--clinical-warn-tint)] text-[color:var(--clinical-warn)]",
    dotColor: "var(--clinical-warn)",
    description: "Treatment plan is being designed",
  },
  plan_review: {
    label: "Plan Review",
    color: "var(--clinical-warn)",
    bgClass:
      "bg-[color:var(--clinical-warn-tint)] text-[color:var(--clinical-warn)]",
    dotColor: "var(--clinical-warn)",
    description: "Treatment plan is pending clinician review and approval",
  },
  plan_approved: {
    label: "Plan Approved",
    color: "var(--clinical-safe)",
    bgClass:
      "bg-[color:var(--clinical-safe-tint)] text-[color:var(--clinical-safe)]",
    dotColor: "var(--clinical-safe)",
    description: "Treatment plan has been approved by the clinician",
  },
  manufacturing: {
    label: "Manufacturing",
    color: "var(--clinical-highlight)",
    bgClass:
      "bg-[color:var(--clinical-neutral-tint)] text-[color:var(--clinical-highlight)]",
    dotColor: "var(--clinical-highlight)",
    description: "Aligners are being manufactured",
  },
  manufacturing_qc: {
    label: "Manufacturing QC",
    color: "var(--clinical-warn)",
    bgClass:
      "bg-[color:var(--clinical-warn-tint)] text-[color:var(--clinical-warn)]",
    dotColor: "var(--clinical-warn)",
    description: "Manufactured aligners are undergoing quality control checks",
  },
  shipped: {
    label: "Shipped",
    color: "var(--primary)",
    bgClass: "bg-[color:var(--primary-glow)] text-[color:var(--primary)]",
    dotColor: "var(--primary)",
    description: "Aligners have been shipped to the clinic",
  },
  in_treatment: {
    label: "In Treatment",
    color: "var(--clinical-safe)",
    bgClass:
      "bg-[color:var(--clinical-safe-tint)] text-[color:var(--clinical-safe)]",
    dotColor: "var(--clinical-safe)",
    description: "Patient is actively in treatment",
  },
  completed: {
    label: "Completed",
    color: "var(--muted-foreground)",
    bgClass:
      "bg-[color:var(--clinical-neutral-tint)] text-[color:var(--muted-foreground)]",
    dotColor: "var(--muted-foreground)",
    description: "Treatment has been completed successfully",
  },
  on_hold: {
    label: "On Hold",
    color: "var(--clinical-warn)",
    bgClass:
      "bg-[color:var(--clinical-warn-tint)] text-[color:var(--clinical-warn)]",
    dotColor: "var(--clinical-warn)",
    description: "Case has been placed on hold",
  },
  archived: {
    label: "Archived",
    color: "var(--muted-foreground)",
    bgClass:
      "bg-[color:var(--clinical-neutral-tint)] text-[color:var(--muted-foreground)]",
    dotColor: "var(--muted-foreground)",
    description: "Case has been archived",
  },
  cancelled: {
    label: "Cancelled",
    color: "var(--clinical-danger)",
    bgClass:
      "bg-[color:var(--clinical-danger-tint)] text-[color:var(--clinical-danger)]",
    dotColor: "var(--clinical-danger)",
    description: "Case has been cancelled",
  },
};

const FALLBACK_ENTRY: CaseStatusEntry = {
  label: "Unknown",
  color: "var(--muted-foreground)",
  bgClass:
    "bg-[color:var(--clinical-neutral-tint)] text-[color:var(--muted-foreground)]",
  dotColor: "var(--muted-foreground)",
  description: "Unknown case status",
};

function resolveEntry(status: string): CaseStatusEntry {
  return (
    CASE_STATUS_CONFIG[status as CaseStatus] ?? FALLBACK_ENTRY
  );
}

export function getCaseStatusLabel(status: string): string {
  return resolveEntry(status).label;
}

export function getCaseStatusBadgeClass(status: string): string {
  return resolveEntry(status).bgClass;
}

export function getCaseStatusColor(status: string): string {
  return resolveEntry(status).color;
}

export function getCaseStatusDotColor(status: string): string {
  return resolveEntry(status).dotColor;
}
