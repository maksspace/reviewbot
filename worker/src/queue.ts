import type { SupabaseClient } from '@supabase/supabase-js'

export interface QueueMessage<T = unknown> {
  msg_id: number
  read_ct: number
  enqueued_at: string
  vt: string
  message: T
}

export interface RepoAnalysisPayload {
  user_id: string
  slug: string
  name: string
  provider: string
}

const ANALYSIS_QUEUE = 'repo_analysis'
const WEBHOOK_QUEUE = 'webhook_events'
const VISIBILITY_TIMEOUT = 60 // seconds — how long the message is hidden from other consumers
const WEBHOOK_VISIBILITY_TIMEOUT = 300 // 5 minutes — LLM review calls take longer

export async function readMessage(
  supabase: SupabaseClient
): Promise<QueueMessage<RepoAnalysisPayload> | null> {
  const { data, error } = await supabase.schema('pgmq_public').rpc('read', {
    queue_name: ANALYSIS_QUEUE,
    sleep_seconds: VISIBILITY_TIMEOUT,
    n: 1,
  })

  if (error) {
    console.error('[queue] read error:', error.message)
    return null
  }

  if (!data || data.length === 0) return null
  return data[0] as QueueMessage<RepoAnalysisPayload>
}

export async function deleteMessage(
  supabase: SupabaseClient,
  msgId: number
): Promise<void> {
  const { error } = await supabase.schema('pgmq_public').rpc('delete', {
    queue_name: ANALYSIS_QUEUE,
    message_id: msgId,
  })

  if (error) {
    console.error('[queue] delete error:', error.message)
  }
}

// ---------------------------------------------------------------------------
// Webhook events queue
// ---------------------------------------------------------------------------

export interface WebhookEventPayload {
  repo_slug: string
  repo_name: string
  provider: 'github' | 'gitlab'
  event_type: 'pr_opened' | 'pr_updated' | 'pr_closed' | 'pr_reopened'
  pr_number: number
  pr_title: string
  pr_url: string
  pr_author: string
  base_branch: string
  head_branch: string
  action: string
  user_id: string
  received_at: string
}

export async function readWebhookMessage(
  supabase: SupabaseClient
): Promise<QueueMessage<WebhookEventPayload> | null> {
  const { data, error } = await supabase.schema('pgmq_public').rpc('read', {
    queue_name: WEBHOOK_QUEUE,
    sleep_seconds: WEBHOOK_VISIBILITY_TIMEOUT,
    n: 1,
  })

  if (error) {
    console.error('[queue] webhook read error:', error.message)
    return null
  }

  if (!data || data.length === 0) return null
  return data[0] as QueueMessage<WebhookEventPayload>
}

export async function deleteWebhookMessage(
  supabase: SupabaseClient,
  msgId: number
): Promise<void> {
  const { error } = await supabase.schema('pgmq_public').rpc('delete', {
    queue_name: WEBHOOK_QUEUE,
    message_id: msgId,
  })

  if (error) {
    console.error('[queue] webhook delete error:', error.message)
  }
}
