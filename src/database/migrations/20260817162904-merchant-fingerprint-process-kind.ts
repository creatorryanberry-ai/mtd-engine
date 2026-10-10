import type { PoolClient } from 'pg'

export async function up(client: PoolClient) {
  await client.query(`
    ALTER TABLE "merchantFingerprint"
    ADD COLUMN IF NOT EXISTS "processKind" text
  `)
}
