import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface CustomSkill {
  id: string
  name: string
  content: string
}

const MAX_SKILLS = 5
const MAX_CONTENT_LENGTH = 2000

// ---------------------------------------------------------------------------
// GET — list custom skills for a repo
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('connected_repositories')
    .select('custom_skills')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
  }

  return NextResponse.json({ skills: data.custom_skills ?? [] })
}

// ---------------------------------------------------------------------------
// POST — create a new custom skill
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { name, content } = body as { name?: string; content?: string }

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 })
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content exceeds ${MAX_CONTENT_LENGTH} character limit` },
      { status: 400 },
    )
  }

  // Fetch current skills
  const { data, error: fetchError } = await supabase
    .from('connected_repositories')
    .select('custom_skills')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single()

  if (fetchError || !data) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
  }

  const skills: CustomSkill[] = data.custom_skills ?? []

  if (skills.length >= MAX_SKILLS) {
    return NextResponse.json(
      { error: `Maximum ${MAX_SKILLS} custom skills per project` },
      { status: 400 },
    )
  }

  const newSkill: CustomSkill = {
    id: crypto.randomUUID(),
    name: name.trim(),
    content: content.trim(),
  }

  skills.push(newSkill)

  const { error: updateError } = await supabase
    .from('connected_repositories')
    .update({ custom_skills: skills })
    .eq('user_id', user.id)
    .eq('slug', slug)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, skill: newSkill })
}

// ---------------------------------------------------------------------------
// PUT — update an existing custom skill
// ---------------------------------------------------------------------------

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, name, content } = body as { id?: string; name?: string; content?: string }

  if (!id) {
    return NextResponse.json({ error: 'Skill id is required' }, { status: 400 })
  }
  if (content && content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Content exceeds ${MAX_CONTENT_LENGTH} character limit` },
      { status: 400 },
    )
  }

  // Fetch current skills
  const { data, error: fetchError } = await supabase
    .from('connected_repositories')
    .select('custom_skills')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single()

  if (fetchError || !data) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
  }

  const skills: CustomSkill[] = data.custom_skills ?? []
  const idx = skills.findIndex((s) => s.id === id)

  if (idx === -1) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
  }

  if (name?.trim()) skills[idx].name = name.trim()
  if (content !== undefined) skills[idx].content = content.trim()

  const { error: updateError } = await supabase
    .from('connected_repositories')
    .update({ custom_skills: skills })
    .eq('user_id', user.id)
    .eq('slug', slug)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// DELETE — remove a custom skill
// ---------------------------------------------------------------------------

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id } = body as { id?: string }

  if (!id) {
    return NextResponse.json({ error: 'Skill id is required' }, { status: 400 })
  }

  // Fetch current skills
  const { data, error: fetchError } = await supabase
    .from('connected_repositories')
    .select('custom_skills')
    .eq('user_id', user.id)
    .eq('slug', slug)
    .single()

  if (fetchError || !data) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 })
  }

  const skills: CustomSkill[] = data.custom_skills ?? []
  const filtered = skills.filter((s) => s.id !== id)

  if (filtered.length === skills.length) {
    return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
  }

  const { error: updateError } = await supabase
    .from('connected_repositories')
    .update({ custom_skills: filtered })
    .eq('user_id', user.id)
    .eq('slug', slug)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
