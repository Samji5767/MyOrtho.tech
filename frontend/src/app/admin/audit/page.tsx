"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Shield, AlertTriangle } from "lucide-react";
import { listAuditEvents, getAuditSummary } from "@/lib/api/audit";
import type { AuditEvent, AuditSummary } from "@/lib/api/audit";

const PAGE_SIZE = 50;

export default function AuditTrailPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
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
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePrev = () => setPage((p) => Math.max(0, p - 1));
  const handleNext = () => setPage((p) => p + 1);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        padding: "2rem 1.5rem",
        maxWidth: "1200px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Shield
            size={28}
            aria-hidden="true"
            style={{ color: "var(--primary)", flexShrink: 0 }}
          />
          <div>
            <h1
              style={{
                fontSize: "1.5rem",
                fontWeight: 700,
                margin: 0,
                lineHeight: 1.2,
              }}
            >
              Audit Trail
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.875rem",
                color: "var(--muted-foreground)",
              }}
            >
              Security event log
            </p>
          </div>
        </div>

        <button
          onClick={load}
          disabled={loading}
          aria-label="Refresh audit events"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            border: "1px solid var(--border)",
            backgroundColor: "var(--card)",
            color: "var(--foreground)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.6 : 1,
            fontSize: "0.875rem",
            fontWeight: 500,
            transition: "opacity 0.15s",
          }}
        >
          <RefreshCw
            size={15}
            aria-hidden="true"
            style={{
              animation: loading ? "spin 1s linear infinite" : "none",
            }}
          />
          Refresh
        </button>
      </div>

      {/* Summary card */}
      {summary !== null && (
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            backgroundColor: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: "0.5rem",
            padding: "0.75rem 1.25rem",
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
          }}
        >
          <span
            style={{
              fontWeight: 700,
              fontSize: "1.25rem",
              color: "var(--primary)",
            }}
          >
            {summary.recentCount.toLocaleString()}
          </span>
          <span style={{ color: "var(--muted-foreground)" }}>
            events in the last {summary.windowHours} hours
          </span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div
          role="status"
          aria-label="Loading audit events"
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: "3rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--border)",
                opacity: 1 - i * 0.15,
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "0.75rem",
            padding: "1rem 1.25rem",
            borderRadius: "0.5rem",
            border: "1px solid #f87171",
            backgroundColor: "rgba(239,68,68,0.08)",
            color: "#ef4444",
            fontSize: "0.875rem",
          }}
        >
          <AlertTriangle size={18} aria-hidden="true" style={{ flexShrink: 0, marginTop: "0.1rem" }} />
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && events.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "4rem 1rem",
            color: "var(--muted-foreground)",
            fontSize: "0.9375rem",
          }}
        >
          No audit events found.
        </div>
      )}

      {/* Table */}
      {!loading && !error && events.length > 0 && (
        <div style={{ overflowX: "auto", borderRadius: "0.5rem", border: "1px solid var(--border)" }}>
          <table
            role="table"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.8125rem",
              backgroundColor: "var(--card)",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border)",
                  backgroundColor: "rgba(128,128,128,0.05)",
                }}
              >
                {(
                  [
                    "Time",
                    "Actor",
                    "Action",
                    "Resource Type",
                    "Resource ID",
                    "IP",
                  ] as const
                ).map((col) => (
                  <th
                    key={col}
                    scope="col"
                    style={{
                      padding: "0.75rem 1rem",
                      textAlign: "left",
                      fontWeight: 600,
                      fontSize: "0.75rem",
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "var(--muted-foreground)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((event, idx) => (
                <tr
                  key={event.id}
                  style={{
                    borderBottom:
                      idx < events.length - 1
                        ? "1px solid var(--border)"
                        : "none",
                  }}
                >
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      whiteSpace: "nowrap",
                      color: "var(--muted-foreground)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {new Date(event.createdAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                    {event.actorEmail ?? (
                      <span style={{ color: "var(--muted-foreground)" }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                    <code
                      style={{
                        backgroundColor: "rgba(128,128,128,0.12)",
                        borderRadius: "0.25rem",
                        padding: "0.125rem 0.375rem",
                        fontSize: "0.75rem",
                        fontFamily: "ui-monospace, monospace",
                      }}
                    >
                      {event.action}
                    </code>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", whiteSpace: "nowrap" }}>
                    {event.resourceType}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      whiteSpace: "nowrap",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "0.75rem",
                      color: "var(--muted-foreground)",
                    }}
                    title={event.resourceId ?? undefined}
                  >
                    {event.resourceId ? (
                      event.resourceId.slice(0, 8)
                    ) : (
                      <span>—</span>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "0.75rem 1rem",
                      whiteSpace: "nowrap",
                      fontFamily: "ui-monospace, monospace",
                      fontSize: "0.75rem",
                      color: "var(--muted-foreground)",
                    }}
                  >
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "1.25rem",
            gap: "0.75rem",
          }}
        >
          <button
            onClick={handlePrev}
            disabled={page === 0}
            aria-label="Previous page"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
              cursor: page === 0 ? "not-allowed" : "pointer",
              opacity: page === 0 ? 0.4 : 1,
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "opacity 0.15s",
            }}
          >
            ← Previous
          </button>

          <span
            style={{
              fontSize: "0.8125rem",
              color: "var(--muted-foreground)",
            }}
          >
            Page {page + 1}
          </span>

          <button
            onClick={handleNext}
            disabled={events.length < PAGE_SIZE}
            aria-label="Next page"
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border)",
              backgroundColor: "var(--card)",
              color: "var(--foreground)",
              cursor: events.length < PAGE_SIZE ? "not-allowed" : "pointer",
              opacity: events.length < PAGE_SIZE ? 0.4 : 1,
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "opacity 0.15s",
            }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Keyframe animations injected via a style tag */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.25; }
        }
      `}</style>
    </div>
  );
}
