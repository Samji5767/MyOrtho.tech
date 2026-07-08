"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Custom fallback node replaces the entire built-in UI when set. */
  fallback?: ReactNode;
  /** Heading text shown in the built-in error UI. Defaults to "Something went wrong". */
  fallbackLabel?: string;
  /**
   * Array of values that, when any element changes, automatically resets the
   * error boundary and re-renders children. Useful for route changes or data
   * refreshes that should clear stale errors.
   */
  resetKeys?: unknown[];
}

interface State {
  hasError: boolean;
  errorMessage: string;
  errorStack: string | undefined;
  showDetails: boolean;
}

export class RuntimeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
      errorStack: undefined,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    const errorStack = error instanceof Error ? error.stack : undefined;
    return { hasError: true, errorMessage: message, errorStack, showDetails: false };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    // Structured console logging — no external service calls.
    console.error("[RuntimeErrorBoundary] Unhandled render error", {
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
      componentStack: info.componentStack ?? undefined,
      timestamp: new Date().toISOString(),
    });
  }

  componentDidUpdate(prevProps: Props) {
    if (!this.state.hasError) return;
    const nextKeys = this.props.resetKeys ?? [];
    const prevKeys = prevProps.resetKeys ?? [];
    if (
      nextKeys.length !== prevKeys.length ||
      nextKeys.some((k, i) => k !== prevKeys[i])
    ) {
      this.handleReset();
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      errorMessage: "",
      errorStack: undefined,
      showDetails: false,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  toggleDetails = () => {
    this.setState((s) => ({ showDetails: !s.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      const {
        fallbackLabel = "Something went wrong",
      } = this.props;
      const { errorMessage, errorStack, showDetails } = this.state;
      const detailText = errorStack ?? errorMessage;

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex min-h-[200px] flex-col items-center justify-center gap-5 rounded-2xl border border-[color:var(--danger,#f43f5e)]/20 bg-[color:var(--danger,#f43f5e)]/5 p-8 text-center"
        >
          {/* Icon */}
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[color:var(--danger,#f43f5e)]/10">
            <AlertTriangle
              size={22}
              className="text-[color:var(--danger,#f43f5e)]"
              aria-hidden
            />
          </div>

          {/* Message */}
          <div className="max-w-sm">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {fallbackLabel}
            </p>
            <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
              {errorMessage}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-xs font-semibold text-[color:var(--foreground)] transition hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] dark:hover:bg-slate-800"
            >
              <RefreshCw size={13} aria-hidden />
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-xs font-semibold text-[color:var(--foreground)] transition hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] dark:hover:bg-slate-800"
            >
              Reload page
            </button>
            <a
              href="/dashboard"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-xs font-semibold text-[color:var(--foreground)] transition hover:bg-slate-100 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] dark:hover:bg-slate-800"
            >
              <Home size={13} aria-hidden />
              Go to dashboard
            </a>
          </div>

          {/* Collapsible error details */}
          {detailText && (
            <div className="w-full max-w-md text-left">
              <button
                type="button"
                onClick={this.toggleDetails}
                aria-expanded={showDetails}
                aria-controls="reb-error-details"
                className="inline-flex items-center gap-1 text-[10px] font-semibold text-[color:var(--muted-foreground)] transition hover:text-[color:var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--primary)] rounded"
              >
                {showDetails ? (
                  <ChevronUp size={12} aria-hidden />
                ) : (
                  <ChevronDown size={12} aria-hidden />
                )}
                {showDetails ? "Hide" : "Show"} error details
              </button>
              {showDetails && (
                <pre
                  id="reb-error-details"
                  className="mt-2 max-h-40 overflow-auto rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-[10px] leading-relaxed text-[color:var(--muted-foreground)] whitespace-pre-wrap break-all"
                >
                  {detailText}
                </pre>
              )}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default RuntimeErrorBoundary;
