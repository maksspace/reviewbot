"use client"

import { useState } from "react"

const PERSONA_DOCUMENT = `# Review Persona: acme/backend-api

## Hard Rules (all members agree) — 5 rules

1. **No direct cross-module repository imports.** All inter-module communication
   must go through dependency injection. This is non-negotiable — the team is
   preparing for microservice extraction.

2. **Every MR must link to a Jira ticket.** No exceptions. If it's a hotfix,
   create the ticket first.

3. **Max 400 lines per MR.** Anything larger must be split. The reviewer should
   flag this immediately.

4. **All Kafka event handlers must be idempotent.** Check for duplicate
   processing keys in every consumer.

5. **Database migrations must be backward-compatible.** No column drops or
   renames without a two-phase rollout.

## Standard Rules (majority agrees) — 12 rules

1. Prefer \`class-validator\` decorators over manual validation
2. Use DTOs for all controller inputs — no raw body access
3. Repository methods should return domain entities, not raw query results
4. Keep controller methods under 20 lines
5. Avoid nested ternaries in business logic
6. All new endpoints need integration tests
7. Error messages should be user-facing friendly, not technical
8. Use enum types instead of string literals for status fields
9. Prefer named exports over default exports
10. Keep Kafka topic names in a centralized constants file
11. Logger calls should include correlation IDs
12. Use transactions for multi-table writes

## Not Enforced (split opinion) — 3 items

1. Whether to enforce strict null checks in TypeScript config
2. Comment requirements on complex functions (some prefer self-documenting code)
3. Whether HTTP status codes should be in controller or service layer`

const CONSENSUS_DATA = [
  { label: "Hard Rules (all members agree)", count: 5, color: "text-terminal" },
  {
    label: "Standard Rules (majority agrees)",
    count: 12,
    color: "text-foreground",
  },
  {
    label: "Not Enforced (split opinion)",
    count: 3,
    color: "text-muted-foreground",
  },
]

export function PersonaViewer() {
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(PERSONA_DOCUMENT)

  return (
    <div className="flex flex-col gap-6">
      {/* Consensus summary */}
      <div className="border border-border p-6">
        <h3 className="mb-4 text-xs tracking-[0.2em] uppercase text-muted-foreground">
          Consensus Data
        </h3>
        <div className="flex flex-col gap-3">
          {CONSENSUS_DATA.map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className={`text-xs ${item.color}`}>{item.label}</span>
              <span className={`text-sm font-bold tabular-nums ${item.color}`}>
                {item.count} {item.count === 1 ? "rule" : "rules"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="border border-border px-4 py-2 text-xs tracking-wider uppercase text-foreground transition-colors hover:border-foreground"
        >
          {editing ? "Save" : "Edit"}
        </button>
        <button
          type="button"
          className="border border-border px-4 py-2 text-xs tracking-wider uppercase text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          Re-interview
        </button>
      </div>

      {/* Document */}
      {editing ? (
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[600px] w-full border border-border bg-background p-6 text-sm leading-7 text-foreground focus:outline-none focus:ring-1 focus:ring-terminal"
        />
      ) : (
        <div className="border border-border p-6">
          <pre className="whitespace-pre-wrap text-sm leading-7 text-foreground">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}
