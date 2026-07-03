/**
 * Role workspace configuration.
 *
 * Maps each role to its primary workspace, recommended nav, default dashboard
 * widgets, and a plain-English permissions summary. This is a UX layer only —
 * real enforcement happens at the backend API layer. The seams are deliberate
 * so that backend permission guards can be wired in without changing the UI.
 */

export type RoleKey =
  | "super_admin"
  | "admin"
  | "orthodontist"
  | "dentist"
  | "resident"
  | "lab_technician"
  | "lab_manager"
  | "clinical_director"
  | "vp_clinical"
  | "vp_manufacturing"
  | "executive";

export type RoleCategory = "clinical" | "lab" | "executive" | "admin";

export interface WorkspaceRoute {
  href: string;
  label: string;
  description: string;
}

export interface RecommendedAction {
  label: string;
  href: string;
  tone: "primary" | "success" | "warning" | "info" | "neutral";
}

export interface RoleConfig {
  key: RoleKey;
  label: string;
  category: RoleCategory;
  description: string;
  /** Route to redirect after login / onboarding. */
  primaryWorkspace: WorkspaceRoute;
  /** Ordered nav routes to surface prominently for this role. */
  recommendedRoutes: WorkspaceRoute[];
  /** Quick actions shown on the role success screen. */
  recommendedActions: RecommendedAction[];
  /** Widget IDs to show by default on the role's dashboard view. */
  defaultWidgets: string[];
  /** Plain-English summary of what this role can do (UX, not enforced). */
  clinicalPermissionSummary: string[];
  /** Nav group ordering hint — which sidebar groups to show first. */
  navPriority: string[];
  /** Message shown on the onboarding completion screen. */
  successMessage: string;
  /** Color tone for role badges and avatar accents. */
  tone: "primary" | "success" | "warning" | "danger" | "info" | "neutral";
}

export const ROLE_CONFIG: Record<RoleKey, RoleConfig> = {
  // ─── Clinical ───────────────────────────────────────────────────────────────

  orthodontist: {
    key: "orthodontist",
    label: "Orthodontist",
    category: "clinical",
    description: "Manages full treatment: diagnosis, planning, appliance design, and approval.",
    primaryWorkspace: { href: "/cases", label: "Cases", description: "Your active patient case list" },
    recommendedRoutes: [
      { href: "/cases",          label: "Cases",          description: "Active and pending cases" },
      { href: "/studio",         label: "CAD Studio",     description: "3D design and measurements" },
      { href: "/workflow",       label: "Workflow",       description: "Approve, revise, or escalate" },
      { href: "/treatment-plan", label: "Treatment Plan", description: "Stage plans and IPR schedules" },
    ],
    recommendedActions: [
      { label: "Review pending cases",    href: "/cases?filter=needs-review", tone: "warning" },
      { label: "Open CAD Studio",         href: "/studio",                    tone: "primary" },
      { label: "Check approval queue",    href: "/workflow",                  tone: "info" },
    ],
    defaultWidgets: ["active_cases", "pending_approvals", "sla_risk", "recent_scans"],
    clinicalPermissionSummary: [
      "View and create patient cases",
      "Approve, revise, or reject treatment plans",
      "Place measurements and annotations",
      "Export CAD packages",
      "Add workflow notes",
    ],
    navPriority: ["Clinical", "Studio", "Command"],
    successMessage: "Your clinical workspace is ready. Start with your case list.",
    tone: "primary",
  },

  dentist: {
    key: "dentist",
    label: "Dentist",
    category: "clinical",
    description: "Reviews scans, submits cases for orthodontic planning, and monitors treatment progress.",
    primaryWorkspace: { href: "/cases", label: "Cases", description: "Your submitted and active cases" },
    recommendedRoutes: [
      { href: "/cases",    label: "Cases",    description: "Submitted and monitored cases" },
      { href: "/patients", label: "Patients", description: "Patient records and history" },
      { href: "/workflow", label: "Workflow", description: "Case status and review" },
    ],
    recommendedActions: [
      { label: "View my cases",           href: "/cases",    tone: "primary" },
      { label: "Check patient records",   href: "/patients", tone: "info" },
    ],
    defaultWidgets: ["active_cases", "recent_scans", "approval_status"],
    clinicalPermissionSummary: [
      "View and submit patient cases",
      "View treatment plans (read-only approval)",
      "Add case notes and observations",
    ],
    navPriority: ["Clinical", "Command"],
    successMessage: "Your workspace is ready. View your active cases to get started.",
    tone: "success",
  },

  resident: {
    key: "resident",
    label: "Resident",
    category: "clinical",
    description: "Observes and assists with case planning under attending supervision.",
    primaryWorkspace: { href: "/cases", label: "Cases", description: "Cases available for observation" },
    recommendedRoutes: [
      { href: "/cases",          label: "Cases",          description: "Supervised case observation" },
      { href: "/treatment-plan", label: "Treatment Plan", description: "Study treatment staging" },
      { href: "/studio",         label: "CAD Studio",     description: "Measurement practice" },
    ],
    recommendedActions: [
      { label: "Study active cases",   href: "/cases",          tone: "primary" },
      { label: "Practice measurements", href: "/studio",        tone: "info" },
    ],
    defaultWidgets: ["active_cases", "recent_scans"],
    clinicalPermissionSummary: [
      "View assigned cases (read-only)",
      "Add observations and learning notes",
      "Practice measurements in CAD Studio",
    ],
    navPriority: ["Clinical", "Studio"],
    successMessage: "Welcome to your learning workspace. Explore your assigned cases.",
    tone: "info",
  },

  clinical_director: {
    key: "clinical_director",
    label: "Clinical Director",
    category: "clinical",
    description: "Oversees clinical quality, approvals, audit, and provider performance.",
    primaryWorkspace: { href: "/dashboard", label: "Dashboard", description: "Clinical oversight dashboard" },
    recommendedRoutes: [
      { href: "/dashboard",  label: "Dashboard",  description: "Clinical KPIs and SLA status" },
      { href: "/workflow",   label: "Approvals",  description: "Escalated approvals and audits" },
      { href: "/analytics",  label: "Analytics",  description: "Provider and SLA performance" },
      { href: "/cases",      label: "Cases",      description: "Case list for quality review" },
    ],
    recommendedActions: [
      { label: "Review approval queue",    href: "/workflow",  tone: "warning" },
      { label: "Open analytics",           href: "/analytics", tone: "primary" },
      { label: "Check audit trail",        href: "/workflow",  tone: "info" },
    ],
    defaultWidgets: ["pending_approvals", "sla_risk", "provider_performance", "audit_events"],
    clinicalPermissionSummary: [
      "Final approval authority for all clinical cases",
      "Full audit trail access",
      "Provider performance reporting",
      "Quality and SLA management",
    ],
    navPriority: ["Command", "Clinical", "Intelligence"],
    successMessage: "Your oversight workspace is configured. Check the approval queue first.",
    tone: "danger",
  },

  // ─── Lab ───────────────────────────────────────────────────────────────────

  lab_technician: {
    key: "lab_technician",
    label: "Lab Technician",
    category: "lab",
    description: "Prepares digital models, runs manufacturing jobs, and performs quality checks.",
    primaryWorkspace: { href: "/cases", label: "Manufacturing", description: "Your production queue" },
    recommendedRoutes: [
      { href: "/cases", label: "Manufacturing", description: "Print queue and job status" },
      { href: "/studio",        label: "CAD Studio",    description: "Model prep and inspection" },
      { href: "/workflow",      label: "Workflow",      description: "Case status and handoffs" },
    ],
    recommendedActions: [
      { label: "Open production queue",   href: "/cases", tone: "primary" },
      { label: "Inspect model in Studio", href: "/studio",        tone: "info" },
    ],
    defaultWidgets: ["production_queue", "print_status", "sla_alerts", "failed_jobs"],
    clinicalPermissionSummary: [
      "Access approved cases for manufacturing",
      "Run and monitor print jobs",
      "Log quality check results",
      "Export manufacturing packages",
    ],
    navPriority: ["Manufacturing", "Studio", "Clinical"],
    successMessage: "Your production workspace is ready. Check your print queue.",
    tone: "warning",
  },

  lab_manager: {
    key: "lab_manager",
    label: "Lab Manager",
    category: "lab",
    description: "Manages lab operations, SLA compliance, team capacity, and manufacturing KPIs.",
    primaryWorkspace: { href: "/dashboard", label: "Dashboard", description: "Lab operations dashboard" },
    recommendedRoutes: [
      { href: "/dashboard",     label: "Dashboard",     description: "Lab KPIs and SLA metrics" },
      { href: "/cases", label: "Manufacturing", description: "Production queue management" },
      { href: "/analytics",     label: "Analytics",     description: "Throughput and efficiency" },
    ],
    recommendedActions: [
      { label: "Check SLA status",       href: "/dashboard",     tone: "warning" },
      { label: "Review production queue", href: "/cases", tone: "primary" },
      { label: "Open analytics",         href: "/analytics",     tone: "info" },
    ],
    defaultWidgets: ["production_queue", "sla_alerts", "throughput", "failed_jobs"],
    clinicalPermissionSummary: [
      "View all lab-bound cases",
      "Manage print queue and priorities",
      "SLA and throughput reporting",
      "Team assignment (roadmap)",
    ],
    navPriority: ["Manufacturing", "Intelligence", "Command"],
    successMessage: "Your lab management workspace is ready. Review your SLA metrics.",
    tone: "warning",
  },

  // ─── Executive ─────────────────────────────────────────────────────────────

  vp_clinical: {
    key: "vp_clinical",
    label: "VP Clinical Operations",
    category: "executive",
    description: "Strategic oversight of clinical quality, compliance, and provider performance.",
    primaryWorkspace: { href: "/analytics", label: "Analytics", description: "Clinical performance metrics" },
    recommendedRoutes: [
      { href: "/analytics",  label: "Analytics",  description: "Enterprise performance reporting" },
      { href: "/dashboard",  label: "Dashboard",  description: "Clinical KPI summary" },
      { href: "/workflow",   label: "Workflow",   description: "Escalations and audit" },
    ],
    recommendedActions: [
      { label: "Open analytics",         href: "/analytics", tone: "primary" },
      { label: "Review clinical KPIs",   href: "/dashboard", tone: "info" },
    ],
    defaultWidgets: ["approval_turnaround", "sla_metrics", "provider_performance", "case_throughput"],
    clinicalPermissionSummary: [
      "Read-only access to all clinical data",
      "Full analytics and SLA reporting",
      "Audit trail access",
    ],
    navPriority: ["Intelligence", "Command", "Clinical"],
    successMessage: "Your clinical intelligence workspace is ready.",
    tone: "primary",
  },

  vp_manufacturing: {
    key: "vp_manufacturing",
    label: "VP Manufacturing",
    category: "executive",
    description: "Strategic oversight of manufacturing operations, capacity, and SLA compliance.",
    primaryWorkspace: { href: "/analytics", label: "Analytics", description: "Manufacturing performance metrics" },
    recommendedRoutes: [
      { href: "/analytics",     label: "Analytics",     description: "Manufacturing throughput and SLA" },
      { href: "/cases", label: "Manufacturing", description: "Production pipeline overview" },
      { href: "/dashboard",     label: "Dashboard",     description: "Operational summary" },
    ],
    recommendedActions: [
      { label: "Review manufacturing metrics", href: "/analytics",     tone: "primary" },
      { label: "Check production pipeline",    href: "/cases", tone: "info" },
    ],
    defaultWidgets: ["production_queue", "throughput", "sla_metrics", "failed_jobs"],
    clinicalPermissionSummary: [
      "Read-only access to manufacturing data",
      "Full production analytics",
      "SLA and capacity reporting",
    ],
    navPriority: ["Intelligence", "Manufacturing", "Command"],
    successMessage: "Your manufacturing intelligence workspace is ready.",
    tone: "warning",
  },

  executive: {
    key: "executive",
    label: "Executive",
    category: "executive",
    description: "Business-level visibility across clinical, manufacturing, and financial performance.",
    primaryWorkspace: { href: "/analytics", label: "Analytics", description: "Enterprise business metrics" },
    recommendedRoutes: [
      { href: "/analytics", label: "Analytics", description: "Enterprise KPIs" },
      { href: "/dashboard", label: "Dashboard", description: "Operational summary" },
    ],
    recommendedActions: [
      { label: "Open enterprise analytics", href: "/analytics", tone: "primary" },
      { label: "View operational summary",  href: "/dashboard", tone: "info" },
    ],
    defaultWidgets: ["case_throughput", "sla_metrics", "approval_turnaround", "provider_performance"],
    clinicalPermissionSummary: [
      "Read-only access to aggregate metrics",
      "No access to individual patient records",
      "Business intelligence and reporting",
    ],
    navPriority: ["Intelligence", "Command"],
    successMessage: "Your executive workspace is ready. Review the enterprise dashboard.",
    tone: "info",
  },

  // ─── Admin ──────────────────────────────────────────────────────────────────

  admin: {
    key: "admin",
    label: "Organization Admin",
    category: "admin",
    description: "Manages organization settings, users, and configuration.",
    primaryWorkspace: { href: "/settings", label: "Settings", description: "Organization management" },
    recommendedRoutes: [
      { href: "/settings",  label: "Settings",  description: "User management and configuration" },
      { href: "/dashboard", label: "Dashboard", description: "Organization health" },
      { href: "/analytics", label: "Analytics", description: "Usage metrics" },
    ],
    recommendedActions: [
      { label: "Configure organization", href: "/settings",  tone: "primary" },
      { label: "Review analytics",       href: "/analytics", tone: "info" },
    ],
    defaultWidgets: ["active_cases", "sla_metrics", "case_throughput"],
    clinicalPermissionSummary: [
      "User provisioning and role assignment",
      "Organization settings",
      "Read access to all non-PHI data",
    ],
    navPriority: ["Command", "Intelligence", "Clinical"],
    successMessage: "Your admin workspace is configured. Start by reviewing your organization settings.",
    tone: "neutral",
  },

  super_admin: {
    key: "super_admin",
    label: "Super Admin",
    category: "admin",
    description: "Full platform access including all organizations, users, and system configuration.",
    primaryWorkspace: { href: "/dashboard", label: "Dashboard", description: "Platform overview" },
    recommendedRoutes: [
      { href: "/dashboard",  label: "Dashboard",  description: "Platform overview" },
      { href: "/settings",   label: "Settings",   description: "System configuration" },
      { href: "/analytics",  label: "Analytics",  description: "Platform analytics" },
    ],
    recommendedActions: [
      { label: "Platform overview",    href: "/dashboard",  tone: "primary" },
      { label: "System settings",      href: "/settings",   tone: "neutral" },
      { label: "Platform analytics",   href: "/analytics",  tone: "info" },
    ],
    defaultWidgets: ["active_cases", "sla_metrics", "case_throughput", "audit_events"],
    clinicalPermissionSummary: [
      "Full access to all platform features",
      "User provisioning across all organizations",
      "System configuration and data export",
      "Full audit trail access",
    ],
    navPriority: ["Command", "Clinical", "Intelligence", "Manufacturing", "Studio"],
    successMessage: "Full platform access granted. Welcome, Super Admin.",
    tone: "danger",
  },
};

export function getRoleConfig(role: string): RoleConfig {
  return ROLE_CONFIG[role as RoleKey] ?? ROLE_CONFIG.orthodontist;
}

export function getPrimaryWorkspace(role: string): string {
  return getRoleConfig(role).primaryWorkspace.href;
}

export function getAllRoles(): RoleConfig[] {
  return Object.values(ROLE_CONFIG);
}

export function getRolesByCategory(category: RoleCategory): RoleConfig[] {
  return getAllRoles().filter(r => r.category === category);
}
