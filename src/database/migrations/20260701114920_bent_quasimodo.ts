import type { PoolClient } from 'pg'

const sql = `ALTER TABLE "hmrcOAuthState" ADD COLUMN "nino" text NOT NULL;`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
