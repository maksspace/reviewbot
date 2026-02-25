const COMPARISONS = [
  {
    category: "ERROR_HANDLING",
    other: '"Consider adding error handling"',
    ours:
      '"This handler silently swallows TransactionFailed. Your team requires explicit error propagation per ADR-012."',
  },
  {
    category: "ARCHITECTURE",
    other: '"Consider breaking this into smaller functions"',
    ours:
      '"This bypasses your CQRS pattern. Writes in RPC handlers should go through the event bus per your architecture decision."',
  },
  {
    category: "CODE_STYLE",
    other: '"Use camelCase for variable names"',
    ours:
      '"Your monorepo uses snake_case in the data layer (see /packages/db). Only API route handlers use camelCase."',
  },
  {
    category: "TESTING",
    other: '"Add unit tests"',
    ours:
      '"This payment flow needs integration tests with Stripe fixtures, matching your /tests/integration pattern."',
  },
]

const DIFFERENTIATORS = [
  { label: "LEARNS", value: "Your codebase, your rules, your opinions" },
  { label: "ZERO CONFIG", value: "15-min interview replaces hours of rule writing" },
  { label: "NO NOISE", value: "Only flags what your team actually cares about" },
  { label: "CONTEXT-AWARE", value: "Understands architecture, not just syntax" },
]

export function WhyReviewBot() {
  return (
    <section id="why-reviewbot" className="px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">
            Why ReviewBot
          </span>
        </div>

        <h2 className="mb-16 max-w-2xl text-2xl font-bold leading-tight text-foreground sm:text-3xl">
          Generic bots add noise.{" "}
          <span className="text-terminal">We add signal.</span>
        </h2>

        {/* Comparison rows */}
        <div className="mb-16 border border-border">
          {/* Header */}
          <div className="grid grid-cols-[1fr_1fr] border-b border-border">
            <div className="border-r border-border px-6 py-3">
              <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground/60">
                Other bots
              </span>
            </div>
            <div className="px-6 py-3">
              <span className="text-xs tracking-[0.2em] uppercase text-terminal">
                ReviewBot
              </span>
            </div>
          </div>

          {/* Rows */}
          {COMPARISONS.map((row, i) => (
            <div
              key={row.category}
              className={`grid grid-cols-[1fr_1fr] ${
                i < COMPARISONS.length - 1 ? "border-b border-border" : ""
              }`}
            >
              {/* Other bots column */}
              <div className="border-r border-border p-6">
                <span className="mb-3 block text-[10px] tracking-[0.2em] uppercase text-muted-foreground/40">
                  {row.category}
                </span>
                <p className="text-sm leading-relaxed text-muted-foreground/50">
                  {row.other}
                </p>
              </div>

              {/* ReviewBot column */}
              <div className="p-6">
                <span className="mb-3 block text-[10px] tracking-[0.2em] uppercase text-terminal/40">
                  {row.category}
                </span>
                <p className="text-sm leading-relaxed text-foreground">
                  {row.ours}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Differentiators */}
        <div className="grid gap-px border border-border sm:grid-cols-2 lg:grid-cols-4">
          {DIFFERENTIATORS.map((item) => (
            <div
              key={item.label}
              className="border-b border-r border-border p-6 last:border-b-0 sm:[&:nth-child(2)]:border-r-0 sm:[&:nth-child(n+3)]:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0"
            >
              <span className="mb-2 block text-xs tracking-[0.2em] uppercase text-terminal">
                {item.label}
              </span>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
