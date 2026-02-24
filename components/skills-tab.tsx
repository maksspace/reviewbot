"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Loader2, Pencil, Trash2, Plus, ArrowRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

interface CustomSkill {
  id: string
  name: string
  content: string
}

const MAX_SKILLS = 5
const MAX_CONTENT = 2000

export function SkillsTab({ slug }: { slug: string }) {
  const [skills, setSkills] = useState<CustomSkill[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<CustomSkill | null>(null)
  const [formName, setFormName] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formError, setFormError] = useState("")

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch(`/api/repos/${slug}/custom-skills`)
      if (res.ok) {
        const data = await res.json()
        setSkills(data.skills ?? [])
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

  function openAdd() {
    setEditingSkill(null)
    setFormName("")
    setFormContent("")
    setFormError("")
    setDialogOpen(true)
  }

  function openEdit(skill: CustomSkill) {
    setEditingSkill(skill)
    setFormName(skill.name)
    setFormContent(skill.content)
    setFormError("")
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!formName.trim()) {
      setFormError("Name is required")
      return
    }
    if (!formContent.trim()) {
      setFormError("Content is required")
      return
    }
    if (formContent.length > MAX_CONTENT) {
      setFormError(`Content exceeds ${MAX_CONTENT} character limit`)
      return
    }

    setSaving(true)
    setFormError("")

    try {
      const isEdit = !!editingSkill
      const res = await fetch(`/api/repos/${slug}/custom-skills`, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? { id: editingSkill.id, name: formName.trim(), content: formContent.trim() }
            : { name: formName.trim(), content: formContent.trim() }
        ),
      })

      if (!res.ok) {
        const data = await res.json()
        setFormError(data.error || "Failed to save")
        return
      }

      setDialogOpen(false)
      await fetchSkills()
    } catch {
      setFormError("Network error")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/repos/${slug}/custom-skills`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })

    if (res.ok) {
      setSkills((prev) => prev.filter((s) => s.id !== id))
    }
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground">
        Loading...
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Custom skills section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs tracking-[0.2em] uppercase text-muted-foreground">
            Custom Skills ({skills.length}/{MAX_SKILLS})
          </h3>
          <button
            onClick={openAdd}
            disabled={skills.length >= MAX_SKILLS}
            className="inline-flex items-center gap-1.5 border border-terminal px-3 py-1.5 text-[11px] tracking-wider uppercase text-terminal transition-colors hover:bg-terminal hover:text-background disabled:pointer-events-none disabled:opacity-40"
          >
            <Plus className="size-3" />
            Add Skill
          </button>
        </div>

        <p className="mb-6 text-xs text-muted-foreground/60">
          Add team-specific review rules the bot can't know about. Write rules the
          way you'd write a review comment — short, direct, one rule per line.
        </p>

        {skills.length === 0 ? (
          <div className="border border-dashed border-border px-6 py-10 text-center text-xs text-muted-foreground">
            No custom skills yet. Add rules specific to your project.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {skills.map((skill) => (
              <div key={skill.id} className="border border-border p-4">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <span className="text-xs font-medium text-foreground">
                    {skill.name}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      onClick={() => openEdit(skill)}
                      className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Pencil className="size-3" />
                    </button>
                    <button
                      onClick={() => handleDelete(skill.id)}
                      className="text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground font-mono">
                  {skill.content.length > 300
                    ? skill.content.slice(0, 300) + "..."
                    : skill.content}
                </pre>
                <div className="mt-2 text-[10px] tabular-nums text-muted-foreground/40">
                  {skill.content.length} / {MAX_CONTENT}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Predefined skills link */}
      <div className="border-t border-border pt-6">
        <h3 className="mb-2 text-xs tracking-[0.2em] uppercase text-muted-foreground">
          Predefined Skills
        </h3>
        <p className="mb-3 text-xs text-muted-foreground/60">
          ReviewBot ships with built-in review rules for 25+ technologies. They're
          applied automatically based on the code in each diff.
        </p>
        <Link
          href="/dashboard/skills"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-terminal"
        >
          Browse skills library
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border bg-background sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-normal tracking-wider uppercase">
              {editingSkill ? "Edit Skill" : "Add Custom Skill"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div>
              <label className="mb-1.5 block text-[11px] tracking-wider uppercase text-muted-foreground">
                Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Billing Domain Rules"
                className="w-full border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-terminal focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] tracking-wider uppercase text-muted-foreground">
                Rules (markdown)
              </label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder={"- Stripe webhook handlers must be idempotent\n- All billing mutations go through BillingService\n- Log every payment state transition"}
                rows={10}
                className="w-full border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-terminal focus:outline-none"
              />
              <div className="mt-1 text-right text-[10px] tabular-nums text-muted-foreground/40">
                {formContent.length} / {MAX_CONTENT}
              </div>
            </div>

            {formError && (
              <p className="text-[11px] text-destructive">{formError}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setDialogOpen(false)}
              className="border border-border px-4 py-2 text-[11px] tracking-wider uppercase text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 border border-terminal px-4 py-2 text-[11px] tracking-wider uppercase text-terminal transition-colors hover:bg-terminal hover:text-background disabled:pointer-events-none disabled:opacity-50"
            >
              {saving && <Loader2 className="size-3 animate-spin" />}
              {editingSkill ? "Save" : "Add"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
