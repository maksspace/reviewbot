"use client"

import { useState, useRef, useEffect } from "react"
import { Send } from "lucide-react"

type Message = {
  role: "bot" | "user"
  content: string
}

const INITIAL_MESSAGES: Message[] = [
  {
    role: "bot",
    content:
      "Tell me about your project at a high level \u2014 what does it do, what\u2019s the tech stack, and how big is the team working on it?",
  },
  {
    role: "user",
    content:
      "We\u2019re building a B2B SaaS platform for tour operators. NestJS backend, PostgreSQL, Kafka for events. Team of 7 backend engineers.",
  },
  {
    role: "bot",
    content:
      "Nice. When you open an MR from a teammate, what\u2019s the very first thing you look at?",
  },
  {
    role: "user",
    content:
      "First I check the description \u2014 does it link to a ticket? Then I look at the file diff size. If it\u2019s over 400 lines, I\u2019ll usually ask them to split it.",
  },
  {
    role: "bot",
    content:
      "Good. What patterns or anti-patterns do you see your team repeat most often that you wish a reviewer would always catch?",
  },
]

const PHASE = "Phase 2 of 5 \u2014 Structure Deep Dive"

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState("")
  const [completed, setCompleted] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function handleSend() {
    if (!input.trim()) return
    setMessages((prev) => [...prev, { role: "user", content: input.trim() }])
    setInput("")

    // Simulate a bot response after a short delay
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          content:
            "Got it. Let\u2019s dig into your module boundaries next. How strict is your team about cross-module imports?",
        },
      ])
    }, 1200)
  }

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="mb-2 text-sm text-terminal">Interview complete.</p>
        <p className="text-xs text-muted-foreground">
          Generating your review persona...
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[600px] flex-col border border-border">
      {/* Phase indicator */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          {PHASE}
        </span>
        <button
          type="button"
          onClick={() => setCompleted(true)}
          className="text-[10px] tracking-[0.2em] uppercase text-terminal transition-colors hover:text-terminal-dim"
        >
          End Interview & Generate Persona
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col gap-6">
          {messages.map((msg, i) => (
            <div key={i} className="flex gap-4">
              <span className="mt-0.5 shrink-0 text-xs text-muted-foreground w-20 text-right">
                {msg.role === "bot" ? (
                  <span className="text-terminal">reviewbot</span>
                ) : (
                  "you"
                )}
              </span>
              <p className="text-sm leading-relaxed text-foreground max-w-[520px]">
                {msg.content}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{">"}</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Type your response..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            className="text-muted-foreground transition-colors hover:text-terminal disabled:opacity-30"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
