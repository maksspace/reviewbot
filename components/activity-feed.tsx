"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"

type ReviewComment = {
  file: string
  line: number
  comment: string
}

type ReviewItem = {
  id: string
  prNumber: number
  title: string
  time: string
  commentCount: number
  hasIssues: boolean
  comments: ReviewComment[]
}

const MOCK_ACTIVITY: ReviewItem[] = [
  {
    id: "1",
    prNumber: 847,
    title: "Add account migration endpoint",
    time: "2h ago",
    commentCount: 2,
    hasIssues: true,
    comments: [
      {
        file: "src/modules/accounts/services/migration.service.ts",
        line: 42,
        comment:
          "This imports directly from policies/repository \u2014 violates your module boundary rule (ARCH-001). Use PoliciesService through DI instead.",
      },
      {
        file: "src/modules/accounts/controllers/migration.controller.ts",
        line: 18,
        comment:
          "Controller method is 34 lines. Your team prefers keeping these under 20. Consider extracting the validation logic to a separate method.",
      },
    ],
  },
  {
    id: "2",
    prNumber: 845,
    title: "Fix subscription renewal flow",
    time: "5h ago",
    commentCount: 0,
    hasIssues: false,
    comments: [],
  },
  {
    id: "3",
    prNumber: 841,
    title: "Refactor policies module",
    time: "1d ago",
    commentCount: 4,
    hasIssues: true,
    comments: [
      {
        file: "src/modules/policies/services/policies.service.ts",
        line: 88,
        comment:
          "This Kafka consumer doesn\u2019t check for duplicate processing keys. All event handlers should be idempotent per your team\u2019s hard rules.",
      },
      {
        file: "src/modules/policies/dto/update-policy.dto.ts",
        line: 12,
        comment:
          "Using manual validation here instead of class-validator decorators. Your team prefers @IsString(), @IsOptional() etc.",
      },
      {
        file: "src/modules/policies/repository/policies.repository.ts",
        line: 55,
        comment:
          "Returning raw query result instead of mapping to a domain entity. Repository methods should return typed entities.",
      },
      {
        file: "src/modules/policies/controllers/policies.controller.ts",
        line: 30,
        comment:
          "Missing integration test for this new endpoint. Your team requires integration tests for all new endpoints.",
      },
    ],
  },
  {
    id: "4",
    prNumber: 838,
    title: "Add correlation ID middleware",
    time: "2d ago",
    commentCount: 1,
    hasIssues: true,
    comments: [
      {
        file: "src/common/middleware/correlation.middleware.ts",
        line: 15,
        comment:
          "Consider using a centralized constants file for the header name instead of a magic string.",
      },
    ],
  },
  {
    id: "5",
    prNumber: 835,
    title: "Update user permissions schema",
    time: "3d ago",
    commentCount: 0,
    hasIssues: false,
    comments: [],
  },
]

export function ActivityFeed() {
  const [expanded, setExpanded] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id))
  }

  return (
    <div className="flex flex-col">
      {MOCK_ACTIVITY.map((item) => (
        <div key={item.id} className="border-b border-border">
          <button
            type="button"
            onClick={() => item.commentCount > 0 && toggleExpand(item.id)}
            className="flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-surface-hover"
            disabled={item.commentCount === 0}
          >
            {item.commentCount > 0 ? (
              expanded === item.id ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="w-3.5" />
            )}

            <span className="text-xs text-muted-foreground tabular-nums">
              PR #{item.prNumber}
            </span>

            <span className="flex-1 truncate text-sm text-foreground">
              {item.title}
            </span>

            <span className="text-xs text-muted-foreground">{item.time}</span>

            <span
              className={`text-xs tabular-nums ${
                item.hasIssues ? "text-terminal-warn" : "text-terminal"
              }`}
            >
              {item.hasIssues ? `\u26A0 ${item.commentCount}` : "\u2713 0"}{" "}
              <span className="text-muted-foreground">
                {item.commentCount === 1 ? "comment" : "comments"}
              </span>
            </span>
          </button>

          {/* Expanded comments */}
          {expanded === item.id && item.comments.length > 0 && (
            <div className="border-t border-border/50 bg-surface px-4 py-4">
              <div className="flex flex-col gap-4 pl-8">
                {item.comments.map((comment, i) => (
                  <div key={i} className="border-l-2 border-terminal/20 pl-4">
                    <div className="mb-1 text-[10px] text-muted-foreground">
                      {comment.file}:{comment.line}
                    </div>
                    <p className="text-xs leading-relaxed text-foreground/80">
                      {comment.comment}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
