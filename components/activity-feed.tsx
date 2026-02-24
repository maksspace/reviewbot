"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, ExternalLink } from "lucide-react"

// ---------------------------------------------------------------------------
// Types (matches reviews table shape)
// ---------------------------------------------------------------------------

interface ReviewCommentData {
  file: string
  line: number
  endLine?: number
  severity: "critical" | "warning" | "suggestion"
  category?: string
  rule?: string | null
  message: string
  suggestion?: string
}

export interface ReviewRecord {
  id: string
  pr_number: number
  pr_title: string | null
  pr_url: string | null
  pr_author: string | null
  verdict: string
  summary: string | null
  comment_count: number
  comments: ReviewCommentData[] | null
  created_at: string
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// ---------------------------------------------------------------------------
// Severity styling
// ---------------------------------------------------------------------------

const SEVERITY_CLASSES: Record<string, string> = {
  critical: "border-red-500/40 text-red-400",
  warning: "border-yellow-500/40 text-yellow-400",
  suggestion: "border-blue-500/40 text-blue-400",
}

// ---------------------------------------------------------------------------
// ActivityFeed component
// ---------------------------------------------------------------------------

export function ActivityFeed({ reviews }: { reviews: ReviewRecord[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id))
  }

  if (reviews.length === 0) {
    return (
      <div className="py-20 text-center text-xs text-muted-foreground">
        No reviews yet. Reviews will appear here after ReviewBot comments on a PR.
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {reviews.map((review) => {
        const comments = review.comments ?? []
        const hasComments = comments.length > 0
        const hasCritical = comments.some((c) => c.severity === "critical")
        const isApproved = review.verdict === "approve"

        return (
          <div key={review.id} className="border-b border-border">
            <button
              type="button"
              onClick={() => hasComments && toggleExpand(review.id)}
              className="flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-surface-hover"
              disabled={!hasComments}
            >
              {hasComments ? (
                expanded === review.id ? (
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="w-3.5" />
              )}

              <span className="text-xs text-muted-foreground tabular-nums">
                #{review.pr_number}
              </span>

              <span className="flex-1 truncate text-sm text-foreground">
                {review.pr_title ?? `PR #${review.pr_number}`}
              </span>

              {review.pr_url && (
                <a
                  href={review.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground/40 transition-colors hover:text-foreground"
                  aria-label="Open PR"
                >
                  <ExternalLink className="size-3" />
                </a>
              )}

              <span className="text-xs text-muted-foreground">
                {timeAgo(review.created_at)}
              </span>

              <span
                className={`text-xs tabular-nums ${
                  hasCritical
                    ? "text-red-400"
                    : !isApproved && hasComments
                      ? "text-terminal-warn"
                      : "text-terminal"
                }`}
              >
                {isApproved && !hasComments
                  ? "\u2713 approved"
                  : hasCritical
                    ? `\u2717 ${review.comment_count}`
                    : hasComments
                      ? `\u26A0 ${review.comment_count}`
                      : `\u2713 ${review.comment_count}`}{" "}
                {hasComments && (
                  <span className="text-muted-foreground">
                    {review.comment_count === 1 ? "comment" : "comments"}
                  </span>
                )}
              </span>
            </button>

            {/* Summary */}
            {expanded === review.id && review.summary && (
              <div className="border-t border-border/50 bg-surface px-4 py-3">
                <p className="pl-8 text-xs leading-relaxed text-muted-foreground">
                  {review.summary}
                </p>
              </div>
            )}

            {/* Expanded comments */}
            {expanded === review.id && hasComments && (
              <div className="border-t border-border/30 bg-surface px-4 py-4">
                <div className="flex flex-col gap-4 pl-8">
                  {comments.map((comment, i) => (
                    <div
                      key={i}
                      className={`border-l-2 pl-4 ${
                        SEVERITY_CLASSES[comment.severity] ?? "border-border text-foreground"
                      }`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[10px] uppercase tracking-wider opacity-70">
                          {comment.severity}
                        </span>
                        {comment.rule && (
                          <span className="text-[10px] text-muted-foreground">
                            ({comment.rule})
                          </span>
                        )}
                      </div>
                      <div className="mb-1 text-[10px] text-muted-foreground">
                        {comment.file}:{comment.line}
                        {comment.endLine && comment.endLine > comment.line
                          ? `-${comment.endLine}`
                          : ""}
                      </div>
                      <p className="text-xs leading-relaxed text-foreground/80">
                        {comment.message}
                      </p>
                      {comment.suggestion && (
                        <pre className="mt-2 overflow-x-auto border border-border/50 bg-background p-2 text-[11px] text-foreground/60">
                          <code>{comment.suggestion}</code>
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
