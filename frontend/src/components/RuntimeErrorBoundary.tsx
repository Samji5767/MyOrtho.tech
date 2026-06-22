"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class RuntimeErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string | null }) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[RuntimeErrorBoundary]', error, info.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-2xl border border-rose-500/20 bg-rose-50/60 p-8 text-center dark:bg-rose-900/10">
          <AlertTriangle size={24} className="text-rose-500" />
          <div>
            <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">
              Something went wrong
            </p>
            <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">
              {this.state.errorMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-300/50 bg-white px-4 text-xs font-semibold text-rose-700 transition-transform active:scale-95 dark:bg-rose-900/30 dark:text-rose-300"
          >
            <RefreshCw size={13} />
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RuntimeErrorBoundary;
