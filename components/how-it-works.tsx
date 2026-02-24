const STEPS = [
  {
    number: "01",
    label: "CONNECT",
    description:
      "Connect your GitHub or GitLab repo. The bot analyzes your codebase structure, patterns, and conventions.",
    terminal: [
      { text: "$ reviewbot connect", style: "command" },
      { text: "", style: "blank" },
      { text: "  Scanning repository...", style: "muted" },
      { text: "  Found 847 files across 23 modules", style: "muted" },
      { text: "  Detected: TypeScript, React, NestJS", style: "muted" },
      { text: "  Architecture: modular monolith", style: "muted" },
      { text: "", style: "blank" },
      { text: "  > Ready for interview.", style: "success" },
    ],
  },
  {
    number: "02",
    label: "INTERVIEW",
    description:
      "The bot interviews your team in a 15-minute chat. It learns your rules, your style, your opinions.",
    terminal: [
      { text: "Q: How should services communicate?", style: "command" },
      { text: "", style: "blank" },
      { text: "  [x] Event bus (Kafka/RabbitMQ)", style: "success" },
      { text: "  [ ] Direct imports", style: "muted" },
      { text: "  [ ] HTTP calls between services", style: "muted" },
      { text: "  [ ] Shared database", style: "muted" },
      { text: "", style: "blank" },
      { text: '  > Noted: "strict module boundaries"', style: "success" },
    ],
  },
  {
    number: "03",
    label: "REVIEW",
    description:
      "Every PR gets reviewed like your best engineer would. No noise. No generic advice. Just what matters.",
    terminal: [
      { text: "$ reviewbot review PR #291", style: "command" },
      { text: "", style: "blank" },
      { text: "  accounts.service.ts:42", style: "warn" },
      { text: "  Cross-module internal import.", style: "muted" },
      { text: "  Use PoliciesService through DI.", style: "muted" },
      { text: "", style: "blank" },
      { text: "  1 issue found · 0 noise · 4s", style: "success" },
      { text: "", style: "blank" },
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

              <p className="mb-6 text-sm leading-7 text-muted-foreground">
                {step.description}
              </p>

              {/* Mini terminal */}
              <div className="border border-border bg-background">
                <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-[#ff5f56]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-[#ffbd2e]" />
                  <div className="h-1.5 w-1.5 rounded-full bg-[#27c93f]" />
                </div>
                <div className="p-4 text-xs leading-5">
                  {step.terminal.map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.style === "command"
                          ? "text-foreground"
                          : line.style === "success"
                            ? "text-terminal"
                            : line.style === "warn"
                              ? "text-terminal-warn"
                              : line.style === "blank"
                                ? "h-3"
                                : "text-muted-foreground"
                      }
                    >
                      {line.text}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
