"use client";

import React, { useEffect, useId, useRef } from "react";
import { LucideIcon } from "lucide-react";
import { clsx } from "clsx";

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300",
  primary: "border-teal-500/20 bg-teal-500/10 text-teal-700 dark:text-teal-300",
  success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  info: "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
};

export function Button({
  children,
  className,
  variant = "secondary",
  size = "md",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition focus-ring disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "h-9 px-3 text-xs",
        size === "md" && "h-11 px-4 text-sm",
        size === "icon" && "h-10 w-10",
        variant === "primary" && "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover",
        variant === "secondary" && "border border-border bg-card text-foreground hover:bg-slate-100 dark:hover:bg-slate-900",
        variant === "ghost" && "text-secondary hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-900",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={clsx("premium-card", className)} {...props}>
      {children}
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>}
        <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
        {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral"
}: {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-secondary">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          {helper && <p className="mt-2 text-xs text-secondary">{helper}</p>}
        </div>
        <span className={clsx("rounded-lg border p-2", toneClass[tone])}>
          <Icon size={18} />
        </span>
      </div>
    </Card>
  );
}

export function StatusBadge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={clsx("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide", toneClass[tone])}>
      {children}
    </span>
  );
}

export function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-secondary">{label}</span>
      <span className="font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = "primary",
  label,
}: {
  value: number;
  tone?: "primary" | "success" | "warning" | "danger";
  label?: string;
}) {
  const color = {
    primary: "bg-primary",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500"
  }[tone];
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? `${clamped}% progress`}
      className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
    >
      <div className={clsx("h-full rounded-full transition-all duration-500", color)} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-slate-50/70 p-8 text-center dark:bg-slate-950/30">
      <Icon className="text-primary" size={28} />
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-secondary">{body}</p>
    </div>
  );
}

export function LiveDot({ tone = "success" }: { tone?: "success" | "warning" | "danger" }) {
  const colorMap = { success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      <span className={clsx("absolute inline-flex h-full w-full animate-ping rounded-full opacity-70", colorMap[tone])} />
      <span className={clsx("relative inline-flex h-2 w-2 rounded-full", colorMap[tone])} />
    </span>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={clsx("animate-skeleton rounded-lg", className)} aria-hidden />;
}

export function Badge({ count, max = 99, className }: { count: number; max?: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={clsx("animate-badge-pop inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[color:var(--danger)] px-1 text-[9px] font-black leading-none text-white", className)}>
      {count > max ? `${max}+` : count}
    </span>
  );
}

export function SectionDivider({ label, className }: { label?: string; className?: string }) {
  if (!label) return <div className={clsx("h-px bg-[color:var(--border)]", className)} />;
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div className="h-px flex-1 bg-[color:var(--border)]" />
      <span className="shrink-0 text-[9px] font-black uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">{label}</span>
      <div className="h-px flex-1 bg-[color:var(--border)]" />
    </div>
  );
}

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={clsx("animate-spin text-[color:var(--primary)]", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Loading"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

export function Input({
  label,
  error,
  hint,
  icon: Icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  const uid = useId();
  const id = `input-${uid}`;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
            aria-hidden
          />
        )}
        <input
          id={id}
          className={clsx(
            "h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground transition focus:outline-none focus:ring-2",
            Icon && "pl-9",
            error
              ? "border-rose-500 focus:ring-rose-500/30"
              : "border-border focus:ring-primary/30",
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          {...props}
        />
      </div>
      {error && (
        <p id={`${id}-err`} className="text-xs text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={`${id}-hint`} className="text-xs text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

export function Select({
  label,
  error,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
}) {
  const uid = useId();
  const id = `select-${uid}`;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-foreground">
          {label}
        </label>
      )}
      <select
        id={id}
        className={clsx(
          "h-10 w-full rounded-lg border bg-card px-3 text-sm text-foreground transition focus:outline-none focus:ring-2 appearance-none",
          error
            ? "border-rose-500 focus:ring-rose-500/30"
            : "border-border focus:ring-primary/30",
        )}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        {...props}
      >
        {children}
      </select>
      {error && (
        <p id={`${id}-err`} className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    overlayRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
  }[size];

  return (
    <div
      ref={overlayRef}
      tabIndex={-1}
      className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className={clsx(
          "relative w-full animate-scale-in overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
          sizeClass,
        )}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-secondary transition hover:bg-slate-100 hover:text-foreground dark:hover:bg-slate-800"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export function Tabs({
  tabs,
  activeTab,
  onTabChange,
  className,
}: {
  tabs: { key: string; label: string; icon?: LucideIcon }[];
  activeTab: string;
  onTabChange: (key: string) => void;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent, key: string) => {
    const keys = tabs.map((t) => t.key);
    const idx = keys.indexOf(key);
    if (e.key === "ArrowRight") {
      e.preventDefault();
      onTabChange(keys[(idx + 1) % keys.length]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      onTabChange(keys[(idx - 1 + keys.length) % keys.length]);
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      className={clsx(
        "flex gap-0.5 rounded-xl border border-border bg-slate-100/80 p-1 dark:bg-slate-900/80",
        className,
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            onKeyDown={(e) => handleKeyDown(e, tab.key)}
            tabIndex={isActive ? 0 : -1}
            className={clsx(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              isActive
                ? "bg-card text-foreground shadow-sm"
                : "text-secondary hover:text-foreground",
            )}
          >
            {Icon && <Icon size={13} aria-hidden />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

export function Tooltip({
  children,
  content,
  side = "top",
}: {
  children: React.ReactNode;
  content: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const uid = useId();
  const tooltipId = `tooltip-${uid}`;

  const posClass = {
    top:    "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left:   "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right:  "left-full top-1/2 -translate-y-1/2 ml-1.5",
  }[side];

  return (
    <span className="group relative inline-flex" aria-describedby={tooltipId}>
      {children}
      <span
        id={tooltipId}
        role="tooltip"
        className={clsx(
          "pointer-events-none absolute z-50 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-medium text-foreground shadow-md opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
          posClass,
        )}
      >
        {content}
      </span>
    </span>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon: Icon,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--primary-glow)]">
            <Icon size={18} className="text-[color:var(--primary)]" />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">
              {eyebrow}
            </p>
          )}
          <h1 className={clsx("font-semibold tracking-tight text-[color:var(--foreground)]", eyebrow ? "text-xl" : "text-2xl")}>
            {title}
          </h1>
          {description && (
            <p className="mt-0.5 text-xs text-[color:var(--muted-foreground)]">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

// ─── AlertBanner ──────────────────────────────────────────────────────────────

export function AlertBanner({
  tone = "info",
  title,
  children,
  onDismiss,
}: {
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div
      role="alert"
      className={clsx(
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm",
        toneClass[tone],
      )}
    >
      <div className="flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <p className={clsx("leading-relaxed", title && "mt-0.5 text-xs")}>{children}</p>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-60 hover:opacity-100"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
