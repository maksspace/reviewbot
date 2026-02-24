"use client"

import { use, useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react"
import type {
  InterviewQuestion,
  InterviewAnswer,
  InterviewNextResponse,
  SingleSelectQuestion as SingleSelectQ,
  MultiSelectQuestion as MultiSelectQ,
  CodeOpinionQuestion as CodeOpinionQ,
  ShortTextQuestion as ShortTextQ,
  ConfirmCorrectQuestion as ConfirmCorrectQ,
} from "@/lib/types/interview"

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

const ALL_CATEGORIES = [
  { id: "architecture", label: "Architecture" },
  { id: "layers", label: "Layers" },
  { id: "api", label: "API" },
  { id: "testing", label: "Testing" },
  { id: "errors", label: "Errors" },
  { id: "review_philosophy", label: "Philosophy" },
  { id: "ignore", label: "Ignore" },
]

type InterviewStatus = "loading" | "answering" | "submitting" | "generating" | "complete" | "error"

/** Render inline `code` spans for text wrapped in backticks. */
function renderInlineCode(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`)/)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className="rounded bg-surface px-1.5 py-0.5 text-[0.85em] text-terminal font-mono">{part.slice(1, -1)}</code>
    ) : (
      <span key={i}>{part}</span>
    ),
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InterviewPage({
  params,
}: {
  params: Promise<{ repo: string }>
}) {
  const { repo } = use(params)

  const [status, setStatus] = useState<InterviewStatus>("loading")
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null)
  const [answers, setAnswers] = useState<InterviewAnswer[]>([])
  const [questionHistory, setQuestionHistory] = useState<InterviewQuestion[]>([])
  const [currentAnswer, setCurrentAnswer] = useState<string | string[] | null>(null)
  const [persona, setPersona] = useState<string>("")
  const [questionNumber, setQuestionNumber] = useState(0)
  const [estimatedTotal, setEstimatedTotal] = useState(10)
  const [errorMessage, setErrorMessage] = useState("")
  const [animating, setAnimating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState(0)

  // Derived
  const coveredCategories = new Set(answers.map((a) => a.category))
  const coveragePercent = estimatedTotal > 0
    ? Math.round((questionNumber / estimatedTotal) * 100)
    : 0

  const categoryDisplay = ALL_CATEGORIES.map((cat) => ({
    ...cat,
    covered: coveredCategories.has(cat.id),
  }))

  // -------------------------------------------------------------------------
  // API call
  // -------------------------------------------------------------------------

  const [thinkingLong, setThinkingLong] = useState(false)

  const fetchNextQuestion = useCallback(async (currentAnswers: InterviewAnswer[]) => {
    setStatus("submitting")
    setThinkingLong(false)

    const thinkingTimer = setTimeout(() => setThinkingLong(true), 10_000)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60_000)

    try {
      const res = await fetch("/api/interview/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: repo, answers: currentAnswers }),
        signal: controller.signal,
      })

      const data: InterviewNextResponse = await res.json()

      if (data.status === "question") {
        setAnimating(true)
        setTimeout(() => {
          setCurrentQuestion(data.question)
          setQuestionHistory((prev) => [...prev, data.question])
          setQuestionNumber(data.questionNumber)
          setEstimatedTotal(data.estimatedTotal)
          setCurrentAnswer(null)
          setStatus("answering")
          setAnimating(false)
        }, 300)
      } else if (data.status === "complete") {
        setPersona(data.persona)
        setStatus("generating")
      } else if (data.status === "error") {
        setErrorMessage(data.message)
        setStatus("error")
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setErrorMessage("Request timed out. Try again.")
      } else {
        setErrorMessage("Failed to connect to server")
      }
      setStatus("error")
    } finally {
      clearTimeout(thinkingTimer)
      clearTimeout(timeoutId)
    }
  }, [repo])

  // Initial load — guarded against React Strict Mode double-mount
  const didInit = useRef(false)
  useEffect(() => {
    if (didInit.current) return
    didInit.current = true
    fetchNextQuestion([])
  }, [fetchNextQuestion])

  // Simulate generating animation before showing complete
  useEffect(() => {
    if (status !== "generating") return
    const interval = setInterval(() => {
      setGeneratingProgress((p) => {
        if (p >= 100) {
          clearInterval(interval)
          setStatus("complete")
          return 100
        }
        return p + 3
      })
    }, 60)
    return () => clearInterval(interval)
  }, [status])

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function handleNext() {
    if (!currentAnswer || !currentQuestion) return

    const newAnswer: InterviewAnswer = {
      question: currentQuestion.question,
      answer: currentAnswer,
      type: currentQuestion.type,
      category: currentQuestion.category,
    }

    const updatedAnswers = [...answers, newAnswer]
    setAnswers(updatedAnswers)
    fetchNextQuestion(updatedAnswers)
  }

  function handleSkip() {
    if (!currentQuestion) return

    const skipAnswer: InterviewAnswer = {
      question: currentQuestion.question,
      answer: "skipped",
      type: currentQuestion.type,
      category: currentQuestion.category,
    }

    const updatedAnswers = [...answers, skipAnswer]
    setAnswers(updatedAnswers)
    fetchNextQuestion(updatedAnswers)
  }

  function handleBack() {
    if (answers.length === 0 || questionHistory.length < 2) return

    const prevAnswers = answers.slice(0, -1)
    const prevQuestion = questionHistory[questionHistory.length - 2]
    const prevAnswer = prevAnswers.length > 0 ? prevAnswers[prevAnswers.length - 1] : null

    setAnswers(prevAnswers)
    setQuestionHistory((prev) => prev.slice(0, -1))
    setCurrentQuestion(prevQuestion)
    setCurrentAnswer(prevAnswer?.answer ?? null)
    setQuestionNumber((n) => Math.max(1, n - 1))
    setStatus("answering")
  }

  const hasAnswer = currentAnswer !== null && currentAnswer !== "" &&
    (!Array.isArray(currentAnswer) || currentAnswer.length > 0)

  // -------------------------------------------------------------------------
  // Render — Loading
  // -------------------------------------------------------------------------

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-terminal" />
        <p className="mt-4 text-xs text-muted-foreground">Preparing interview...</p>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render — Error
  // -------------------------------------------------------------------------

  if (status === "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
        <p className="mb-6 max-w-md text-center text-sm text-red-400">{errorMessage}</p>
        <button
          type="button"
          onClick={() => fetchNextQuestion(answers)}
          className="border border-terminal px-6 py-3 text-xs tracking-wider uppercase text-terminal transition-all hover:bg-terminal hover:text-background"
        >
          Retry
        </button>
        <Link
          href={`/dashboard/${repo}`}
          className="mt-4 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Back to repository
        </Link>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Render — Generating / Complete
  // -------------------------------------------------------------------------

  if (status === "generating" || status === "complete") {
    return <CompletionScreen repo={repo} progress={generatingProgress} done={status === "complete"} />
  }

  // -------------------------------------------------------------------------
  // Render — Question (answering / submitting)
  // -------------------------------------------------------------------------

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex flex-col gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: back + skip */}
          <div className="flex items-center gap-4">
            {answers.length > 0 ? (
              <button
                type="button"
                onClick={handleBack}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Previous question"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <Link
                href={`/dashboard/${repo}`}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Back to repository"
              >
                <ArrowLeft className="size-4" />
              </Link>
            )}
            <button
              type="button"
              onClick={handleSkip}
              disabled={status === "submitting"}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              Skip
            </button>
          </div>

          {/* Right: coverage pills */}
          <div className="hidden items-center gap-2 sm:flex">
            {categoryDisplay.map((cat) => (
              <span
                key={cat.id}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] tracking-wide ${
                  cat.covered
                    ? "border-terminal/30 bg-terminal/5 text-terminal"
                    : "border-border bg-transparent text-muted-foreground"
                }`}
              >
                {cat.label}
                {cat.covered ? (
                  <Check className="size-2.5" />
                ) : (
                  <span className="text-[10px] opacity-50">{"○"}</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-1.5">
          <div className="h-[2px] w-full bg-border">
            <div
              className="h-full bg-terminal transition-all duration-500"
              style={{ width: `${Math.min(coveragePercent, 100)}%` }}
            />
          </div>
          <span className="text-[10px] tracking-wider text-muted-foreground">
            {"Question "}
            <span className="text-foreground tabular-nums">{questionNumber}</span>
            {" of ~"}
            <span className="text-foreground tabular-nums">{estimatedTotal}</span>
          </span>
        </div>
      </header>

      {/* Question area */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        {status === "submitting" ? (
          <div className="flex flex-col items-center gap-4 py-20">
            <Loader2 className="size-5 animate-spin text-terminal" />
            <p className="text-xs text-muted-foreground">
              {thinkingLong ? "Still thinking, hang tight..." : "Thinking..."}
            </p>
          </div>
        ) : (
          <div
            className={`w-full max-w-xl transition-all duration-300 ${
              animating
                ? "translate-y-4 opacity-0"
                : "translate-y-0 opacity-100"
            }`}
          >
            {currentQuestion ? (
              <>
                <QuestionRenderer
                  question={currentQuestion}
                  answer={currentAnswer}
                  onAnswer={setCurrentAnswer}
                />

                {/* Next button */}
                <div className="mt-10 flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    disabled={!hasAnswer && currentQuestion.type !== "confirm_correct"}
                    className="group inline-flex items-center gap-2 border border-terminal/60 px-6 py-3 text-xs tracking-wider uppercase text-terminal transition-all hover:border-terminal hover:bg-terminal hover:text-background disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:hover:bg-transparent"
                  >
                    Next
                    <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Question Renderer
// ---------------------------------------------------------------------------

function QuestionRenderer({
  question,
  answer,
  onAnswer,
}: {
  question: InterviewQuestion
  answer: string | string[] | null
  onAnswer: (val: string | string[]) => void
}) {
  switch (question.type) {
    case "single_select":
      return (
        <SingleSelectQuestion
          question={question}
          selected={(answer as string) ?? undefined}
          onSelect={onAnswer}
        />
      )
    case "code_opinion":
      return (
        <CodeOpinionQuestion
          question={question}
          selected={(answer as string) ?? undefined}
          onSelect={onAnswer}
        />
      )
    case "multi_select":
      return (
        <MultiSelectQuestion
          question={question}
          selected={(answer as string[]) ?? []}
          onSelect={onAnswer}
        />
      )
    case "short_text":
      return (
        <TextInputQuestion
          question={question}
          value={(answer as string) ?? ""}
          onChange={onAnswer}
        />
      )
    case "confirm_correct":
      return (
        <ConfirmCorrectQuestion
          question={question}
          answer={(answer as string) ?? undefined}
          onAnswer={onAnswer}
        />
      )
  }
}

// ---------------------------------------------------------------------------
// Type 1 — Single Select
// ---------------------------------------------------------------------------

function SingleSelectQuestion({
  question,
  selected,
  onSelect,
}: {
  question: SingleSelectQ | CodeOpinionQ
  selected: string | undefined
  onSelect: (val: string) => void
}) {
  return (
    <div>
      <p className="mb-8 text-lg leading-relaxed text-foreground whitespace-pre-line">
        {renderInlineCode(question.question)}
      </p>
      <div className="flex flex-col gap-3">
        {question.options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={`flex items-center gap-4 border px-5 py-4 text-left text-sm transition-all ${
              selected === opt
                ? "border-terminal bg-terminal/5 text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            <span
              className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                selected === opt
                  ? "border-terminal bg-terminal"
                  : "border-muted-foreground/40"
              }`}
            >
              {selected === opt && (
                <span className="size-1.5 rounded-full bg-background" />
              )}
            </span>
            <span className="leading-relaxed">{renderInlineCode(opt)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Type 2 — Code Opinion
// ---------------------------------------------------------------------------

function CodeOpinionQuestion({
  question,
  selected,
  onSelect,
}: {
  question: CodeOpinionQ
  selected: string | undefined
  onSelect: (val: string) => void
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] tracking-wider text-muted-foreground">
        {"From "}
        <span className="text-terminal">{question.codeFile}</span>
        {":"}
      </p>

      {/* Code block */}
      <div className="mb-8 border border-border bg-surface p-4">
        <pre className="overflow-x-auto text-sm leading-relaxed text-foreground">
          <code>{question.codeSnippet}</code>
        </pre>
      </div>

      <p className="mb-8 text-lg leading-relaxed text-foreground">
        {renderInlineCode(question.question)}
      </p>

      <div className="flex flex-col gap-3">
        {question.options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={`flex items-center gap-4 border px-5 py-4 text-left text-sm transition-all ${
              selected === opt
                ? "border-terminal bg-terminal/5 text-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            <span
              className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
                selected === opt
                  ? "border-terminal bg-terminal"
                  : "border-muted-foreground/40"
              }`}
            >
              {selected === opt && (
                <span className="size-1.5 rounded-full bg-background" />
              )}
            </span>
            <span className="leading-relaxed">{renderInlineCode(opt)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Type 3 — Multi Select
// ---------------------------------------------------------------------------

function MultiSelectQuestion({
  question,
  selected,
  onSelect,
}: {
  question: MultiSelectQ
  selected: string[]
  onSelect: (val: string[]) => void
}) {
  function toggle(opt: string) {
    if (selected.includes(opt)) {
      onSelect(selected.filter((s) => s !== opt))
    } else {
      onSelect([...selected, opt])
    }
  }

  return (
    <div>
      <p className="mb-8 text-lg leading-relaxed text-foreground whitespace-pre-line">
        {renderInlineCode(question.question)}
      </p>
      <div className="flex flex-col gap-3">
        {question.options.map((opt) => {
          const checked = selected.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`flex items-center gap-4 border px-5 py-4 text-left text-sm transition-all ${
                checked
                  ? "border-terminal bg-terminal/5 text-foreground"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
              }`}
            >
              <span
                className={`flex size-4 shrink-0 items-center justify-center rounded-sm border ${
                  checked
                    ? "border-terminal bg-terminal"
                    : "border-muted-foreground/40"
                }`}
              >
                {checked && <Check className="size-2.5 text-background" />}
              </span>
              <span className="leading-relaxed">{renderInlineCode(opt)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Type 4 — Text Input
// ---------------------------------------------------------------------------

function TextInputQuestion({
  question,
  value,
  onChange,
}: {
  question: ShortTextQ
  value: string
  onChange: (val: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [question.question])

  return (
    <div>
      <p className="mb-8 text-lg leading-relaxed text-foreground whitespace-pre-line">
        {renderInlineCode(question.question)}
      </p>
      <div className="border border-border bg-surface transition-colors focus-within:border-terminal/50">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder ?? "Type here..."}
          rows={4}
          className="w-full resize-none bg-transparent px-5 py-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Type 5 — Confirm / Correct
// ---------------------------------------------------------------------------

function ConfirmCorrectQuestion({
  question,
  answer,
  onAnswer,
}: {
  question: ConfirmCorrectQ
  answer: string | undefined
  onAnswer: (val: string) => void
}) {
  const [mode, setMode] = useState<"none" | "correct" | "corrections">("none")
  const [corrections, setCorrections] = useState("")

  function handleSelect(option: string) {
    if (option === "correct") {
      setMode("correct")
      onAnswer("confirmed")
    } else {
      setMode("corrections")
    }
  }

  function handleCorrections(val: string) {
    setCorrections(val)
    onAnswer(`corrections: ${val}`)
  }

  return (
    <div>
      <p className="mb-6 text-lg leading-relaxed text-foreground">
        {renderInlineCode(question.question)}
      </p>

      {/* Detections list */}
      <div className="mb-8 flex flex-col gap-2">
        {question.detections.map((d) => (
          <div key={d} className="flex items-center gap-3 text-sm">
            <Check className="size-3.5 text-terminal" />
            <span className="text-foreground">{renderInlineCode(d)}</span>
          </div>
        ))}
      </div>

      <p className="mb-6 text-base text-foreground">Is this correct?</p>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => handleSelect("correct")}
          className={`flex items-center gap-4 border px-5 py-4 text-left text-sm transition-all ${
            mode === "correct"
              ? "border-terminal bg-terminal/5 text-foreground"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          }`}
        >
          <span
            className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
              mode === "correct"
                ? "border-terminal bg-terminal"
                : "border-muted-foreground/40"
            }`}
          >
            {mode === "correct" && (
              <span className="size-1.5 rounded-full bg-background" />
            )}
          </span>
          {"Yes, that\u2019s right"}
        </button>

        <button
          type="button"
          onClick={() => handleSelect("corrections")}
          className={`flex items-center gap-4 border px-5 py-4 text-left text-sm transition-all ${
            mode === "corrections"
              ? "border-terminal bg-terminal/5 text-foreground"
              : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          }`}
        >
          <span
            className={`flex size-4 shrink-0 items-center justify-center rounded-full border ${
              mode === "corrections"
                ? "border-terminal bg-terminal"
                : "border-muted-foreground/40"
            }`}
          >
            {mode === "corrections" && (
              <span className="size-1.5 rounded-full bg-background" />
            )}
          </span>
          {"Mostly \u2014 let me correct:"}
        </button>

        {mode === "corrections" && (
          <div className="mt-2 border border-border bg-surface transition-colors focus-within:border-terminal/50">
            <textarea
              value={corrections}
              onChange={(e) => handleCorrections(e.target.value)}
              placeholder="Type corrections..."
              rows={3}
              autoFocus
              className="w-full resize-none bg-transparent px-5 py-4 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Completion Screen
// ---------------------------------------------------------------------------

const COMPLETION_CATEGORIES = [
  "Architecture",
  "Layer rules",
  "API design",
  "Error handling",
  "Testing",
  "Review philosophy",
  "What to ignore",
]

function CompletionScreen({
  repo,
  progress,
  done,
}: {
  repo: string
  progress: number
  done: boolean
}) {
  const perCategory = 100 / COMPLETION_CATEGORIES.length
  const categoryProgress = COMPLETION_CATEGORIES.map((_, i) => {
    const start = i * perCategory
    const end = start + perCategory
    if (progress >= end) return 100
    if (progress <= start) return 0
    return ((progress - start) / perCategory) * 100
  })

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-10 flex items-center gap-3">
          <span
            className={`flex size-6 items-center justify-center rounded-full transition-colors ${
              done ? "bg-terminal" : "bg-terminal/20"
            }`}
          >
            <Check className={`size-3.5 ${done ? "text-background" : "text-terminal"}`} />
          </span>
          <span className="text-lg text-foreground">
            Interview complete
          </span>
        </div>

        <p className="mb-8 text-sm text-muted-foreground">
          {done ? "Your bot is ready." : "Generating your review persona..."}
        </p>

        {/* Category progress bars */}
        <div className="mb-12 flex flex-col gap-4">
          {COMPLETION_CATEGORIES.map((cat, i) => (
            <div key={cat} className="flex items-center gap-4">
              <span className="w-28 text-right text-xs text-muted-foreground">
                {cat}
              </span>
              <div className="flex flex-1 items-center gap-3">
                <div className="h-[2px] flex-1 bg-border">
                  <div
                    className="h-full bg-terminal transition-all duration-300"
                    style={{ width: `${categoryProgress[i]}%` }}
                  />
                </div>
                <span
                  className={`text-xs transition-opacity ${
                    categoryProgress[i] >= 100
                      ? "text-terminal opacity-100"
                      : "text-muted-foreground opacity-0"
                  }`}
                >
                  <Check className="size-3" />
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* CTAs — only show when done */}
        {done && (
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/${repo}`}
              className="inline-flex items-center gap-2 border border-terminal px-6 py-3 text-xs tracking-wider uppercase text-terminal transition-all hover:bg-terminal hover:text-background"
            >
              View Persona
              <ArrowRight className="size-3" />
            </Link>
            <Link
              href="/dashboard"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
