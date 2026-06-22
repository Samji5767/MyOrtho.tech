"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Box,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Factory,
  FileText,
  MessageSquarePlus,
  Plus,
  Printer,
  ScanLine,
  Search,
  Send,
  Sparkles,
  UploadCloud,
  X,
  type LucideIcon,
} from "lucide-react";
import { LiveDot, ProgressBar, StatusBadge } from "@/components/DesignSystem";
import { ClinicalEmptyState } from "@/components/ClinicalEmptyState";
import { isDemoMode } from "@/lib/appMode";
import {
  MOCK_THREADS,
  getThreadEvents,
  statusLabel,
  statusTone,
  type FilterKey,
  type PatientThread,
  type TimelineEvent,
  type TimelineEventType,
  type WorkflowSection,
} from "@/types/clinical";

// ─── Runtime thread source — empty in production, MOCK_THREADS in demo mode ──

function useClinicalThreads(): PatientThread[] {
  return useMemo(() => (isDemoMode() ? MOCK_THREADS : []), []);
}

// ─── Filter config ────────────────────────────────────────────────────────────

type FilterSpec = { key: FilterKey; label: string; count: number };

function buildFilters(threads: PatientThread[]): FilterSpec[] {
  return [
    { key: 'all',           label: 'All',          count: threads.length },
    { key: 'urgent',        label: 'Urgent',       count: threads.filter(t => t.priority === 'urgent' || t.slaRisk).length },
    { key: 'approval',      label: 'Approval',     count: threads.filter(t => t.status === 'pending_approval').length },
    { key: 'manufacturing', label: 'Manufacturing', count: threads.filter(t => t.status === 'manufacturing').length },
    { key: 'completed',     label: 'Done',         count: threads.filter(t => t.status === 'shipping' || t.status === 'completed').length },
  ];
}

// ─── Compact status pill colours ──────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  primary: 'bg-[color:var(--primary-glow)] text-[color:var(--primary)]',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  danger:  'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  info:    'bg-sky-500/10 text-sky-700 dark:text-sky-400',
  neutral: 'bg-slate-500/10 text-slate-600 dark:text-slate-400',
};

// ─── Thread row — WhatsApp density (72–80 px per row) ────────────────────────

function ThreadRow({ thread, onOpen }: { thread: PatientThread; onOpen: () => void }) {
  const tone = statusTone(thread.status);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 active:bg-[color-mix(in_srgb,var(--primary-glow)_70%,transparent)]"
    >
      {/* Avatar — 48 px circle */}
      <div className="relative shrink-0">
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold text-white ${thread.accentClass}`}
        >
          {thread.initials}
        </span>
        {(thread.priority === 'urgent' || thread.slaRisk) && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--background)] bg-rose-500" />
        )}
        {thread.priority === 'high' && !thread.slaRisk && (
          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[color:var(--background)] bg-amber-500" />
        )}
      </div>

      {/* Text content */}
      <div className="min-w-0 flex-1">
        {/* Row 1: patient name + timestamp — explicit padding-left on time prevents merge */}
        <div className="flex items-baseline">
          <span
            className={`thread-row-name text-[17px] leading-snug ${
              thread.unread > 0 ? 'font-bold' : 'font-semibold'
            } text-[color:var(--foreground)]`}
          >
            {thread.patientName}
          </span>
          <span className="thread-row-time text-[12px] text-[color:var(--muted-foreground)]">
            {thread.lastActivity}
          </span>
        </div>

        {/* Row 2: status pill + preview + unread badge */}
        <div className="mt-[3px] flex items-center gap-1.5">
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${STATUS_PILL[tone]}`}
          >
            {statusLabel(thread.status)}
          </span>
          <p
            className={`min-w-0 flex-1 truncate text-[13px] leading-snug ${
              thread.unread > 0
                ? 'font-medium text-[color:var(--foreground)]'
                : 'text-[color:var(--muted-foreground)]'
            }`}
          >
            {thread.lastMessage}
          </p>
          {thread.unread > 0 && (
            <span className="ml-1 flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)] px-1 text-[10px] font-bold leading-none text-white">
              {thread.unread > 9 ? '9+' : thread.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Timeline event card ──────────────────────────────────────────────────────

const EVENT_ICON: Record<TimelineEventType, LucideIcon> = {
  system:               ClipboardList,
  scan_uploaded:        UploadCloud,
  segmentation_done:    Sparkles,
  plan_ready:           FileText,
  approval_pending:     AlertTriangle,
  approval_given:       CheckCircle2,
  cad_review:           Box,
  cad_approved:         CheckCircle2,
  manufacturing_started: Printer,
  qc_passed:            CheckCircle2,
  shipped:              Send,
  note:                 MessageSquarePlus,
};

const EVENT_ACCENT: Record<TimelineEventType, string> = {
  system:               'bg-slate-500/10 text-slate-500',
  scan_uploaded:        'bg-blue-500/10 text-blue-500',
  segmentation_done:    'bg-violet-500/10 text-violet-500',
  plan_ready:           'bg-teal-500/10 text-teal-600',
  approval_pending:     'bg-amber-500/10 text-amber-600',
  approval_given:       'bg-emerald-500/10 text-emerald-600',
  cad_review:           'bg-indigo-500/10 text-indigo-500',
  cad_approved:         'bg-emerald-500/10 text-emerald-600',
  manufacturing_started: 'bg-[color:var(--primary-glow)] text-[color:var(--primary)]',
  qc_passed:            'bg-emerald-500/10 text-emerald-600',
  shipped:              'bg-sky-500/10 text-sky-500',
  note:                 'bg-slate-500/10 text-slate-500',
};

function TimelineCard({ event }: { event: TimelineEvent }) {
  const Icon   = EVENT_ICON[event.type] ?? ClipboardList;
  const accent = EVENT_ACCENT[event.type] ?? EVENT_ACCENT.system;
  const isSystem = event.type === 'system';

  if (isSystem) {
    return (
      <div className="flex items-center gap-2 px-4 py-2">
        <div className="h-px flex-1 bg-[color:var(--border)]" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted-foreground)]">
          {event.title} · {event.timestamp}
        </span>
        <div className="h-px flex-1 bg-[color:var(--border)]" />
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <div className="ios-card px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-2xl ${accent}`}>
            <Icon size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{event.title}</p>
              <span className="shrink-0 text-[11px] text-[color:var(--muted-foreground)]">{event.timestamp}</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--muted-foreground)]">{event.body}</p>
            {event.metadata && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(event.metadata).map(([k, v]) => (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 rounded-md border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--muted-foreground)]"
                  >
                    <span className="font-semibold text-[color:var(--foreground)]">{k}:</span> {v}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-1.5 text-[10px] text-[color:var(--muted-foreground)]">{event.actor}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Composer bar ─────────────────────────────────────────────────────────────

type ComposerAction = { label: string; icon: LucideIcon; href: string; tone: string };

const COMPOSER_ACTIONS: ComposerAction[] = [
  { label: 'Upload Scan',  icon: UploadCloud,       href: '/ai-analysis',    tone: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  { label: 'Add Note',     icon: MessageSquarePlus,  href: '#',              tone: 'bg-slate-500/10 text-slate-600 dark:text-slate-300' },
  { label: 'Approval',     icon: CheckCircle2,       href: '/treatment-plan', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  { label: 'CAD Review',   icon: Box,                href: '/desktop',        tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' },
  { label: 'Mfg Update',   icon: Factory,            href: '/manufacturing',  tone: 'bg-[color:var(--primary-glow)] text-[color:var(--primary)]' },
];

function ComposerBar() {
  return (
    <div
      className="case-room-composer lgt-glass flex items-center gap-2 px-3 py-2"
      style={{ paddingBottom: `calc(0.5rem + var(--sa-bottom, 0px))` }}
    >
      <div className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto">
        {COMPOSER_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-2xl border border-[color:var(--border)] px-3 py-2 text-xs font-semibold transition-transform active:scale-95 ${action.tone}`}
            >
              <Icon size={13} />
              {action.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Workflow section tabs ────────────────────────────────────────────────────

const WORKFLOW_SECTIONS: WorkflowSection[] = ['Overview', 'Scan', 'Segment', 'CAD', 'Plan', 'Mfg', 'Notes'];

function WorkflowTabs({ active, onChange }: { active: WorkflowSection; onChange: (s: WorkflowSection) => void }) {
  return (
    <div className="no-scrollbar flex items-center gap-1 overflow-x-auto px-4 py-2">
      {WORKFLOW_SECTIONS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
            active === s
              ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
              : 'border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

// ─── Case Room ────────────────────────────────────────────────────────────────

function CaseRoom({ thread, onBack }: { thread: PatientThread; onBack: () => void }) {
  const [section, setSection] = useState<WorkflowSection>('Overview');
  const events = getThreadEvents(thread.id);

  return (
    <div className="animate-page-enter flex min-h-dvh flex-col">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)] backdrop-blur-xl">
        <div style={{ height: 'env(safe-area-inset-top, 0px)' }} />

        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="touch-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)] shadow-[var(--shadow-sm)] transition-transform active:scale-90"
            aria-label="Back to Clinical Inbox"
          >
            <ChevronRight size={18} className="rotate-180" />
          </button>

          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm ${thread.accentClass}`}
          >
            {thread.initials}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[color:var(--foreground)]">{thread.patientName}</p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[color:var(--muted-foreground)]">{thread.caseId}</span>
              <StatusBadge tone={statusTone(thread.status)}>{statusLabel(thread.status)}</StatusBadge>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {thread.slaRisk && <LiveDot tone="danger" />}
            <Link
              href="/ai-analysis"
              className="touch-target flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--primary)] shadow-[var(--shadow-sm)] transition-transform active:scale-90"
              aria-label="Open in scan workspace"
            >
              <ScanLine size={16} />
            </Link>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2">
            <ProgressBar
              value={thread.progress}
              tone={thread.progress >= 80 ? 'success' : thread.progress >= 50 ? 'primary' : 'warning'}
            />
            <span className="w-9 shrink-0 text-right text-[11px] font-semibold text-[color:var(--muted-foreground)]">
              {thread.progress}%
            </span>
          </div>
        </div>

        <WorkflowTabs active={section} onChange={setSection} />
      </div>

      {/* Case activity timeline */}
      <div className="flex-1 space-y-1 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+4.5rem)] pt-3">
        {events.map((event) => (
          <TimelineCard key={event.id} event={event} />
        ))}

        <div className="px-4 py-4">
          <Link
            href="/ai-analysis"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] transition-transform active:scale-95"
          >
            Open full scan workspace
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      {/* Fixed composer bar above tab bar */}
      <div
        className="fixed left-0 right-0 z-40"
        style={{ bottom: `calc(var(--tab-bar-height) + var(--sa-bottom, 0px))` }}
      >
        <ComposerBar />
      </div>
    </div>
  );
}

// ─── Inbox list ───────────────────────────────────────────────────────────────

function InboxList({ onOpenThread }: { onOpenThread: (id: string) => void }) {
  const threads     = useClinicalThreads();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const filters = useMemo(() => buildFilters(threads), [threads]);

  const filtered = useMemo(() => {
    let result = threads;
    if (filter === 'urgent')        result = result.filter(t => t.priority === 'urgent' || t.slaRisk);
    if (filter === 'approval')      result = result.filter(t => t.status === 'pending_approval');
    if (filter === 'manufacturing') result = result.filter(t => t.status === 'manufacturing');
    if (filter === 'completed')     result = result.filter(t => t.status === 'shipping' || t.status === 'completed');
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        t.patientName.toLowerCase().includes(q) ||
        t.caseId.toLowerCase().includes(q)
      );
    }
    return result;
  }, [threads, filter, search]);

  const totalUnread = useMemo(
    () => threads.reduce((n, t) => n + t.unread, 0),
    [threads]
  );

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ── Sticky header ── */}
      <div className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--background)_92%,transparent)] backdrop-blur-xl">
        <div style={{ height: 'env(safe-area-inset-top, 0px)' }} />

        {/* Title row */}
        <div className="flex h-[52px] items-center gap-3 px-4">
          <img
            src="/app-icon.png"
            alt="MyOrtho"
            style={{ width: 36, height: 36, borderRadius: 14, objectFit: 'cover', flexShrink: 0 }}
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />

          <h1 className="flex-1 text-[26px] font-bold tracking-tight text-[color:var(--foreground)]">
            Clinical Inbox
          </h1>

          <button
            type="button"
            aria-label="Notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)] active:scale-90"
          >
            <Bell size={21} strokeWidth={1.8} />
            {totalUnread > 0 && (
              <span
                aria-hidden
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--danger)] px-0.5 text-[9px] font-black leading-none text-white"
              >
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </button>
        </div>

        {/* Search bar — min font-size 16px prevents iOS auto-zoom */}
        <div className="px-4 pb-2">
          <div className="flex h-11 items-center gap-2.5 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 shadow-[var(--shadow-sm)]">
            <Search size={15} className="shrink-0 text-[color:var(--muted-foreground)]" />
            <input
              type="search"
              placeholder="Search patients, cases, scans, notes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="inbox-search-input min-w-0 flex-1 bg-transparent text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] outline-none"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="shrink-0 text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Filter chips — label (count) format, never merged */}
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-4 pb-3">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 active:scale-95 ${
                filter === f.key
                  ? 'bg-[color:var(--primary)] text-[color:var(--primary-foreground)]'
                  : 'border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]'
              }`}
            >
              {f.label}
              <span
                className={`filter-chip-count text-[11px] font-bold tabular-nums ${
                  filter === f.key ? 'opacity-75' : 'text-[color:var(--muted-foreground)]'
                }`}
              >
                ({f.count})
              </span>
            </button>
          ))}
        </div>

        <div className="h-px bg-[color:var(--border)]" />
      </div>

      {/* Thread list or empty state */}
      <div
        className="flex-1 divide-y divide-[color:var(--border)] pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+5rem)]"
      >
        {threads.length === 0 ? (
          /* Production mode — no backend connected yet */
          <ClinicalEmptyState
            icon={ClipboardList}
            title="No clinical cases yet"
            message="Upload an STL, PLY, or OBJ scan to create the first orthodontic case."
            primaryAction={{ label: "Upload Scan", href: "/studio" }}
            secondaryAction={{ label: "Create Patient", href: "/patients" }}
          />
        ) : filtered.length === 0 ? (
          /* Has threads but search/filter returned nothing */
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <CheckCircle2 size={28} className="text-emerald-500" />
            <p className="text-base font-semibold text-[color:var(--foreground)]">
              {search ? 'No results' : 'All clear'}
            </p>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {search ? `No cases match "${search}"` : 'No cases in this filter.'}
            </p>
          </div>
        ) : (
          filtered.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              onOpen={() => onOpenThread(thread.id)}
            />
          ))
        )}
      </div>

      {/* New Case FAB */}
      <Link
        href="/cases"
        aria-label="New case"
        className="fixed z-30 flex items-center gap-2 rounded-full bg-[color:var(--primary)] px-5 py-3.5 text-sm font-bold text-[color:var(--primary-foreground)] shadow-[var(--shadow-lg)] transition-transform active:scale-95"
        style={{
          bottom: `calc(var(--tab-bar-height) + var(--sa-bottom, 0px) + 16px)`,
          right: '16px',
        }}
      >
        <Plus size={18} strokeWidth={2.5} />
        New Case
      </Link>
    </div>
  );
}

// ─── Root page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const threads = useClinicalThreads();
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  const activeThread = useMemo(
    () => threads.find(t => t.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );

  const openRoom  = useCallback((id: string) => setActiveThreadId(id), []);
  const closeRoom = useCallback(() => setActiveThreadId(null), []);

  if (activeThread) {
    return <CaseRoom thread={activeThread} onBack={closeRoom} />;
  }

  return <InboxList onOpenThread={openRoom} />;
}
