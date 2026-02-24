"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"

const FALLBACK_PERSONA = `No review persona generated yet. Complete the interview to generate one.`

function parseConsensusData(personaText: string) {
  const data: { label: string; count: number; color: string }[] = []

  // Count rules in each section by counting numbered list items
  const hardMatch = personaText.match(/## Hard Rules[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[1]
  const standardMatch = personaText.match(/## Standard Rules[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[1]
  const notEnforcedMatch = personaText.match(/## Not Enforced[^\n]*\n([\s\S]*?)(?=\n## |$)/)?.[1]

  const countItems = (text?: string) => {
    if (!text) return 0
    return (text.match(/^\d+\./gm) || []).length
  }

  const hardCount = countItems(hardMatch)
  const standardCount = countItems(standardMatch)
  const notEnforcedCount = countItems(notEnforcedMatch)

  if (hardCount > 0) data.push({ label: "Hard Rules (all members agree)", count: hardCount, color: "text-terminal" })
  if (standardCount > 0) data.push({ label: "Standard Rules (majority agrees)", count: standardCount, color: "text-foreground" })
  if (notEnforcedCount > 0) data.push({ label: "Not Enforced (split opinion)", count: notEnforcedCount, color: "text-muted-foreground" })

  return data
}

export function PersonaViewer({ persona, slug }: { persona?: string | null; slug: string }) {
  const router = useRouter()
  const personaText = persona || FALLBACK_PERSONA
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(personaText)
  const [saving, setSaving] = useState(false)
  const consensusData = useMemo(() => parseConsensusData(content), [content])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch("/api/persona", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, persona: content }),
      })
      if (!res.ok) {
        console.error("Failed to save persona")
      }
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  function handleEditToggle() {
    if (editing) {
      handleSave()
    } else {
      setEditing(true)
    }
  }

  function handleReinterview() {
    router.push(`/dashboard/${slug}/interview`)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Consensus summary */}
      {consensusData.length > 0 && (
        <div className="border border-border p-6">
          <h3 className="mb-4 text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Consensus Data
          </h3>
          <div className="flex flex-col gap-3">
            {consensusData.map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className={`text-xs ${item.color}`}>{item.label}</span>
                <span className={`text-sm font-bold tabular-nums ${item.color}`}>
                  {item.count} {item.count === 1 ? "rule" : "rules"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleEditToggle}
          disabled={saving}
          className="border border-border px-4 py-2 text-xs tracking-wider uppercase text-foreground transition-colors hover:border-foreground disabled:opacity-50"
        >
          {saving ? "Saving..." : editing ? "Save" : "Edit"}
        </button>
        {editing && (
          <button
            type="button"
            onClick={() => { setContent(personaText); setEditing(false) }}
            className="border border-border px-4 py-2 text-xs tracking-wider uppercase text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleReinterview}
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
