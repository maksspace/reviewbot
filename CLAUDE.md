# ReviewBot (reviewbot.sh)

AI code review bot that learns how your team reviews code. Works with GitHub and GitLab, powered by Claude and GPT.

## Quick Reference

```
pnpm dev         # Start dev server
pnpm build       # Production build
pnpm lint        # ESLint
```

## Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19 + TypeScript 5.7
- **Auth**: Supabase Auth (`@supabase/ssr`) — GitHub/GitLab OAuth, self-hosted at `supabase.reviewbot.sh`
- **Styling**: Tailwind CSS v4 + CSS custom properties (OKLCH color space)
- **UI Library**: Shadcn UI (new-york style) — 80+ components in `components/ui/`
- **Font**: JetBrains Mono (monospace-first aesthetic, variable `--font-jetbrains`)
- **Icons**: Lucide React (use sparingly)
- **Forms**: react-hook-form + zod
- **Analytics**: Vercel Analytics, Recharts for charts

## Design System

Dark, minimal, developer/console aesthetic:

- Background: `#0a0a0a` (theme color)
- Accent: terminal green `#00ff41` — sparingly for CTAs, active states, status dots
- Secondary text: `#666`, muted: `#444`
- Borders: `1px solid #1a1a1a` or `#222`
- No gradients, no rounded cards, no shadows, no illustrations, no emojis in UI
- Monospace for headlines, code blocks, UI chrome; sans-serif for body text only
- Uppercase letter-spaced labels for section headers
- CSS variables defined in `styles/globals.css` (OKLCH format, light + `.dark` variants)
- Radius base: `0.625rem`

## Project Structure

```
app/
  layout.tsx              # Root: JetBrains Mono, Analytics
  page.tsx                # Landing page (/, marketing)
  globals.css             # -> symlink/import to styles/globals.css
  login/
    page.tsx              # OAuth login (GitHub/GitLab via Supabase)
  auth/
    callback/route.ts     # Supabase PKCE code exchange
  dashboard/
    layout.tsx            # Dashboard shell with DashboardHeader
    page.tsx              # Repository list (RepoTable)
    settings/page.tsx     # Global settings (LLM, API key, webhooks)
    [repo]/
      page.tsx            # Repo detail (tabs: Overview/Interview/Persona/Activity)
      interview/
        layout.tsx        # Full-screen overlay wrapper
        page.tsx          # Typeform-style interview questionnaire

components/
  navbar.tsx              # Landing page nav
  dashboard-header.tsx    # Dashboard nav with user dropdown
  hero.tsx                # Hero section + terminal animation
  how-it-works.tsx        # 3-step feature section
  why-reviewbot.tsx       # Benefits/comparison section
  pricing.tsx             # Pricing card
  footer.tsx              # Minimal footer
  repo-table.tsx          # Dashboard repo list with mock data
  status-badge.tsx        # Status dots (active/setup/analyzing/paused)
  persona-viewer.tsx      # Review persona markdown display
  activity-feed.tsx       # Review activity log
  chat-interface.tsx      # Chat UI component
  terminal-animation.tsx  # Typing animation for hero
  reviewbot-logo.tsx      # SVG logo (">_" symbol)
  theme-provider.tsx      # next-themes wrapper
  ui/                     # Shadcn components (do NOT edit manually)

hooks/
  use-mobile.ts           # Mobile detection hook
  use-toast.ts            # Toast notification hook

lib/
  utils.ts                # cn() utility (clsx + tailwind-merge)
  supabase/
    client.ts             # Browser Supabase client (createBrowserClient)
    server.ts             # Server Supabase client (createServerClient)

styles/
  globals.css             # Tailwind imports + CSS variables (theme)

proxy.ts                  # Supabase auth proxy (protects /dashboard/*, refreshes sessions)
```

## Architecture Notes

### Auth Flow
`/login` -> GitHub/GitLab OAuth -> `/auth/callback` (PKCE code exchange) -> `/dashboard`

Protected routes: all `/dashboard(.*)` via Supabase proxy in `proxy.ts`.

Supabase clients: `createClient()` from `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server).

User data from OAuth: `user.email`, `user.user_metadata.avatar_url`, `user.user_metadata.full_name`.

Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Do NOT use legacy anon keys.

### State Management
- No external state library — React `useState` only
- Server Components by default, `"use client"` for interactive pages
- All data is currently **mock data** (arrays in component files)
- No API routes exist yet — frontend-only MVP

### Interview System (`/dashboard/[repo]/interview/page.tsx`)
Multi-phase flow: `questions` -> `completion` -> `bonus` -> `done`

Question types: single-select, multi-select, code-opinion (code snippet + options), slider, text input.

State: `currentIndex`, `answers`, `categories`, `phase`, `animating`, `generatingProgress`.

### Key Patterns
- Path alias: `@/*` maps to project root
- Shadcn config: `components.json` (new-york style, lucide icons, rsc: true)
- `next.config.mjs`: `typescript.ignoreBuildErrors: true`, `images.unoptimized: true`
- Fonts loaded via `next/font/google` (JetBrains Mono)
- Dark mode via `.dark` class + `next-themes`

## Conventions

- Keep it minimal. No over-engineering. MVP mindset.
- If it can be a div with monospace text instead of a complex component, do that.
- No emojis in UI.
- Terminal/console aesthetic — code blocks, monospace labels, ASCII-style elements.
- Generous whitespace.
- All interactive elements need visible focus states.
- Subtle fade-in animations only. Terminal typing animation on hero only.
- Interview transitions should be smooth slide (Typeform-like).

## Original V0 Prompt

The app was scaffolded from a V0 prompt. Key design references: blacksmith.sh, opencode.ai.

Pages specified: Landing (/), Login (/login), Dashboard (/dashboard), Repo Setup (/dashboard/[repo]/setup), Interview (/dashboard/[repo]/interview), Repo Detail (/dashboard/[repo]), Global Settings (/dashboard/settings).

Key components specified: `<TerminalBlock />`, `<InterviewQuestion />`, `<InterviewProgress />`, `<RepoTable />`, `<StatusDot />`, `<PersonaViewer />`, `<ConsensusBar />`, `<ActivityFeed />`, `<CodeBlock />`.
