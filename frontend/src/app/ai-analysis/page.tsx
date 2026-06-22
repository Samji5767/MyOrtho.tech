"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronRight,
  FlaskConical,
  Fullscreen,
  MessagesSquare,
  ScanSearch,
  SendHorizontal,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import NativeSheet from "@/components/NativeSheet";
import { Button, Card, LiveDot, SectionDivider, StatusBadge } from "@/components/DesignSystem";

const Viewer3D = dynamic(() => import("@/components/Viewer3D"), {
  ssr: false,
  loading: () => <div className="h-[360px] animate-skeleton rounded-[1.2rem]" />,
});

const workspacePanels = [
  { title: "Patient details", body: "Contact info, treatment stage, and clinician notes stay grouped for fast phone review.", icon: Stethoscope },
  { title: "Scans and photos", body: "Open scan uploads, capture reference photos, and inspect files with touch-first controls.", icon: ScanSearch },
  { title: "Approvals", body: "Quick approve or request revision without leaving the case lane.", icon: CheckCircle2 },
  { title: "Manufacturing", body: "Monitor print release, job status, and SLA alerts in the same screen.", icon: FlaskConical },
];

// AI copilot is ready but requires a real scan or case to generate clinical insights
const INITIAL_AI_MESSAGE = "AI Copilot is ready. Upload a scan or open a real case to generate clinical decision-support insights.";

export default function AiAnalysisPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [fullscreenHint, setFullscreenHint] = useState("Viewer ready");
  const [aiQuery, setAiQuery] = useState("");
  const [aiConversation, setAiConversation] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: INITIAL_AI_MESSAGE },
  ]);
  const aiInputRef = useRef<HTMLInputElement>(null);

  function sendAiMessage() {
    const text = aiQuery.trim();
    if (!text) return;
    setAiConversation((prev) => [
      ...prev,
      { role: "user", text },
      {
        role: "ai",
        text: `No scan or case is currently loaded. Upload an STL, PLY, or OBJ scan file to enable AI analysis for this case.`,
      },
    ]);
    setAiQuery("");
    setTimeout(() => aiInputRef.current?.focus(), 100);
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-[calc(var(--tab-bar-height)+var(--sa-bottom)+1.5rem)] pt-4 sm:px-5 lg:px-8 lg:pb-10">
      {/* Hero */}
      <Card className="ios-card p-5 sm:p-6">
        <div className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Case workspace</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">
                Mobile 3D review
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted-foreground)]">
                A touch-first case lane for patient details, scan review, approvals, and manufacturing status.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <LiveDot tone="success" />
                <StatusBadge tone="success">Touch ready</StatusBadge>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-sm font-semibold text-[color:var(--foreground)] shadow-[var(--shadow-sm)] transition-transform duration-200 active:scale-95"
            >
              <Sparkles size={16} className="text-[color:var(--primary)]" />
              Case actions
            </button>
            <Link
              href="/patients"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-sm font-semibold text-[color:var(--foreground)] shadow-[var(--shadow-sm)] transition-transform duration-200 active:scale-95"
            >
              <MessagesSquare size={16} className="text-[color:var(--primary)]" />
              Patient view
            </Link>
            <button
              type="button"
              onClick={() => setFullscreenHint("Open the viewer card and use the fullscreen control on the toolbar")}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[color:var(--primary)] px-4 text-sm font-semibold text-[color:var(--primary-foreground)] shadow-[var(--shadow-sm)] transition-transform duration-200 active:scale-95"
            >
              <Fullscreen size={16} />
              Fullscreen tip
            </button>
          </div>
        </div>
      </Card>

      {/* Stats — shown as placeholders until backend is connected */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Open approvals", value: "—", helper: "No data", tone: "primary" as const },
          { label: "Active scans", value: "—", helper: "No data", tone: "info" as const },
          { label: "AI notes", value: "—", helper: "No data", tone: "success" as const },
          { label: "SLA alerts", value: "—", helper: "No data", tone: "warning" as const },
        ].map((item) => (
          <div key={item.label} className="ios-card p-4">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">{item.value}</p>
            <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">{item.helper}</p>
          </div>
        ))}
      </div>

      {/* 3D Viewer + Case panels */}
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">3D viewer</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                Touch-first model controls
              </h2>
              <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                Pinch to zoom, pan with two fingers, and use the floating actions for measurement and clipping.
              </p>
            </div>
            <div className="grid gap-2 text-right">
              <StatusBadge tone="primary">Orbit</StatusBadge>
              <StatusBadge tone="neutral">No scan loaded</StatusBadge>
            </div>
          </div>

          <Viewer3D />

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-sm font-semibold text-[color:var(--foreground)] transition-transform duration-200 active:scale-95"
            >
              <Camera size={16} className="text-[color:var(--primary)]" />
              Capture
            </button>
            <button
              type="button"
              onClick={() => setFullscreenHint("Tap the fullscreen control inside the viewer for immersive review")}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-sm font-semibold text-[color:var(--foreground)] transition-transform duration-200 active:scale-95"
            >
              <Fullscreen size={16} className="text-[color:var(--primary)]" />
              Fullscreen
            </button>
          </div>

          <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">{fullscreenHint}</p>
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Case panels</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                  Collapsible sections
                </h2>
              </div>
              <ShieldCheck size={18} className="text-[color:var(--primary)]" />
            </div>

            <div className="mt-4 space-y-2">
              {workspacePanels.map((panel) => {
                const Icon = panel.icon;
                return (
                  <details key={panel.title} className="ios-chip group px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[color:var(--foreground)]">
                      <span className="flex items-center gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
                          <Icon size={16} />
                        </span>
                        {panel.title}
                      </span>
                      <ChevronRight size={16} className="transition group-open:rotate-90" />
                    </summary>
                    <p className="mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">{panel.body}</p>
                  </details>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Notes</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                  Review guidance
                </h2>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {[
                "Use the viewer to isolate arches and measure contact points.",
                "Keep approvals and comments within the same mobile lane.",
                "Manufacturing changes should stay visible to the doctor and lab.",
              ].map((note) => (
                <div key={note} className="ios-chip px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]">
                  {note}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* AI ASSISTANT PANEL */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">AI assistant</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
              AI Copilot ready
            </h2>
            <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
              AI surfaces findings and risks. Clinical decisions always belong to you.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LiveDot tone="success" />
            <Sparkles size={18} className="text-[color:var(--primary)]" />
          </div>
        </div>

        {/* Empty state — no scan loaded */}
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_80%,transparent)] px-6 py-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-3xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
            <UploadCloud size={24} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[color:var(--foreground)]">No case loaded</p>
            <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
              Upload a scan or open a real case to generate clinical decision-support insights.
            </p>
          </div>
          <Link
            href="/studio"
            className="inline-flex h-9 items-center gap-2 rounded-full bg-[color:var(--primary)] px-4 text-xs font-semibold text-[color:var(--primary-foreground)] transition-transform active:scale-95"
          >
            <UploadCloud size={13} />
            Upload scan
          </Link>
        </div>

        <SectionDivider label="Ask the AI" className="my-4" />

        {/* Conversation */}
        <div className="space-y-2">
          {aiConversation.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                  msg.role === "user"
                    ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]"
                    : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]"
                }`}
              >
                {msg.role === "ai" && (
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--primary)]">
                    AI · MyOrtho
                  </p>
                )}
                {msg.text}
              </div>
            </div>
          ))}
        </div>

        {/* AI input */}
        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_88%,transparent)] px-4 py-2">
          <input
            ref={aiInputRef}
            type="text"
            placeholder="Ask about this case…"
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendAiMessage(); }}
            className="flex-1 bg-transparent text-sm text-[color:var(--foreground)] outline-none placeholder:text-[color:var(--muted-foreground)]"
          />
          <button
            type="button"
            onClick={sendAiMessage}
            disabled={!aiQuery.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[color:var(--primary)] text-[color:var(--primary-foreground)] transition-transform duration-150 active:scale-95 disabled:opacity-40"
          >
            <SendHorizontal size={15} />
          </button>
        </div>

        {/* Disclaimer */}
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <p className="text-[10px] leading-5 text-[color:var(--foreground)]">
            <strong>Medical disclaimer:</strong> AI output is clinical decision support only and must be reviewed by a licensed dental professional.
            AI-generated segmentation, treatment recommendations, and movement predictions are advisory only.
            Final diagnosis, treatment planning, and patient care remain the sole responsibility of the licensed orthodontist.
          </p>
        </div>
      </Card>

      {/* Approvals */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Approvals</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                Fast approval lane
              </h2>
            </div>
            <CheckCircle2 size={18} className="text-[color:var(--primary)]" />
          </div>

          <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={24} className="text-[color:var(--muted-foreground)]" />
            <p className="text-sm text-[color:var(--muted-foreground)]">
              No cases pending approval.
            </p>
          </div>

          <div className="mt-2 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => setSheetOpen(true)}>
              Approve
            </Button>
            <Button variant="secondary" className="flex-1">
              Request changes
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--primary)]">Manufacturing</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--foreground)]">
                Release status
              </h2>
            </div>
            <FlaskConical size={18} className="text-[color:var(--primary)]" />
          </div>

          <div className="mt-4 flex flex-col items-center gap-3 py-6 text-center">
            <FlaskConical size={24} className="text-[color:var(--muted-foreground)]" />
            <p className="text-sm text-[color:var(--muted-foreground)]">
              No manufacturing jobs queued.
            </p>
          </div>

          <div className="mt-2 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => setSheetOpen(true)}>
              Send to lab
            </Button>
            <Link
              href="/settings"
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-4 text-sm font-semibold text-[color:var(--foreground)] transition-transform duration-200 active:scale-95"
            >
              Settings
              <ArrowRight size={16} />
            </Link>
          </div>
        </Card>
      </div>

      {/* Floating bottom bar */}
      <div className="fixed inset-x-0 bottom-4 z-30 mx-auto w-[min(92vw,32rem)] lg:hidden">
        <div className="flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_88%,transparent)] p-2 shadow-[var(--shadow-lg)] backdrop-blur-xl">
          <Link
            href="/patients"
            className="flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-3 text-sm font-semibold text-[color:var(--foreground)] transition-transform duration-200 active:scale-95"
          >
            <MessagesSquare size={16} className="text-[color:var(--primary)]" />
            Patient
          </Link>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex-1 rounded-full bg-[color:var(--primary)] px-4 py-3 text-sm font-semibold text-[color:var(--primary-foreground)] transition-transform duration-200 active:scale-95"
          >
            Actions
          </button>
        </div>
      </div>

      <NativeSheet isOpen={sheetOpen} title="Case actions" onClose={() => setSheetOpen(false)}>
        <div className="space-y-3">
          <WorkspaceAction icon={CheckCircle2} title="Quick approve" body="Approve the treatment plan and notify the lab." />
          <WorkspaceAction icon={Camera} title="Open scan tools" body="Capture, import, or inspect clinical images." />
          <WorkspaceAction icon={MessagesSquare} title="Message the patient" body="Send a quick update or ask for new progress photos." />
          <WorkspaceAction icon={Sparkles} title="Run AI analysis" body="Re-analyze the scan with the latest AI model." />
        </div>
      </NativeSheet>
    </section>
  );
}

function WorkspaceAction({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="ios-chip flex items-start gap-3 px-4 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[color:var(--primary-glow)] text-[color:var(--primary)]">
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">{body}</p>
      </div>
    </div>
  );
}
