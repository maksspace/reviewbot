"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import {
  PREDEFINED_SKILLS,
  SKILL_CATEGORIES,
  type SkillCategory,
} from "@/lib/skills-data"

export default function SkillsLibraryPage() {
  const [activeCategory, setActiveCategory] = useState<SkillCategory | "all">(
    "all"
  )

  const filtered =
    activeCategory === "all"
      ? PREDEFINED_SKILLS
      : PREDEFINED_SKILLS.filter((s) => s.category === activeCategory)

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-8 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3" />
        Back to repositories
      </Link>

      <h1 className="mb-2 text-sm tracking-wider uppercase">Skills Library</h1>
      <p className="mb-8 text-xs text-muted-foreground/60">
        Built-in review rules applied automatically during every code review
        based on the technologies in the diff. Read-only — these ship with
        ReviewBot.
      </p>

      {/* Category filter */}
      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory("all")}
          className={`border px-3 py-1.5 text-[11px] tracking-wider uppercase transition-colors ${
            activeCategory === "all"
              ? "border-terminal text-terminal"
              : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
          }`}
        >
          All ({PREDEFINED_SKILLS.length})
        </button>
        {SKILL_CATEGORIES.map((cat) => {
          const count = PREDEFINED_SKILLS.filter(
            (s) => s.category === cat.id
          ).length
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`border px-3 py-1.5 text-[11px] tracking-wider uppercase transition-colors ${
                activeCategory === cat.id
                  ? "border-terminal text-terminal"
                  : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Skills list */}
      <div className="flex flex-col gap-4">
        {filtered.map((skill) => (
          <div key={skill.id} className="border border-border p-6">
            <div className="mb-1 flex items-center gap-3">
              <h2 className="text-xs tracking-[0.2em] uppercase text-foreground">
                {skill.name}
              </h2>
              <span className="text-[10px] tracking-wider uppercase text-muted-foreground/40">
                {skill.category}
              </span>
            </div>
            <pre className="mt-3 whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
              {skill.content}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
