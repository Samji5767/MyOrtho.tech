"use client";

import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-4 px-8 py-14 text-center ${className}`}>
      {icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-primary">
          {icon}
        </span>
      )}
      <div className="max-w-[280px] space-y-1.5">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-xs leading-relaxed text-[color:var(--muted-foreground)]">
            {description}
          </p>
        )}
      </div>
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export default EmptyState;
