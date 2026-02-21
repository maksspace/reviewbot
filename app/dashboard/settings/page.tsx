"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Eye, EyeOff, Copy, Check } from "lucide-react"

export default function SettingsPage() {
  const [provider, setProvider] = useState("claude")
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [maxComments, setMaxComments] = useState(10)
  const [copied, setCopied] = useState(false)

  const webhookUrl = "https://reviewbot.app/webhook/acme/f8a2k9x"

  function handleCopy() {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

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
        Configure your LLM provider and review preferences.
      </p>

      {/* LLM Provider */}
      <div className="mb-8 border border-border p-6">
        <label
          htmlFor="llm-provider"
          className="mb-4 block text-xs tracking-[0.2em] uppercase text-muted-foreground"
        >
          LLM Provider
        </label>
        <select
          id="llm-provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="w-full max-w-xs border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-terminal"
        >
          <option value="claude">Claude (Anthropic)</option>
          <option value="gpt">GPT (OpenAI)</option>
        </select>
      </div>

      {/* API Key */}
      <div className="mb-8 border border-border p-6">
        <label
          htmlFor="api-key"
          className="mb-4 block text-xs tracking-[0.2em] uppercase text-muted-foreground"
        >
          API Key ({provider === "claude" ? "Anthropic" : "OpenAI"})
        </label>
        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-md">
            <input
              id="api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                provider === "claude" ? "sk-ant-..." : "sk-..."
              }
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
        </div>
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

      {/* Webhook URL */}
      <div className="mb-8 border border-border p-6">
        <div className="mb-4 text-xs tracking-[0.2em] uppercase text-muted-foreground">
          Webhook URL
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
            {webhookUrl}
          </code>
          <button
            type="button"
            onClick={handleCopy}
            className="border border-border p-2 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            aria-label="Copy webhook URL"
          >
            {copied ? (
              <Check className="size-4 text-terminal" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground/60">
          Configure this URL in your repository webhook settings for manual setup.
        </p>
      </div>

      {/* Save */}
      <div className="mb-12">
        <button
          type="button"
          className="border border-terminal px-6 py-2.5 text-xs tracking-wider uppercase text-terminal transition-colors hover:bg-terminal hover:text-background"
        >
          Save Settings
        </button>
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
