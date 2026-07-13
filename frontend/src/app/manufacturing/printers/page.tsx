"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  Plus,
  Printer,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import { api } from "@/lib/api/client";
import {
  Button,
  EmptyState,
  SkeletonBlock,
  StatusBadge,
} from "@/components/DesignSystem";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PrinterRecord {
  id: string;
  name: string;
  brand: string;
  model: string;
  status: string;
  ipAddress: string | null;
  firmwareVersion: string | null;
  materialType: string | null;
  materialVolumeMl: number;
  connectorStatus: string;
  apiEndpoint: string | null;
  buildVolumeXMm: number | null;
  buildVolumeYMm: number | null;
  buildVolumeZMm: number | null;
  lastCalibratedAt: string | null;
  nextMaintenanceDue: string | null;
  connectorNote: string;
  createdAt: string;
  updatedAt: string;
}

type PrinterStatus = "idle" | "printing" | "offline" | "error" | "maintenance";
type ConnectorStatus = "configured" | "not_configured" | "error";
type BrandFilter =
  | "all"
  | "SprintRay"
  | "Formlabs"
  | "Asiga"
  | "Ackuretta"
  | "Carbon"
  | "NextDent";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<
  PrinterStatus,
  "neutral" | "primary" | "success" | "warning" | "danger"
> = {
  idle:        "success",
  printing:    "primary",
  offline:     "neutral",
  error:       "danger",
  maintenance: "warning",
};

const STATUS_LABEL: Record<PrinterStatus, string> = {
  idle:        "Idle",
  printing:    "Printing",
  offline:     "Offline",
  error:       "Error",
  maintenance: "Maintenance",
};

const CONNECTOR_TONE: Record<ConnectorStatus, "success" | "neutral" | "danger"> = {
  configured:     "success",
  not_configured: "neutral",
  error:          "danger",
};

const CONNECTOR_LABEL: Record<ConnectorStatus, string> = {
  configured:     "Connected",
  not_configured: "Not configured",
  error:          "Connector error",
};

const BRAND_FILTERS: BrandFilter[] = [
  "all",
  "SprintRay",
  "Formlabs",
  "Asiga",
  "Ackuretta",
  "Carbon",
  "NextDent",
];

const BRAND_FILTER_LABEL: Record<BrandFilter, string> = {
  all:       "All",
  SprintRay: "SprintRay",
  Formlabs:  "Formlabs",
  Asiga:     "Asiga",
  Ackuretta: "Ackuretta",
  Carbon:    "Carbon",
  NextDent:  "NextDent",
};

// ─── Status stripe colours (border-l tones that mirror StatusBadge) ───────────

const STATUS_STRIPE: Record<string, string> = {
  success: "border-l-emerald-500",
  primary: "border-l-[color:var(--primary)]",
  neutral: "border-l-slate-300 dark:border-l-slate-600",
  danger:  "border-l-rose-500",
  warning: "border-l-amber-500",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isValidStatus(s: string): s is PrinterStatus {
  return s in STATUS_TONE;
}

function isValidConnectorStatus(s: string): s is ConnectorStatus {
  return s in CONNECTOR_TONE;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });
}

function isPastDue(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

// ─── MetaRow ─────────────────────────────────────────────────────────────────

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[color:var(--border)]/60 py-1.5 last:border-0">
      <dt className="shrink-0 text-[11px] text-[color:var(--muted-foreground)]">
        {label}
      </dt>
      <dd className="min-w-0 text-right text-xs font-medium text-[color:var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

// ─── SummaryChip ─────────────────────────────────────────────────────────────

function SummaryChip({
  icon,
  label,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  tone: "success" | "danger" | "warning" | "primary";
}) {
  const toneClass: Record<string, string> = {
    success: "border-emerald-200/60 bg-emerald-50/70 text-emerald-700 dark:border-emerald-700/30 dark:bg-emerald-900/10 dark:text-emerald-400",
    danger:  "border-rose-200/60 bg-rose-50/70 text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400",
    warning: "border-amber-200/60 bg-amber-50/70 text-amber-700 dark:border-amber-700/30 dark:bg-amber-900/10 dark:text-amber-400",
    primary: "border-[color:var(--primary)]/20 bg-[color:var(--primary-glow)] text-[color:var(--primary)]",
  };
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        toneClass[tone],
      ].join(" ")}
    >
      {icon}
      {label}
    </span>
  );
}

// ─── PrinterCard ─────────────────────────────────────────────────────────────

function PrinterCard({ printer }: { printer: PrinterRecord }) {
  const status = isValidStatus(printer.status) ? printer.status : null;
  const statusTone = status ? STATUS_TONE[status] : "neutral";
  const statusLabel = status ? STATUS_LABEL[status] : printer.status;

  const connStatus = isValidConnectorStatus(printer.connectorStatus)
    ? printer.connectorStatus
    : null;
  const connTone  = connStatus ? CONNECTOR_TONE[connStatus] : "neutral";
  const connLabel = connStatus ? CONNECTOR_LABEL[connStatus] : printer.connectorStatus;

  const isOnline =
    printer.status !== "offline" && printer.connectorStatus === "configured";
  const hasBuildVolume =
    printer.buildVolumeXMm != null &&
    printer.buildVolumeYMm != null &&
    printer.buildVolumeZMm != null;
  const maintenancePastDue = isPastDue(printer.nextMaintenanceDue);
  const stripe = STATUS_STRIPE[statusTone] ?? STATUS_STRIPE.neutral;

  return (
    <article
      className={[
        "premium-card flex flex-col gap-0 overflow-hidden border-l-[3px] p-0",
        stripe,
      ].join(" ")}
    >
      {/* ── Card header ── */}
      <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {isOnline ? (
              <Wifi
                size={12}
                className="shrink-0 text-emerald-500"
                aria-label="Online"
              />
            ) : (
              <WifiOff
                size={12}
                className="shrink-0 text-[color:var(--muted-foreground)]"
                aria-label="Offline"
              />
            )}
            <h2 className="truncate text-sm font-semibold text-[color:var(--foreground)]">
              {printer.name}
            </h2>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-[color:var(--muted-foreground)]">
            {printer.brand} · {printer.model}
          </p>
        </div>
        <Printer
          size={15}
          className="mt-0.5 shrink-0 text-[color:var(--muted-foreground)]"
          aria-hidden
        />
      </div>

      {/* ── Status badges ── */}
      <div className="flex flex-wrap gap-1.5 px-4 pb-3">
        <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
        <StatusBadge tone={connTone}>{connLabel}</StatusBadge>
      </div>

      {/* ── Divider ── */}
      <div className="mx-4 h-px bg-[color:var(--border)]" />

      {/* ── Metadata rows ── */}
      <dl className="px-4 py-3">
        {printer.ipAddress && (
          <MetaRow
            label="IP address"
            value={
              <span className="font-mono text-[11px]">{printer.ipAddress}</span>
            }
          />
        )}
        {printer.firmwareVersion && (
          <MetaRow
            label="Firmware"
            value={
              <span className="font-mono text-[11px]">
                {printer.firmwareVersion}
              </span>
            }
          />
        )}
        {printer.materialType && (
          <MetaRow
            label="Material"
            value={
              <>
                {printer.materialType}
                {printer.materialVolumeMl > 0 && (
                  <span className="ml-1 font-normal text-[color:var(--muted-foreground)]">
                    · {printer.materialVolumeMl} mL
                  </span>
                )}
              </>
            }
          />
        )}
        {hasBuildVolume && (
          <MetaRow
            label="Build volume"
            value={
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {printer.buildVolumeXMm} × {printer.buildVolumeYMm} ×{" "}
                {printer.buildVolumeZMm} mm
              </span>
            }
          />
        )}
        <MetaRow
          label="Last calibrated"
          value={
            <span className="flex items-center justify-end gap-1">
              <Activity size={10} aria-hidden />
              {formatDate(printer.lastCalibratedAt)}
            </span>
          }
        />
        <MetaRow
          label="Next maintenance"
          value={
            printer.nextMaintenanceDue ? (
              <span
                className={
                  maintenancePastDue
                    ? "font-semibold text-rose-600 dark:text-rose-400"
                    : undefined
                }
              >
                {maintenancePastDue && (
                  <AlertCircle
                    size={10}
                    className="mr-0.5 inline-block -translate-y-px"
                    aria-hidden
                  />
                )}
                {formatDate(printer.nextMaintenanceDue)}
                {maintenancePastDue && (
                  <span className="ml-1 text-[10px] font-bold uppercase tracking-wide">
                    overdue
                  </span>
                )}
              </span>
            ) : (
              "—"
            )
          }
        />
      </dl>

      {/* ── Connector note ── */}
      {printer.connectorNote && (
        <div className="border-t border-[color:var(--border)] px-4 py-2.5">
          <p className="text-[10px] leading-relaxed text-[color:var(--muted-foreground)]">
            {printer.connectorNote}
          </p>
        </div>
      )}
    </article>
  );
}

// ─── Skeleton grid card ───────────────────────────────────────────────────────

function PrinterSkeleton() {
  return (
    <div className="premium-card overflow-hidden border-l-[3px] border-l-slate-200 p-0 dark:border-l-slate-700">
      <div className="px-4 pb-3 pt-4">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="mt-1.5 h-3 w-28 opacity-60" />
      </div>
      <div className="flex gap-1.5 px-4 pb-3">
        <SkeletonBlock className="h-6 w-16 rounded-full" />
        <SkeletonBlock className="h-6 w-24 rounded-full" />
      </div>
      <div className="mx-4 h-px bg-[color:var(--border)]" />
      <div className="flex flex-col gap-1.5 px-4 py-3">
        {(["w-11", "w-9", "w-14", "w-12", "w-10", "w-11"] as const).map((wClass, i) => (
          <div
            key={i}
            className="flex justify-between border-b border-[color:var(--border)]/40 pb-1.5"
          >
            <SkeletonBlock className="h-3 w-20 opacity-50" />
            <SkeletonBlock className={`h-3 opacity-70 ${wClass}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PrinterFleetPage() {
  const [printers, setPrinters] = useState<PrinterRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<BrandFilter>("all");

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchPrinters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<PrinterRecord[]>("/api/printers");
      setPrinters(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load printers",
      );
      setPrinters([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrinters();
  }, [fetchPrinters]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const visible =
    brandFilter === "all"
      ? printers
      : printers.filter(
          (p) => p.brand.toLowerCase() === brandFilter.toLowerCase(),
        );

  const onlineCount = printers.filter(
    (p) => p.status !== "offline" && p.connectorStatus === "configured",
  ).length;
  const errorCount = printers.filter(
    (p) => p.status === "error" || p.connectorStatus === "error",
  ).length;
  const overdueCount = printers.filter((p) =>
    isPastDue(p.nextMaintenanceDue),
  ).length;
  const printingCount = printers.filter((p) => p.status === "printing").length;

  return (
    <section className="animate-page-enter mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height,60px)+var(--sa-bottom,0px)+1.5rem)] pt-4 sm:px-5">

      {/* ── Back link ── */}
      <Link
        href="/manufacturing"
        className="flex w-fit items-center gap-1 text-xs font-semibold text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)]"
      >
        <ChevronRight size={13} className="rotate-180" aria-hidden />
        Manufacturing
      </Link>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--muted-foreground)]">
            Manufacturing
          </p>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
            <Printer
              size={22}
              className="text-[color:var(--primary)]"
              aria-hidden
            />
            Printer Fleet
            {!loading && printers.length > 0 && (
              <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[color:var(--primary-glow)] px-2 text-xs font-bold text-[color:var(--primary)]">
                {printers.length}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
            Monitor connectivity, materials, and maintenance across all printers
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => console.log("Register Printer — placeholder")}
        >
          <Plus size={15} />
          Register Printer
        </Button>
      </div>

      {/* ── Summary chips ── */}
      {!loading && printers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <SummaryChip
            icon={<Wifi size={11} />}
            label={`${onlineCount} online`}
            tone="success"
          />
          {printingCount > 0 && (
            <SummaryChip
              icon={<Activity size={11} />}
              label={`${printingCount} printing`}
              tone="primary"
            />
          )}
          {errorCount > 0 && (
            <SummaryChip
              icon={<AlertCircle size={11} />}
              label={`${errorCount} error${errorCount !== 1 ? "s" : ""}`}
              tone="danger"
            />
          )}
          {overdueCount > 0 && (
            <SummaryChip
              icon={<Wrench size={11} />}
              label={`${overdueCount} maintenance overdue`}
              tone="warning"
            />
          )}
        </div>
      )}

      {/* ── Brand filter pills ── */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
        {BRAND_FILTERS.map((brand) => (
          <button
            key={brand}
            type="button"
            onClick={() => setBrandFilter(brand)}
            className={[
              "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95",
              brandFilter === brand
                ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]",
            ].join(" ")}
          >
            {BRAND_FILTER_LABEL[brand]}
          </button>
        ))}
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-rose-200/60 bg-rose-50/60 px-4 py-3 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400"
        >
          <AlertCircle size={15} className="shrink-0" aria-hidden />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => void fetchPrinters()}
            className="shrink-0 text-xs font-semibold underline-offset-2 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <PrinterSkeleton key={i} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Printer}
          title={
            brandFilter === "all"
              ? "No printers registered"
              : `No ${brandFilter} printers found`
          }
          message={
            brandFilter === "all"
              ? "Register your first printer to start monitoring the fleet. Vendor connectors are required for real-time telemetry."
              : `Try switching to a different brand, or view all printers.`
          }
          action={
            brandFilter === "all" ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => console.log("Register Printer — placeholder")}
              >
                <Plus size={14} />
                Register Printer
              </Button>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBrandFilter("all")}
              >
                View all printers
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((printer) => (
              <PrinterCard key={printer.id} printer={printer} />
            ))}
          </div>
          <p className="text-xs text-[color:var(--muted-foreground)]">
            {visible.length} printer{visible.length !== 1 ? "s" : ""}
            {brandFilter !== "all" && <span> · {brandFilter}</span>}
          </p>
        </>
      )}
    </section>
  );
}
