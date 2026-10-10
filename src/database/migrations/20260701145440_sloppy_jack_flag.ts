import type { PoolClient } from 'pg'

const sql = `ALTER TABLE "userState" ADD COLUMN "hasOnboarded" boolean DEFAULT false NOT NULL;`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
