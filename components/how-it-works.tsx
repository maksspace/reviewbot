const STEPS = [
  {
    number: "01",
    label: "CONNECT",
    lines: [
      "Connect your GitHub",
      "or GitLab repo.",
      "Bot analyzes your",
      "codebase structure.",
    ],
  },
  {
    number: "02",
    label: "INTERVIEW",
    lines: [
      "Bot interviews your",
      "team (15 min chat).",
      "It learns your rules,",
      "your style, your",
      "opinions.",
    ],
  },
  {
    number: "03",
    label: "REVIEW",
    lines: [
      "Every PR gets reviewed",
      "like your best engineer",
      "would. No noise. No",
      "generic advice. Just",
      "what matters.",
    ],
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">
            How it works
          </span>
        </div>

        <div className="grid gap-12 md:grid-cols-3 md:gap-8">
          {STEPS.map((step) => (
            <div key={step.number} className="border-t border-border pt-8">
              <div className="mb-4 flex items-baseline gap-4">
                <span className="text-xs text-terminal">{step.number}</span>
                <span className="text-xs tracking-[0.2em] uppercase text-foreground">
                  {step.label}
                </span>
              </div>
              <div className="text-sm leading-7 text-muted-foreground">
                {step.lines.map((line, i) => (
                  <div key={i}>{line}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
