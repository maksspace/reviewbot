"use client"

import { use, useState, useCallback, useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Category = {
  id: string
  label: string
  covered: boolean
}

type QuestionBase = {
  id: number
  prompt: string
  category: string
}

type SingleSelect = QuestionBase & {
  type: "single"
  options: string[]
}

type CodeOpinion = QuestionBase & {
  type: "code"
  codeSnippet: string
  codeFile: string
  options: string[]
}

type MultiSelect = QuestionBase & {
  type: "multi"
  options: string[]
}

type TextInput = QuestionBase & {
  type: "text"
  placeholder: string
}

type ConfirmCorrect = QuestionBase & {
  type: "confirm"
  detections: string[]
}

type Question = SingleSelect | CodeOpinion | MultiSelect | TextInput | ConfirmCorrect

// ---------------------------------------------------------------------------
// Mock question bank — simulates dynamically-generated questions
// ---------------------------------------------------------------------------

const QUESTIONS: Question[] = [
  {
    id: 1,
    type: "confirm",
    category: "Architecture",
    prompt: "Based on your codebase, here's what we detected:",
    detections: [
      "NestJS modular architecture",
      "Repository pattern for DB access",
      "Zod for request validation",
      "Kafka for async events",
    ],
  },
  {
    id: 2,
    type: "single",
    category: "Architecture",
    prompt: "We found 12 NestJS modules in your project.\nHow should modules communicate?",
    options: [
      "Direct service calls for everything",
      "Events for cross-module writes, direct calls for reads",
      "Events only, fully decoupled",
      "No rules \u2014 whatever works",
    ],
  },
  {
    id: 3,
    type: "code",
    category: "Layers",
    prompt: "Is passing a transaction to a service ok?",
    codeFile: "accounts.service.ts",
    codeSnippet: `async createAccount(
  name: string,
  managerId: number,
  tx?: Transaction
): Promise<Account> {`,
    options: [
      "Never \u2014 services own their transactions",
      "Acceptable for critical operations",
      "No opinion on this",
    ],
  },
  {
    id: 4,
    type: "single",
    category: "Layers",
    prompt: "A controller directly queries the database.\nShould the bot flag this?",
    options: [
      "Always \u2014 controllers should never touch the DB",
      "Only if there\u2019s already a service for that entity",
      "No \u2014 sometimes it\u2019s fine for simple reads",
    ],
  },
  {
    id: 5,
    type: "single",
    category: "API",
    prompt: "A route handler returns raw database rows.\nHow should the bot respond?",
    options: [
      "Flag it \u2014 always use DTOs",
      "Warn \u2014 suggest a DTO but don\u2019t block",
      "Ignore \u2014 DTOs are optional",
    ],
  },
  {
    id: 6,
    type: "text",
    category: "API",
    prompt: "Your controllers follow a specific pattern.\nWhat should NEVER happen in a controller?",
    placeholder: "Type here...",
  },
  {
    id: 7,
    type: "single",
    category: "Testing",
    prompt: "A PR adds a new service method with no tests.\nWhat should the bot do?",
    options: [
      "Block \u2014 all service methods need tests",
      "Warn \u2014 suggest adding tests",
      "Ignore \u2014 we don\u2019t enforce test coverage",
    ],
  },
  {
    id: 8,
    type: "code",
    category: "Errors",
    prompt: "Should error responses follow this pattern?",
    codeFile: "http-exception.filter.ts",
    codeSnippet: `catch(exception: HttpException) {
  const status = exception.getStatus();
  return {
    statusCode: status,
    message: exception.message,
    timestamp: new Date().toISOString(),
  };
}`,
    options: [
      "Yes \u2014 enforce this pattern everywhere",
      "Partially \u2014 structure is ok but add error codes",
      "No \u2014 we have a different standard",
    ],
  },
  {
    id: 9,
    type: "multi",
    category: "Ignore",
    prompt: "What should the bot NEVER comment on?\nSelect all that apply.",
    options: [
      "Naming conventions (linter handles it)",
      "Missing comments or JSDoc",
      "Import ordering",
      "Test coverage numbers",
      "Code formatting / whitespace",
    ],
  },
  {
    id: 10,
    type: "single",
    category: "Errors",
    prompt: "A service catches an error and silently swallows it.\nShould the bot flag this?",
    options: [
      "Always \u2014 silent catches are never ok",
      "Only in production code, not tests",
      "No opinion",
    ],
  },
]

// After all core questions are answered
const COMPLETION_QUESTION: Question = {
  id: 99,
  type: "single",
  category: "done",
  prompt: "Your review persona covers all core areas.",
  options: [
    "I\u2019m done \u2014 generate the persona",
    "Keep going \u2014 I have more opinions",
  ],
}

const BONUS_QUESTIONS: Question[] = [
  {
    id: 100,
    type: "text",
    category: "Architecture",
    prompt: "Any naming conventions or file structure rules\nthe bot should enforce?",
    placeholder: "e.g. all services end with .service.ts, no barrel files...",
  },
  {
    id: 101,
    type: "single",
    category: "Testing",
    prompt: "How strict should the bot be about mocking in unit tests?",
    options: [
      "Strict \u2014 no real dependencies ever",
      "Flexible \u2014 integration-style tests are fine",
      "No opinion",
    ],
  },
]

// ---------------------------------------------------------------------------
// Category tracking
// ---------------------------------------------------------------------------

const INITIAL_CATEGORIES: Category[] = [
  { id: "Architecture", label: "Architecture", covered: false },
  { id: "Layers", label: "Layers", covered: false },
  { id: "API", label: "API", covered: false },
  { id: "Testing", label: "Testing", covered: false },
  { id: "Errors", label: "Errors", covered: false },
  { id: "Ignore", label: "Ignore", covered: false },
]

// Map: which question indices cover which categories
function getCoveredCategories(answeredIds: Set<number>): Set<string> {
  const covered = new Set<string>()
  for (const q of QUESTIONS) {
    if (answeredIds.has(q.id)) {
      covered.add(q.category)
    }
  }
  return covered
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

  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({})
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES)
  const [phase, setPhase] = useState<"questions" | "completion-prompt" | "bonus" | "done">("questions")
  const [bonusIndex, setBonusIndex] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [generatingProgress, setGeneratingProgress] = useState<number>(0)

  const answeredIds = new Set(Object.keys(answers).map(Number))
  const coveredCats = getCoveredCategories(answeredIds)
  const coveragePercent = Math.round((coveredCats.size / INITIAL_CATEGORIES.length) * 100)

  // Update categories whenever answers change
  useEffect(() => {
    setCategories((prev) =>
      prev.map((cat) => ({
        ...cat,
        covered: coveredCats.has(cat.id),
      }))
    )
  }, [answers]) // eslint-disable-line react-hooks/exhaustive-deps

  // Determine current question
  let currentQuestion: Question
  if (phase === "questions") {
    currentQuestion = QUESTIONS[currentIndex]
  } else if (phase === "completion-prompt") {
    currentQuestion = COMPLETION_QUESTION
  } else if (phase === "bonus") {
    currentQuestion = BONUS_QUESTIONS[bonusIndex] ?? BONUS_QUESTIONS[0]
  } else {
    currentQuestion = COMPLETION_QUESTION // won't render
  }

  const advanceWithAnimation = useCallback((callback: () => void) => {
    setAnimating(true)
    setTimeout(() => {
      callback()
      setAnimating(false)
    }, 300)
  }, [])

  function handleNext() {
    if (!answers[currentQuestion.id] && currentQuestion.type !== "confirm") return

    if (phase === "questions") {
      if (currentIndex < QUESTIONS.length - 1) {
        advanceWithAnimation(() => setCurrentIndex((i) => i + 1))
      } else {
        // All core questions answered
        advanceWithAnimation(() => setPhase("completion-prompt"))
      }
    } else if (phase === "completion-prompt") {
      const answer = answers[COMPLETION_QUESTION.id]
      if (answer === COMPLETION_QUESTION.options[0]) {
        // Done — generate persona
        setPhase("done")
      } else {
        // Keep going
        advanceWithAnimation(() => {
          setPhase("bonus")
          setBonusIndex(0)
        })
      }
    } else if (phase === "bonus") {
      if (bonusIndex < BONUS_QUESTIONS.length - 1) {
        advanceWithAnimation(() => setBonusIndex((i) => i + 1))
      } else {
        setPhase("done")
      }
    }
  }

  function handleSkip() {
    if (phase === "questions" && currentIndex < QUESTIONS.length - 1) {
      advanceWithAnimation(() => setCurrentIndex((i) => i + 1))
    } else if (phase === "questions") {
      advanceWithAnimation(() => setPhase("completion-prompt"))
    } else if (phase === "bonus" && bonusIndex < BONUS_QUESTIONS.length - 1) {
      advanceWithAnimation(() => setBonusIndex((i) => i + 1))
    } else if (phase === "bonus") {
      setPhase("done")
    }
  }

  // Simulate persona generation progress
  useEffect(() => {
    if (phase !== "done") return
    const interval = setInterval(() => {
      setGeneratingProgress((p) => {
        if (p >= 100) {
          clearInterval(interval)
          return 100
        }
        return p + 2
      })
    }, 60)
    return () => clearInterval(interval)
  }, [phase])

  const hasAnswer = !!answers[currentQuestion.id]

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (phase === "done") {
    return <CompletionScreen repo={repo} progress={generatingProgress} />
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex flex-col gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: back + skip */}
          <div className="flex items-center gap-4">
            <Link
              href={`/dashboard/${repo}`}
              className="text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Back to repository"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <button
              type="button"
              onClick={handleSkip}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Skip
            </button>
          </div>

          {/* Right: coverage pills */}
          <div className="hidden items-center gap-2 sm:flex">
            {categories.map((cat) => (
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
              style={{ width: `${coveragePercent}%` }}
            />
          </div>
          <span className="text-[10px] tracking-wider text-muted-foreground">
            {"Review persona: "}
            <span className="text-foreground tabular-nums">{coveragePercent}%</span>
            {" complete"}
          </span>
        </div>
      </header>

      {/* Question area */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div
          className={`w-full max-w-xl transition-all duration-300 ${
            animating ? "translate-y-4 opacity-0" : "translate-y-0 opacity-100"
          }`}
        >
          <QuestionRenderer
            question={currentQuestion}
            answer={answers[currentQuestion.id]}
            onAnswer={(val) =>
              setAnswers((prev) => ({ ...prev, [currentQuestion.id]: val }))
            }
          />

          {/* Next button */}
          <div className="mt-10 flex justify-end">
            <button
              type="button"
              onClick={handleNext}
              disabled={!hasAnswer && currentQuestion.type !== "confirm"}
              className="group inline-flex items-center gap-2 border border-terminal/60 px-6 py-3 text-xs tracking-wider uppercase text-terminal transition-all hover:border-terminal hover:bg-terminal hover:text-background disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:hover:bg-transparent"
            >
              {phase === "completion-prompt" && hasAnswer && answers[COMPLETION_QUESTION.id] === COMPLETION_QUESTION.options[0]
                ? "Generate Persona"
                : "Next"}
              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
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
  question: Question
  answer: string | string[] | undefined
  onAnswer: (val: string | string[]) => void
}) {
  switch (question.type) {
    case "single":
      return (
        <SingleSelectQuestion
          question={question}
          selected={answer as string | undefined}
          onSelect={(val) => onAnswer(val)}
        />
      )
    case "code":
      return (
        <CodeOpinionQuestion
          question={question}
          selected={answer as string | undefined}
          onSelect={(val) => onAnswer(val)}
        />
      )
    case "multi":
      return (
        <MultiSelectQuestion
          question={question}
          selected={(answer as string[] | undefined) ?? []}
          onSelect={(val) => onAnswer(val)}
        />
      )
    case "text":
      return (
        <TextInputQuestion
          question={question}
          value={(answer as string | undefined) ?? ""}
          onChange={(val) => onAnswer(val)}
        />
      )
    case "confirm":
      return (
        <ConfirmCorrectQuestion
          question={question}
          answer={answer as string | undefined}
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
  question: SingleSelect | CodeOpinion
  selected: string | undefined
  onSelect: (val: string) => void
}) {
  return (
    <div>
      <p className="mb-8 text-lg leading-relaxed text-foreground whitespace-pre-line">
        {question.prompt}
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
            <span className="leading-relaxed">{opt}</span>
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
  question: CodeOpinion
  selected: string | undefined
  onSelect: (val: string) => void
}) {
  return (
    <div>
      <p className="mb-2 text-[10px] tracking-wider text-muted-foreground">
        {"We found this in "}
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
        {question.prompt}
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
            <span className="leading-relaxed">{opt}</span>
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
  question: MultiSelect
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
        {question.prompt}
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
              <span className="leading-relaxed">{opt}</span>
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
  question: TextInput
  value: string
  onChange: (val: string) => void
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
  }, [question.id])

  return (
    <div>
      <p className="mb-8 text-lg leading-relaxed text-foreground whitespace-pre-line">
        {question.prompt}
      </p>
      <div className="border border-border bg-surface transition-colors focus-within:border-terminal/50">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
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
  question: ConfirmCorrect
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
        {question.prompt}
      </p>

      {/* Detections list */}
      <div className="mb-8 flex flex-col gap-2">
        {question.detections.map((d) => (
          <div key={d} className="flex items-center gap-3 text-sm">
            <Check className="size-3.5 text-terminal" />
            <span className="text-foreground">{d}</span>
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
  "What to ignore",
]

function CompletionScreen({
  repo,
  progress,
}: {
  repo: string
  progress: number
}) {
  const done = progress >= 100
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
            {done ? "Interview complete" : "Interview complete"}
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
