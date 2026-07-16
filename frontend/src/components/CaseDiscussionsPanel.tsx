"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle2, MessageCircle, RefreshCw, Send, Trash2, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ToastContext";
import {
  fetchCaseDiscussions,
  createDiscussion,
  resolveDiscussion,
  deleteDiscussion,
  type DiscussionComment,
} from "@/lib/api/discussions";
import { Card } from "@/components/DesignSystem";

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = diff / 3600000;
  if (h < 1) return "just now";
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function authorInitials(comment: DiscussionComment): string {
  const name = comment.authorName ?? comment.authorEmail ?? "?";
  return name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
}

interface ThreadProps {
  root: DiscussionComment;
  replies: DiscussionComment[];
  currentUserId?: string;
  caseId: string;
  onResolve: (id: string, resolved: boolean) => void;
  onDelete: (id: string) => void;
  onReply: (parentId: string, content: string) => Promise<void>;
}

function DiscussionThread({ root, replies, currentUserId, caseId, onResolve, onDelete, onReply }: ThreadProps) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleReply() {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(root.id, replyText.trim());
      setReplyText("");
      setShowReply(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`rounded-xl border ${root.resolved ? 'border-emerald-200/60 bg-emerald-50/30 dark:border-emerald-500/20 dark:bg-emerald-500/5' : 'border-[color:var(--border)] bg-[color:var(--card)]'} overflow-hidden`}>
      {/* Root comment */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary-glow)] text-xs font-bold text-[color:var(--primary)]">
          {authorInitials(root)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[color:var(--foreground)]">
              {root.authorName ?? root.authorEmail ?? "Unknown"}
            </span>
            <span className="text-[10px] text-[color:var(--muted-foreground)]">{relTime(root.createdAt)}</span>
            {root.resolved && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={9} /> Resolved
              </span>
            )}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-[color:var(--foreground)]">{root.content}</p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowReply(!showReply)}
              className="text-[10px] font-medium text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
            >
              Reply
            </button>
            <button
              type="button"
              onClick={() => onResolve(root.id, !root.resolved)}
              className="text-[10px] font-medium text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] transition-colors"
            >
              {root.resolved ? "Reopen" : "Resolve"}
            </button>
            {currentUserId === root.authorId && (
              <button
                type="button"
                onClick={() => onDelete(root.id)}
                className="text-[10px] font-medium text-rose-500 hover:text-rose-700 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="border-t border-[color:var(--border)]/50 bg-[color:var(--muted)]/20">
          {replies.map((reply) => (
            <div key={reply.id} className="flex items-start gap-3 border-b border-[color:var(--border)]/30 px-4 py-2.5 last:border-b-0">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-500/10 text-[9px] font-bold text-slate-600 dark:text-slate-400">
                {authorInitials(reply)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-[color:var(--foreground)]">
                    {reply.authorName ?? reply.authorEmail ?? "Unknown"}
                  </span>
                  <span className="text-[9px] text-[color:var(--muted-foreground)]">{relTime(reply.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-[color:var(--foreground)]">{reply.content}</p>
              </div>
              {currentUserId === reply.authorId && (
                <button
                  type="button"
                  onClick={() => onDelete(reply.id)}
                  className="shrink-0 text-rose-400 hover:text-rose-600 transition-colors"
                  aria-label="Delete reply"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {showReply && (
        <div className="border-t border-[color:var(--border)]/50 px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply…"
              rows={2}
              className="flex-1 resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleReply()}
              disabled={!replyText.trim() || submitting}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--primary)] text-white disabled:opacity-40 hover:opacity-90"
              aria-label="Send reply"
            >
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function CaseDiscussionsPanel({ caseId }: { caseId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = useState<DiscussionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCaseDiscussions(caseId);
      setComments(data);
    } catch {
      // non-fatal
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  async function handleCreate() {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const comment = await createDiscussion(caseId, { content: newComment.trim() });
      setComments((prev) => [comment, ...prev]);
      setNewComment("");
    } catch {
      toast({ title: "Failed to post comment", type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResolve(id: string, resolved: boolean) {
    try {
      const updated = await resolveDiscussion(caseId, id, resolved);
      setComments((prev) => prev.map((c) => c.id === id ? updated : c));
    } catch {
      toast({ title: "Failed to update discussion", type: "error" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDiscussion(caseId, id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast({ title: "Failed to delete comment", type: "error" });
    }
  }

  async function handleReply(parentId: string, content: string) {
    const reply = await createDiscussion(caseId, { content, parentId });
    setComments((prev) => [...prev, reply]);
  }

  const roots = comments.filter((c) => !c.parentId);
  const repliesByParent = (id: string) => comments.filter((c) => c.parentId === id);

  return (
    <div className="flex flex-col gap-4">
      {/* New comment */}
      <Card className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--muted-foreground)]">
          Add Comment
        </p>
        <div className="flex items-end gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share an observation, ask a question, or flag something for the team…"
            rows={3}
            className="flex-1 resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--muted-foreground)] focus:border-[color:var(--primary)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={!newComment.trim() || submitting}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--primary)] text-white disabled:opacity-40 hover:opacity-90 transition-opacity"
            aria-label="Post comment"
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
          </button>
        </div>
      </Card>

      {/* Discussion threads */}
      {loading ? (
        <div className="space-y-3">
          {[0,1,2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-[color:var(--border)]/40" />
          ))}
        </div>
      ) : roots.length === 0 ? (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-[color:var(--border)] py-10 text-[color:var(--muted-foreground)]">
          <MessageCircle size={18} />
          <span className="text-sm">No discussions yet. Start the conversation above.</span>
        </div>
      ) : (
        <div className="space-y-3">
          {roots.map((root) => (
            <DiscussionThread
              key={root.id}
              root={root}
              replies={repliesByParent(root.id)}
              currentUserId={user?.id}
              caseId={caseId}
              onResolve={handleResolve}
              onDelete={handleDelete}
              onReply={handleReply}
            />
          ))}
        </div>
      )}
    </div>
  );
}
