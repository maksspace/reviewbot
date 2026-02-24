// ---------------------------------------------------------------------------
// Shared configuration — env vars with sensible defaults
// ---------------------------------------------------------------------------

/** Docker image used by testcontainers for analysis + review containers */
export const ANALYZER_IMAGE = process.env.ANALYZER_IMAGE ?? 'reviewbot-analyzer'
