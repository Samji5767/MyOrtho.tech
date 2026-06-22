"use client";

import Link from "next/link";
import {
  FolderKanban,
  Plus,
  UploadCloud,
} from "lucide-react";
import { Button, Card, StatusBadge } from "@/components/DesignSystem";

export default function CasesPage() {
  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Case Management
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            Cases
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Approvals, SLA alerts, and active workflows
          </p>
        </div>
        <Button variant="primary" size="sm">
          <Plus size={15} /> New case
        </Button>
      </div>

      {/* Summary row — zeros until backend is connected */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active", value: "0", tone: "primary" as const },
          { label: "Pending approval", value: "0", tone: "warning" as const },
          { label: "SLA at risk", value: "0", tone: "danger" as const },
        ].map((item) => (
          <Card key={item.label} className="flex flex-col items-center gap-2 p-3">
            <span className="text-2xl font-bold tabular-nums text-[color:var(--foreground)]">
              {item.value}
            </span>
            <StatusBadge tone={item.tone}>{item.label}</StatusBadge>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
          <FolderKanban size={28} />
        </span>
        <div>
          <p className="text-base font-semibold text-[color:var(--foreground)]">No active cases</p>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            New cases will appear here after a patient record or scan upload is created.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-full bg-[color:var(--primary)] px-5 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
          >
            <Plus size={15} />
            Create Case
          </button>
          <Link
            href="/studio"
            className="inline-flex h-10 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-5 text-sm font-semibold text-[color:var(--foreground)] transition-transform active:scale-95"
          >
            <UploadCloud size={15} className="text-[color:var(--primary)]" />
            Upload STL / PLY / OBJ
          </Link>
        </div>
      </Card>

      <p className="text-center text-xs text-[color:var(--muted-foreground)]">
        Full case pipeline is available in the{" "}
        <Link href="/desktop" className="text-[color:var(--primary)] underline-offset-2 hover:underline">
          CAD Studio workspace
        </Link>
      </p>
    </section>
  );
}
