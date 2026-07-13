"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw, Search, Shield, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { listAuditEvents, getAuditSummary } from "@/lib/api/audit";
import type { AuditEvent, AuditSummary } from "@/lib/api/audit";

const PAGE_SIZE = 50;
const ADMIN_ROLES = ["admin", "super_admin"] as const;

const COLS = ["Time", "Actor", "Action", "Resource Type", "Resource ID", "IP"] as const;

export default function AuditTrailPage() {
  const { user, status } = useAuth();
  const router = useRouter();
  const [events, setEvents]   = useState<AuditEvent[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [page, setPage]       = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const isAdmin = user ? (ADMIN_ROLES as ReadonlyArray<string>).includes(user.role) : false;

  useEffect(() => {
    if (status === "loading") return;
    if (!user || !isAdmin) {
      router.replace(user ? "/admin" : "/login");
    }
  }, [user, isAdmin, status, router]);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const [eventsData, summaryData] = await Promise.all([
        listAuditEvents(PAGE_SIZE, page * PAGE_SIZE),
        getAuditSummary(24),
      ]);
      setEvents(eventsData);
      setSummary(summaryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load audit events.");
    } finally {
      setLoading(false);
    }
  }, [page, isAdmin]);

  useEffect(() => { void load(); }, [load]);

  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) =>
      (e.actorEmail ?? "").toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q) ||
      (e.resourceType ?? "").toLowerCase().includes(q) ||
      (e.resourceId ?? "").toLowerCase().includes(q),
    );
  }, [events, searchQuery]);

  if (status === "loading" || !user || !isAdmin) return null;

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8 sm:px-6 min-h-screen">

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Shield size={28} aria-hidden className="shrink-0 text-[color:var(--primary)]" />
          <div>
            <h1 className="text-2xl font-bold leading-tight text-[color:var(--foreground)]">
              Audit Trail
            </h1>
            <p className="text-sm text-[color:var(--muted-foreground)]">Security event log</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh audit events"
          className="flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={15} aria-hidden className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Summary chip */}
      {summary !== null && (
        <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-5 py-3 text-sm">
          <span className="text-xl font-bold tabular-nums text-[color:var(--primary)]">
            {summary.recentCount.toLocaleString()}
          </span>
          <span className="text-[color:var(--muted-foreground)]">
            events in the last {summary.windowHours} hours
          </span>
        </div>
      )}

      {/* Search */}
      <div className="mb-4 relative">
        <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter by actor, action, resource type, or ID…"
          className="h-9 w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] pl-9 pr-9 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div role="status" aria-label="Loading audit events" className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-[color:var(--border)]"
              style={{ opacity: 1 - i * 0.15 }}
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-rose-300/50 bg-rose-50/60 px-5 py-4 text-sm text-rose-700 dark:border-rose-700/30 dark:bg-rose-900/10 dark:text-rose-400"
        >
          <AlertTriangle size={18} aria-hidden className="mt-0.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={() => void load()} className="shrink-0 font-semibold hover:underline">
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && filteredEvents.length === 0 && (
        <div className="py-16 text-center text-[15px] text-[color:var(--muted-foreground)]">
          {searchQuery ? `No events match "${searchQuery}"` : "No audit events found."}
        </div>
      )}

      {/* Table */}
      {!loading && !error && filteredEvents.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
          <table role="table" className="w-full border-collapse bg-[color:var(--card)] text-[13px]">
            <thead>
              <tr className="border-b border-[color:var(--border)] bg-black/[0.03] dark:bg-white/[0.03]">
                {COLS.map((col) => (
                  <th
                    key={col}
                    scope="col"
                    className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-[color:var(--muted-foreground)]"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.map((event, idx) => (
                <tr
                  key={event.id}
                  className={idx < filteredEvents.length - 1 ? "border-b border-[color:var(--border)]" : ""}
                >
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-[color:var(--muted-foreground)]">
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {event.actorEmail ?? <span className="text-[color:var(--muted-foreground)]">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <code className="rounded bg-black/[0.07] px-1.5 py-0.5 font-mono text-[11px] dark:bg-white/[0.08]">
                      {event.action}
                    </code>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{event.resourceType}</td>
                  <td
                    className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-[color:var(--muted-foreground)]"
                    title={event.resourceId ?? undefined}
                  >
                    {event.resourceId ? event.resourceId.slice(0, 8) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-[color:var(--muted-foreground)]">
                    {event.ipAddress ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && (events.length > 0 || page > 0) && (
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ← Previous
          </button>

          <span className="text-[13px] text-[color:var(--muted-foreground)]">
            Page {page + 1}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={events.length < PAGE_SIZE}
            aria-label="Next page"
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
