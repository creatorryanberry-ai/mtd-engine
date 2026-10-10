import type { PoolClient } from 'pg'

const sql = `ALTER TABLE "mtdTransaction" ADD COLUMN "attachmentUrl" text;`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
