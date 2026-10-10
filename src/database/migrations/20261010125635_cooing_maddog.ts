import type { PoolClient } from 'pg'

const sql = `CREATE INDEX "engineOutcome_contact_occurred_idx" ON "engineOutcome" ("contactId","occurredAt");`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
