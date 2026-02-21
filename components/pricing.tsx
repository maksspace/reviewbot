"use client"

import { useState } from "react"

export function Pricing() {
  const [prsPerDay, setPrsPerDay] = useState(20)
  const costPerReview = 0.14
  const monthlyCost = (prsPerDay * costPerReview * 30).toFixed(0)

  return (
    <section id="pricing" className="px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">
            Pricing
          </span>
        </div>

        <div className="border border-border p-8 md:p-12">
          <h3 className="mb-4 text-xl font-bold text-foreground sm:text-2xl">
            Self-hosted. Bring your own API key.
          </h3>
          <p className="mb-8 text-sm leading-7 text-muted-foreground">
            $0 for the bot. You pay only for LLM tokens (~$0.14/review).
          </p>

          <div className="border-t border-border pt-8">
            <label
              htmlFor="pr-slider"
              className="mb-4 block text-xs tracking-[0.2em] uppercase text-muted-foreground"
            >
              Cost calculator
            </label>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <input
                  id="pr-slider"
                  type="range"
                  min="1"
                  max="100"
                  value={prsPerDay}
                  onChange={(e) => setPrsPerDay(Number(e.target.value))}
                  className="h-1 w-48 cursor-pointer appearance-none bg-border accent-terminal [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-terminal"
                />
                <span className="min-w-[80px] text-sm text-foreground">
                  {prsPerDay} PRs/day
                </span>
              </div>

              <div className="text-sm text-muted-foreground">
                {"= "}
                <span className="text-terminal font-bold">
                  ~${monthlyCost}/month
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
