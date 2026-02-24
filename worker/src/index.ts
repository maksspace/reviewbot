import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { readMessage, deleteMessage, readWebhookMessage, deleteWebhookMessage } from './queue.js'
import { analyzeRepo } from './analyze.js'
import { reviewPR } from './review.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS ?? 5000)

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)

console.log('[worker] reviewbot-worker started')
console.log(`[worker] polling repo_analysis + webhook_events queues every ${POLL_INTERVAL}ms`)

async function poll() {
  const msg = await readMessage(supabase)

  if (!msg) return

  console.log(`[worker] picked up message #${msg.msg_id}: ${msg.message.slug}`)

  try {
    await analyzeRepo(supabase, msg.message)
    await deleteMessage(supabase, msg.msg_id)
  } catch (err) {
    console.error(`[worker] error processing ${msg.message.slug}:`, err)
    // Message will become visible again after visibility timeout expires
  }
}

async function pollWebhooks() {
  const msg = await readWebhookMessage(supabase)

  if (!msg) return

  const { event_type, repo_slug, pr_number, pr_title, pr_author } = msg.message
  console.log(`[worker] webhook #${msg.msg_id}: ${event_type} on ${repo_slug} — PR #${pr_number} "${pr_title}" by ${pr_author}`)

  // Give up after 3 retries
  if (msg.read_ct > 3) {
    console.error(`[worker] webhook #${msg.msg_id} failed ${msg.read_ct} times, giving up`)
    await deleteWebhookMessage(supabase, msg.msg_id)
    return
  }

  try {
    if (event_type === 'pr_opened' || event_type === 'pr_updated') {
      await reviewPR(supabase, msg.message)
    } else {
      console.log(`[worker] skipping ${event_type} event`)
    }
    await deleteWebhookMessage(supabase, msg.msg_id)
  } catch (err) {
    console.error(`[worker] error processing webhook for ${repo_slug}:`, err)
    // Message will become visible again after visibility timeout expires (5 min)
  }
}

// Poll loop
async function run() {
  while (true) {
    try {
      await poll()
      await pollWebhooks()
    } catch (err) {
      console.error('[worker] poll error:', err)
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL))
  }
}

run()
