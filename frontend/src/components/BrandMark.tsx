/**
 * BrandMark — the MyOrtho.tech logo + wordmark component.
 *
 * Variants:
 *   "icon-only" — icon box only, no text
 *   "compact"   — icon + "MyOrtho.tech" on a single line
 *   "full"      — icon + "MyOrtho.tech" (+ tagline when size="lg")
 *
 * Sizes: "sm" (32 px) | "md" (40 px) | "lg" (56 px)
 *
 * CSS-only gradient fallback
 * ─────────────────────────
 * The icon container always renders the brand gradient via CSS custom properties
 * (--primary → --clinical-highlight), which automatically switches between
 * light and dark values defined in globals.css.
 *
 * The <img> is absolutely positioned on top of the gradient. When the image
 * loads it covers the gradient entirely. When it fails to load the gradient
 * remains visible — no onError handler required, making this safe to render
 * inside Server Components.
 */

import type { CSSProperties } from "react";

export type BrandMarkVariant = "icon-only" | "full" | "compact";
export type BrandMarkSize = "sm" | "md" | "lg";

export interface BrandMarkProps {
  /** Layout variant. Defaults to "full". */
  variant?: BrandMarkVariant;
  /** Icon size tier. Defaults to "md". */
  size?: BrandMarkSize;
  /** Additional class names applied to the root element. */
  className?: string;
}

// ── Size tables ──────────────────────────────────────────────────────────────

const ICON_PX: Record<BrandMarkSize, number> = {
  sm: 32,
  md: 40,
  lg: 56,
};

const ICON_RADIUS: Record<BrandMarkSize, number> = {
  sm: 10,
  md: 14,
  lg: 18,
};

const NAME_CLASS: Record<BrandMarkSize, string> = {
  sm: "text-sm font-semibold tracking-tight",
  md: "text-base font-semibold tracking-tight",
  lg: "text-xl font-bold tracking-tight",
};

const TAGLINE_CLASS: Record<BrandMarkSize, string> = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
};

const GAP_CLASS: Record<BrandMarkSize, string> = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function BrandMark({
  variant = "full",
  size = "md",
  className = "",
}: BrandMarkProps) {
  const px = ICON_PX[size];

  // The container carries the brand gradient at all times.
  // Light mode: #0f9f8f → #5b6ee1 (via --primary / --clinical-highlight)
  // Dark mode:  #2dd4bf → #9da7ff (same vars, different values in .dark)
  const containerStyle: CSSProperties = {
    width: px,
    height: px,
    borderRadius: ICON_RADIUS[size],
    background: "linear-gradient(135deg, var(--primary), var(--clinical-highlight))",
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
    display: "inline-block",
  };

  // Absolutely fills the container. color:transparent hides alt text on failure
  // so only the gradient behind is visible — no JS event handler needed.
  const imgStyle: CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    color: "transparent",
  };

  const iconEl = (
    <span style={containerStyle} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/app-icon.png" alt="" style={imgStyle} />
    </span>
  );

  // ── icon-only ──────────────────────────────────────────────────────────────
  if (variant === "icon-only") {
    return (
      <span
        className={["inline-flex shrink-0", className].filter(Boolean).join(" ")}
      >
        {iconEl}
      </span>
    );
  }

  // ── compact (icon + name, single line) ────────────────────────────────────
  if (variant === "compact") {
    return (
      <span
        className={[
          "inline-flex items-center",
          GAP_CLASS[size],
          className,
        ].filter(Boolean).join(" ")}
      >
        {iconEl}
        <span className={[NAME_CLASS[size], "text-[color:var(--foreground)]"].join(" ")}>
          MyOrtho.tech
        </span>
      </span>
    );
  }

  // ── full (icon + name + optional tagline) ─────────────────────────────────
  // Tagline ("From Scan to Smile") is only shown at size="lg".
  const showTagline = size === "lg";

  return (
    <span
      className={[
        "inline-flex items-center",
        GAP_CLASS[size],
        className,
      ].filter(Boolean).join(" ")}
    >
      {iconEl}
      <span className="flex flex-col leading-none">
        <span className={[NAME_CLASS[size], "text-[color:var(--foreground)]"].join(" ")}>
          MyOrtho.tech
        </span>
        {showTagline && (
          <span
            className={[
              TAGLINE_CLASS[size],
              "mt-1 text-[color:var(--muted-foreground)]",
            ].join(" ")}
          >
            From Scan to Smile
          </span>
        )}
      </span>
    </span>
  );
}
