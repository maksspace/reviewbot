"use client"

import { useState, useEffect, useRef } from "react"

const TERMINAL_LINES = [
  { text: "$ reviewbot reviewing PR #847...", type: "command" as const, delay: 0 },
  { text: "", type: "blank" as const, delay: 800 },
  {
    text: "  \u26A0 src/modules/accounts/services/accounts.service.ts:42",
    type: "warning" as const,
    delay: 1200,
  },
  {
    text: "  \u2502 This imports directly from policies/repository \u2014 violates",
    type: "body" as const,
    delay: 1500,
  },
  {
    text: "  \u2502 your module boundary rule (ARCH-001). Use PoliciesService",
    type: "body" as const,
    delay: 1700,
  },
  {
    text: "  \u2502 through DI instead.",
    type: "body" as const,
    delay: 1900,
  },
  { text: "  \u2502", type: "body" as const, delay: 2100 },
  {
    text: "  \u2502 Why: Your team is preparing for microservice extraction.",
    type: "context" as const,
    delay: 2300,
  },
  {
    text: "  \u2502 Every cross-module repo import is an extraction blocker.",
    type: "context" as const,
    delay: 2500,
  },
  { text: "", type: "blank" as const, delay: 2800 },
  {
    text: "  \u2713 2 issues found \u00B7 0 noise \u00B7 reviewed in 8s",
    type: "success" as const,
    delay: 3200,
  },
]

export function TerminalAnimation() {
  const [visibleLines, setVisibleLines] = useState(0)
  const [started, setStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [started])

  useEffect(() => {
    if (!started) return

    const timeouts: ReturnType<typeof setTimeout>[] = []

    TERMINAL_LINES.forEach((line, index) => {
      const timeout = setTimeout(() => {
        setVisibleLines(index + 1)
      }, line.delay)
      timeouts.push(timeout)
    })

    return () => timeouts.forEach(clearTimeout)
  }, [started])

  return (
    <div ref={ref} className="w-full overflow-hidden border border-border bg-background">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-[#ff5f56]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#ffbd2e]" />
        <div className="h-2.5 w-2.5 rounded-full bg-[#27c93f]" />
        <span className="ml-4 text-xs text-muted-foreground">reviewbot</span>
      </div>
      <div className="relative p-6 text-sm leading-7">
        {/* Invisible spacer: all lines rendered but hidden to reserve full height */}
        <div aria-hidden="true" className="invisible">
          {TERMINAL_LINES.map((line, index) => (
            <div key={index} className={line.type === "blank" ? "h-5" : ""}>
              {line.text || "\u00A0"}
            </div>
          ))}
        </div>

        {/* Visible lines overlaid at same position */}
        <div className="absolute inset-0 p-6">
          {TERMINAL_LINES.map((line, index) => (
            <div
              key={index}
              className={`transition-opacity duration-150 ${
                index < visibleLines ? "opacity-100" : "opacity-0"
              } ${line.type === "command" ? "text-foreground" : ""}
              ${line.type === "warning" ? "text-terminal-warn" : ""}
              ${line.type === "body" ? "text-muted-foreground" : ""}
              ${line.type === "context" ? "text-muted-foreground italic" : ""}
              ${line.type === "success" ? "text-terminal font-bold" : ""}
              ${line.type === "blank" ? "h-5" : ""}`}
            >
              {line.text || "\u00A0"}
            </div>
          ))}
          {visibleLines < TERMINAL_LINES.length && started && (
            <span className="animate-blink text-terminal">_</span>
          )}
        </div>
      </div>
    </div>
  )
}
