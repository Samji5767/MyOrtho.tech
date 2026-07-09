"use client";

import React from "react";

interface SectionCardProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function SectionCard({ children, title, description, className = "" }: SectionCardProps) {
  return (
    <div
      className={`rounded-[var(--radius-lg)] border border-border bg-card shadow-[var(--shadow-sm)] ${className}`}
    >
      {(title || description) && (
        <div className="border-b border-border px-5 py-4">
          {title && (
            <h2 className="text-sm font-semibold text-foreground leading-snug">{title}</h2>
          )}
          {description && (
            <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)] leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

export default SectionCard;
