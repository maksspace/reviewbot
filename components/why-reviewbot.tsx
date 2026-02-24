export function WhyReviewBot() {
  return (
    <section className="px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">
            Why ReviewBot
          </span>
        </div>

        <div className="grid gap-px overflow-hidden border border-border md:grid-cols-2">
          {/* Other bots */}
          <div className="bg-background p-8">
            <div className="mb-6 text-xs text-muted-foreground">
              {"// other bots"}
            </div>
            <div className="mb-6 border-l-2 border-border pl-4">
              <p className="text-sm leading-7 text-muted-foreground">
                {'"Consider adding error handling"'}
              </p>
            </div>
            <p className="text-xs leading-6 text-muted-foreground/60">
              Generic. Obvious. Noise.
            </p>
          </div>

          {/* ReviewBot */}
          <div className="border-t border-border bg-background p-8 md:border-t-0 md:border-l">
            <div className="mb-6 text-xs text-terminal">
              {"// reviewbot"}
            </div>
            <div className="mb-6 border-l-2 border-terminal/30 pl-4">
              <p className="text-sm leading-7 text-foreground">
                {'"This bypasses your CQRS pattern. Writes in RPC handlers should go through the event bus per your team\'s architecture decision."'}
              </p>
            </div>
            <p className="text-xs leading-6 text-terminal/60">
              Specific. Contextual. Actionable.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
