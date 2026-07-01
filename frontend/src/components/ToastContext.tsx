"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastType = "success" | "error" | "info" | "warning";

interface ToastOptions {
  title: string;
  description?: string;
  type?: ToastType;
  duration?: number;
}

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration: number;
  /** true once mounted — drives the slide-in animation */
  visible: boolean;
}

// ---------------------------------------------------------------------------
// Internal context (list + dismiss) — consumed only by Toaster
// ---------------------------------------------------------------------------

interface ToastListContextValue {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
}

const ToastListContext = createContext<ToastListContextValue | null>(null);

// ---------------------------------------------------------------------------
// Public context — consumed by useToast()
// ---------------------------------------------------------------------------

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Constants & style config
// ---------------------------------------------------------------------------

const MAX_TOASTS = 4;
const DEFAULT_DURATION = 3500;

const typeConfig: Record<
  ToastType,
  { border: string; iconColor: string; Icon: React.ElementType }
> = {
  success: {
    border: "border-l-4 border-l-green-500",
    iconColor: "text-green-500",
    Icon: CheckCircle2,
  },
  error: {
    border: "border-l-4 border-l-red-500",
    iconColor: "text-red-500",
    Icon: AlertCircle,
  },
  info: {
    border: "border-l-4 border-l-[color:var(--primary)]",
    iconColor: "text-[color:var(--primary)]",
    Icon: Info,
  },
  warning: {
    border: "border-l-4 border-l-amber-500",
    iconColor: "text-amber-500",
    Icon: AlertTriangle,
  },
};

// ---------------------------------------------------------------------------
// Single Toast card
// ---------------------------------------------------------------------------

interface ToastCardProps {
  item: ToastItem;
  onClose: (id: string) => void;
}

function ToastCard({ item, onClose }: ToastCardProps) {
  const { border, iconColor, Icon } = typeConfig[item.type];

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      style={{
        transition:
          "opacity 220ms ease, transform 220ms cubic-bezier(0.16,1,0.3,1)",
        opacity: item.visible ? 1 : 0,
        transform: item.visible
          ? "translateX(0)"
          : "translateX(calc(100% + 1rem))",
      }}
      className={[
        "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]",
        "shadow-[var(--shadow-md)] p-3 flex items-start gap-3 backdrop-blur",
        border,
      ].join(" ")}
    >
      {/* Icon */}
      <Icon className={["mt-0.5 shrink-0 w-4 h-4", iconColor].join(" ")} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug text-[color:var(--foreground)] truncate">
          {item.title}
        </p>
        {item.description && (
          <p className="text-xs text-[color:var(--muted-foreground)] mt-0.5 line-clamp-2">
            {item.description}
          </p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={() => onClose(item.id)}
        aria-label="Dismiss notification"
        className="shrink-0 mt-0.5 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider — owns all toast state and exposes both contexts
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  /** id → auto-dismiss timer handle */
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  /** Fade out then remove */
  const dismiss = useCallback((id: string) => {
    // Cancel any existing timer for this id
    const prev = timers.current.get(id);
    if (prev) clearTimeout(prev);

    // Fade out
    setToasts((list) =>
      list.map((t) => (t.id === id ? { ...t, visible: false } : t))
    );

    // Remove from DOM after transition
    const handle = setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
      timers.current.delete(id);
    }, 260);
    timers.current.set(id, handle);
  }, []);

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = options.duration ?? DEFAULT_DURATION;
      const type: ToastType = options.type ?? "info";

      const newItem: ToastItem = {
        id,
        title: options.title,
        description: options.description,
        type,
        duration,
        visible: false, // start hidden; RAF below triggers slide-in
      };

      setToasts((list) => {
        // Enforce max — drop oldest when at cap
        const trimmed =
          list.length >= MAX_TOASTS
            ? list.slice(list.length - MAX_TOASTS + 1)
            : list;
        return [...trimmed, newItem];
      });

      // Two nested rAFs guarantee the element is in the DOM before we flip visible
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setToasts((list) =>
            list.map((t) => (t.id === id ? { ...t, visible: true } : t))
          );
        });
      });

      // Schedule auto-dismiss
      const handle = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, handle);
    },
    [dismiss]
  );

  // Clear all timers on unmount
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastListContext.Provider value={{ toasts, dismiss }}>
        {children}
      </ToastListContext.Provider>
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Toaster — renders the toast stack; must live inside ToastProvider
// ---------------------------------------------------------------------------

export function Toaster() {
  const ctx = useContext(ToastListContext);
  if (!ctx) return null;

  const { toasts, dismiss } = ctx;

  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-[calc(var(--tab-bar-height,60px)+1rem)] right-4 z-[9999] flex flex-col gap-2 max-w-[340px] w-[calc(100vw-2rem)] pointer-events-none"
    >
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastCard item={item} onClose={dismiss} />
        </div>
      ))}
    </div>
  );
}
