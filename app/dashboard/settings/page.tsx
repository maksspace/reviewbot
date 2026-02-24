"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react"

const MODELS = [
  { value: "openai/gpt-5.3-codex", label: "GPT-5.3-Codex", provider: "OpenAI" },
  { value: "openai/gpt-5.2-codex", label: "GPT-5.2-Codex", provider: "OpenAI" },
  { value: "openai/gpt-5.1-codex-max", label: "GPT-5.1-Codex-Max", provider: "OpenAI" },
  { value: "openai/gpt-5.2", label: "GPT-5.2", provider: "OpenAI" },
  { value: "openai/gpt-5.1-codex-mini", label: "GPT-5.1-Codex-Mini", provider: "OpenAI" },
  { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "Anthropic" },
  { value: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic" },
  { value: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Anthropic" },
] as const

function getProviderLabel(model: string): string {
  const slash = model.indexOf("/")
  if (slash <= 0) return "OpenAI"
  const prefix = model.slice(0, slash)
  return prefix === "anthropic" ? "Anthropic" : "OpenAI"
}

function getApiKeyPlaceholder(model: string): string {
  return model.startsWith("anthropic/") ? "sk-ant-..." : "sk-..."
}

interface SubscriptionData {
  plan: string
  status: string
  reviewsUsed: number
  reviewsLimit: number | null
  reposUsed: number
  reposLimit: number | null
  currentPeriodEnd: string | null
  hasStripeCustomer: boolean
}

export default function SettingsPage() {
  const [model, setModel] = useState("openai/gpt-5.2-codex")
  const [apiKey, setApiKey] = useState("")
  const [hasExistingKey, setHasExistingKey] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const [maxComments, setMaxComments] = useState(10)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [upgrading, setUpgrading] = useState(false)
  const [justUpgraded, setJustUpgraded] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("upgraded") === "true") {
      setJustUpgraded(true)
    }
  }, [])

  useEffect(() => {
    Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/subscription").then((r) => r.json()),
    ]).then(([settings, sub]) => {
      if (!settings.error) {
        setModel(settings.model ?? "openai/gpt-5.2-codex")
        setApiKey(settings.api_key ?? "")
        setHasExistingKey(settings.has_api_key ?? false)
        setMaxComments(settings.max_comments ?? 10)
      }
      if (!sub.error) {
        setSubscription(sub)
      }
    }).finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, api_key: apiKey, max_comments: maxComments }),
    })
    setSaving(false)
    setSaved(true)
    setHasExistingKey(!!apiKey && !apiKey.includes("..."))
    setTimeout(() => setSaved(false), 3000)
  }

  async function handleUpgrade() {
    setUpgrading(true)
    const res = await fetch("/api/stripe/checkout", { method: "POST" })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    } else {
      setUpgrading(false)
    }
  }

  async function handleManageSubscription() {
    const res = await fetch("/api/stripe/portal", { method: "POST" })
    const data = await res.json()
    if (data.url) {
      window.location.href = data.url
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const providerLabel = getProviderLabel(model)
  const isPro = subscription?.plan === "pro" && subscription?.status === "active"

  return (
    <div>
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Back to repositories
      </Link>

      <h1 className="mb-2 text-lg font-bold text-foreground">Settings</h1>
      <p className="mb-10 text-xs text-muted-foreground">
        Configure your LLM model and review preferences.
      </p>

      {/* Subscription */}
      <div className={`mb-8 border p-6 ${isPro ? "border-terminal/30" : "border-border"}`}>
        <div className="mb-4 flex items-center justify-between">
          <label className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Plan
          </label>
          <span className={`text-xs font-bold tracking-wider uppercase ${isPro ? "text-terminal" : "text-muted-foreground"}`}>
            {isPro ? "Pro" : "Free"}
          </span>
        </div>

        {justUpgraded && isPro && (
          <div className="mb-4 border border-terminal/30 px-4 py-3">
            <p className="text-xs text-terminal">
              Upgrade successful. You now have unlimited repos and reviews.
            </p>
          </div>
        )}

        {subscription && (
          <div className="mb-6 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Reviews this month</span>
              <span className="tabular-nums text-foreground">
                {subscription.reviewsUsed}
                {subscription.reviewsLimit !== null && (
                  <span className="text-muted-foreground"> / {subscription.reviewsLimit}</span>
                )}
                {subscription.reviewsLimit === null && (
                  <span className="text-muted-foreground/60"> (unlimited)</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Repositories</span>
              <span className="tabular-nums text-foreground">
                {subscription.reposUsed}
                {subscription.reposLimit !== null && (
                  <span className="text-muted-foreground"> / {subscription.reposLimit}</span>
                )}
                {subscription.reposLimit === null && (
                  <span className="text-muted-foreground/60"> (unlimited)</span>
                )}
              </span>
            </div>
            {isPro && subscription.currentPeriodEnd && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Renews</span>
                <span className="text-foreground">
                  {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        )}

        {isPro ? (
          <button
            type="button"
            onClick={handleManageSubscription}
            className="border border-border px-5 py-2 text-xs tracking-wider uppercase text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            Manage Subscription
          </button>
        ) : (
          <button
            type="button"
            disabled={upgrading}
            onClick={handleUpgrade}
            className="border border-terminal px-5 py-2 text-xs tracking-wider uppercase text-terminal transition-colors hover:bg-terminal hover:text-background disabled:pointer-events-none disabled:opacity-50"
          >
            {upgrading ? "Redirecting..." : "Upgrade to Pro — $9/mo"}
          </button>
        )}
      </div>

      {/* Model */}
      <div className="mb-8 border border-border p-6">
        <label
          htmlFor="llm-model"
          className="mb-4 block text-xs tracking-[0.2em] uppercase text-muted-foreground"
        >
          Model
        </label>
        <select
          id="llm-model"
          value={model}
          onChange={(e) => {
            const newModel = e.target.value
            const oldProvider = getProviderLabel(model)
            const newProvider = getProviderLabel(newModel)
            setModel(newModel)
            // Clear API key when switching providers
            if (oldProvider !== newProvider) {
              setApiKey("")
              setHasExistingKey(false)
            }
          }}
          className="w-full max-w-xs border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-terminal"
        >
          {MODELS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.provider} / {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* API Key */}
      <div className="mb-8 border border-border p-6">
        <label
          htmlFor="api-key"
          className="mb-4 block text-xs tracking-[0.2em] uppercase text-muted-foreground"
        >
          API Key ({providerLabel})
        </label>
        <div className="relative w-full max-w-md">
          <input
            id="api-key"
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onFocus={() => {
              // Clear masked value on focus so user can type a new key
              if (apiKey.includes("...")) setApiKey("")
            }}
            placeholder={getApiKeyPlaceholder(model)}
            className="w-full border border-border bg-background px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-terminal"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
        {hasExistingKey && apiKey.includes("...") && (
          <p className="mt-2 text-[10px] text-muted-foreground/60">
            API key is saved. Click the field to enter a new one.
          </p>
        )}
      </div>

      {/* Max comments */}
      <div className="mb-8 border border-border p-6">
        <label
          htmlFor="max-comments"
          className="mb-4 block text-xs tracking-[0.2em] uppercase text-muted-foreground"
        >
          Max Comments Per Review
        </label>
        <input
          id="max-comments"
          type="number"
          min="1"
          max="50"
          value={maxComments}
          onChange={(e) => setMaxComments(Number(e.target.value))}
          className="w-24 border border-border bg-background px-3 py-2 text-sm tabular-nums text-foreground focus:outline-none focus:ring-1 focus:ring-terminal"
        />
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          Limit the number of comments per PR review to reduce noise.
        </p>
      </div>

      {/* Save */}
      <div className="mb-12 flex items-center gap-4">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="border border-terminal px-6 py-2.5 text-xs tracking-wider uppercase text-terminal transition-colors hover:bg-terminal hover:text-background disabled:pointer-events-none disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {saved && (
          <span className="text-xs text-terminal">Settings saved.</span>
        )}
      </div>

      {/* Danger zone */}
      <div className="border border-destructive/30 p-6">
        <h3 className="mb-2 text-xs tracking-[0.2em] uppercase text-destructive">
          Danger Zone
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          This will disconnect all repositories and delete all review personas.
        </p>
        <button
          type="button"
          className="border border-destructive/50 px-5 py-2 text-xs tracking-wider uppercase text-destructive transition-colors hover:border-destructive hover:bg-destructive/10"
        >
          Disconnect All Repositories
        </button>
      </div>
    </div>
  )
}
