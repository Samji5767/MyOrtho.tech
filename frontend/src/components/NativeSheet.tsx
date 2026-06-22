import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

interface NativeSheetProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function NativeSheet({ isOpen, title, onClose, children }: NativeSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 340);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center ios-sheet-backdrop"
      style={{
        background: `rgba(0,0,0,${visible ? 0.32 : 0})`,
        backdropFilter: visible ? "blur(6px) saturate(1.1)" : "none",
        transition: "background 0.28s ease, backdrop-filter 0.28s ease",
      }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[color:var(--card)] border-t border-[color:var(--border)] rounded-t-3xl shadow-xl z-10 flex flex-col max-h-[85vh] ios-sheet-content"
        style={{
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.34s cubic-bezier(0.16, 1, 0.3, 1)",
          paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* iOS drag handle */}
        <div className="flex w-full justify-center py-2.5 shrink-0">
          <div className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Title & close */}
        <div className="flex items-center justify-between border-b border-[color:var(--border)]/40 px-5 pb-3 shrink-0">
          <h3 className="text-sm font-bold text-[color:var(--foreground)]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border)]/50 bg-[color-mix(in_srgb,var(--card)_88%,transparent)] text-[color:var(--muted-foreground)] transition-colors duration-150 hover:bg-[color:var(--card)] active:scale-95"
          >
            <X size={14} />
          </button>
        </div>

        {/* Contents */}
        <div className="no-scrollbar flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
