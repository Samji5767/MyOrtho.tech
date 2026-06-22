"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface ActionProps {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface ClinicalEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  message: string;
  primaryAction?: ActionProps;
  secondaryAction?: ActionProps;
  tertiaryAction?: ActionProps;
}

function ActionButton({ action, primary }: { action: ActionProps; primary: boolean }) {
  const base =
    "inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold shadow-[var(--shadow-sm)] transition-transform active:scale-95";
  const style = primary
    ? `${base} bg-[color:var(--primary)] text-[color:var(--primary-foreground)]`
    : `${base} border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]`;

  if (action.href) {
    return (
      <Link href={action.href} className={style}>
        {action.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={style}>
      {action.label}
    </button>
  );
}

export function ClinicalEmptyState({
  icon: Icon,
  title,
  message,
  primaryAction,
  secondaryAction,
  tertiaryAction,
}: ClinicalEmptyStateProps) {
  const actions = [primaryAction, secondaryAction, tertiaryAction].filter(Boolean) as ActionProps[];

  return (
    <div className="flex flex-col items-center gap-4 px-8 py-16 text-center">
      {Icon && (
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
          <Icon size={28} strokeWidth={1.6} />
        </span>
      )}
      <div className="max-w-[260px] space-y-2">
        <h3 className="text-base font-semibold text-[color:var(--foreground)]">{title}</h3>
        <p className="text-[13px] leading-[1.6] text-[color:var(--muted-foreground)]">{message}</p>
      </div>
      {actions.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          {actions.map((action, i) => (
            <ActionButton key={action.label} action={action} primary={i === 0} />
          ))}
        </div>
      )}
    </div>
  );
}
