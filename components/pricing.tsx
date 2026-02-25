"use client"

import { useState } from "react"
import Link from "next/link"
import { Check } from "lucide-react"

const PLANS = [
  {
    name: "Free",
    price: "$0",
    period: "/month",
    description: "For solo devs and small projects.",
    features: [
      "1 repository",
      "50 reviews/month",
      "Predefined skills only",
      "Bring your own key",
    ],
    cta: "Get Started",
    href: "/login",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$20",
    period: "/month",
    description: "For teams that ship fast.",
    features: [
      "Unlimited repositories",
      "Unlimited reviews",
      "Custom skills",
      "Bring your own key",
    ],
    cta: "Start Pro",
    href: "/login",
    highlight: true,
  },
] as const

export function Pricing() {
  const [prsPerMonth, setPrsPerMonth] = useState(150)
  const costPerReview = 0.10
  const monthlyCost = (prsPerMonth * costPerReview).toFixed(0)

  return (
    <section id="pricing" className="px-6 py-32">
      <div className="mx-auto max-w-6xl">
        <div className="mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground">
            Pricing
          </span>
        </div>

        {/* Plan cards */}
        <div className="mb-16 grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col border p-8 md:p-10 ${
                plan.highlight
                  ? "border-terminal"
                  : "border-border"
              }`}
            >
              <div className="mb-6">
                <span className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
                  {plan.name}
                </span>
              </div>

              <div className="mb-2 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-foreground">
                  {plan.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  {plan.period}
                </span>
              </div>

              <p className="mb-8 text-xs text-muted-foreground">
                {plan.description}
              </p>

              <ul className="mb-10 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-3 text-sm text-foreground"
                  >
                    <Check className="size-3 shrink-0 text-terminal" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`block w-full py-3 text-center text-xs tracking-wider uppercase transition-colors ${
                  plan.highlight
                    ? "border border-terminal bg-terminal text-background hover:bg-terminal/90"
                    : "border border-border text-foreground hover:border-foreground/30"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Cost calculator */}
        <div className="border border-border p-8 md:p-12">
          <h3 className="mb-4 text-base font-bold text-foreground">
            Bring your own API key. You pay only for LLM tokens.
          </h3>
          <p className="mb-8 text-xs leading-6 text-muted-foreground">
            Both plans use your own API key. Average cost per review is ~$0.10.
          </p>

          <div className="border-t border-border pt-8">
            <label
              htmlFor="pr-slider"
              className="mb-4 block text-xs tracking-[0.2em] uppercase text-muted-foreground"
            >
              Token cost calculator
            </label>

            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <input
                  id="pr-slider"
                  type="range"
                  min="10"
                  max="3000"
                  step="10"
                  value={prsPerMonth}
                  onChange={(e) => setPrsPerMonth(Number(e.target.value))}
                  className="h-1 w-48 cursor-pointer appearance-none bg-border accent-terminal [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:bg-terminal"
                />
                <span className="min-w-[120px] text-sm text-foreground">
                  {prsPerMonth} PRs/month
                </span>
              </div>

              <div className="text-sm text-muted-foreground">
                {"= "}
                <span className="font-bold text-terminal">
                  ~${monthlyCost}/month
                </span>
                <span className="text-xs text-muted-foreground/60">
                  {" "}in LLM tokens
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
