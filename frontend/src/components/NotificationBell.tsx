"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, X, AlertCircle, Info, CheckCircle2, Zap } from "lucide-react";
import { listNotifications, markAllRead, markRead, dismissNotification, Notification } from "@/lib/api/notifications";

const TYPE_ICON: Record<string, React.ReactNode> = {
  case_approved:      <CheckCircle2 size={13} className="text-green-500" />,
  case_rejected:      <X size={13} className="text-red-500" />,
  plan_ready:         <Zap size={13} className="text-blue-500" />,
  qc_failed:          <AlertCircle size={13} className="text-amber-500" />,
  print_failed:       <AlertCircle size={13} className="text-red-500" />,
  segmentation_done:  <CheckCircle2 size={13} className="text-green-500" />,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.isRead).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listNotifications(30);
      setItems(data);
    } catch {
      // Notifications are non-critical; fail silently but stop loading state
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkAll = async () => {
    try {
      await markAllRead();
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
    } catch {
      // non-critical — user can retry
    }
  };

  const handleMarkOne = async (id: string) => {
    try {
      await markRead([id]);
      setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n));
    } catch {
      // non-critical — user can retry
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await dismissNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // non-critical — user can retry
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen((o) => !o); if (!open) load(); }}
        className="relative p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-80 bg-background border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell size={14} />
              <span className="text-sm font-semibold">Notifications</span>
              {unread > 0 && (
                <span className="text-xs bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">{unread} new</span>
              )}
            </div>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <CheckCheck size={12} /> All read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
                <Info size={20} />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={`group flex gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer transition-colors ${
                    n.isRead ? "bg-background" : "bg-primary/5"
                  } hover:bg-muted`}
                  onClick={() => !n.isRead && handleMarkOne(n.id)}
                >
                  <div className="mt-0.5 shrink-0">{TYPE_ICON[n.type] ?? <Info size={13} className="text-muted-foreground" />}</div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${n.isRead ? "text-foreground" : "font-medium text-foreground"}`}>{n.title}</p>
                    {n.body && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{relativeTime(n.createdAt)}</p>
                  </div>
                  <button
                    aria-label="Dismiss notification"
                    onClick={(e) => { e.stopPropagation(); handleDismiss(n.id); }}
                    className="text-muted-foreground hover:text-foreground transition-opacity shrink-0 mt-0.5 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-border">
              <button onClick={handleMarkAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                <Check size={12} /> Mark all as read
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
