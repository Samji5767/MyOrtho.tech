"use client";

import {
  Activity,
  BarChart3,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, MetricCard, StatusBadge } from "@/components/DesignSystem";

const KPI_PLACEHOLDERS = [
  { label: "Active patients", value: "—", helper: "Connect backend to view", icon: Users, tone: "primary" as const },
  { label: "Cases completed", value: "—", helper: "Connect backend to view", icon: Activity, tone: "success" as const },
  { label: "Avg SLA (days)", value: "—", helper: "Connect backend to view", icon: TrendingDown, tone: "info" as const },
  { label: "Revenue (MTD)", value: "—", helper: "Connect backend to view", icon: TrendingUp, tone: "warning" as const },
];

const STAGE_LABELS = [
  "Consultation",
  "Scan & Segment",
  "Treatment Plan",
  "Manufacturing",
  "Delivery",
  "Retention",
];

export default function AnalyticsPage() {
  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
          Enterprise Reporting
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
          Analytics
        </h1>
        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
          KPIs, SLA performance, and operational metrics
        </p>
      </div>

      {/* KPI placeholders */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {KPI_PLACEHOLDERS.map((kpi) => (
          <MetricCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            helper={kpi.helper}
            icon={kpi.icon}
            tone={kpi.tone}
          />
        ))}
      </div>

      {/* Stage distribution — empty */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 size={17} className="text-[color:var(--primary)]" />
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">Cases by stage</h2>
          <span className="ml-auto text-xs text-[color:var(--muted-foreground)]">No data</span>
        </div>
        <div className="space-y-3">
          {STAGE_LABELS.map((label) => (
            <div key={label} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs font-medium text-[color:var(--foreground)]">{label}</span>
              <div className="flex-1 h-2 rounded-full bg-[color:var(--border)]" />
              <span className="w-14 shrink-0 text-right text-xs tabular-nums text-[color:var(--muted-foreground)]">
                0 · 0%
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent events — empty */}
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Activity size={17} className="text-[color:var(--primary)]" />
          <h2 className="text-base font-semibold text-[color:var(--foreground)]">Recent events</h2>
        </div>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Activity size={24} className="text-[color:var(--muted-foreground)]" />
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">Analytics unavailable</p>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
              Clinical, manufacturing, and business analytics will appear after real cases are processed.
            </p>
          </div>
          <StatusBadge tone="neutral">Awaiting data</StatusBadge>
        </div>
      </Card>
    </section>
  );
}
