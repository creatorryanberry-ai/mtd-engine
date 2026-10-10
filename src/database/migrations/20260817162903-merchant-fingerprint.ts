import type { PoolClient } from 'pg'

export async function up(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "merchantFingerprint" (
      "id" text PRIMARY KEY NOT NULL,
      "userId" text NOT NULL,
      "signalType" text NOT NULL,
      "signalValue" text NOT NULL,
      "canonicalName" text NOT NULL,
      "sourceSuggestedName" text,
      "hitCount" integer DEFAULT 1 NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `)
  await client.query(
    `CREATE INDEX IF NOT EXISTS "merchantFingerprint_userId_idx" ON "merchantFingerprint" ("userId")`,
  )
  await client.query(`
    CREATE INDEX IF NOT EXISTS "merchantFingerprint_user_signal_idx"
    ON "merchantFingerprint" ("userId", "signalType", "signalValue")
  `)
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "merchantFingerprint_user_signal_unique"
    ON "merchantFingerprint" ("userId", "signalType", "signalValue")
  `)

  await client.query(`ALTER TABLE "merchantFingerprint" ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE "merchantFingerprint" FORCE ROW LEVEL SECURITY`)
  await client.query(
    `DROP POLICY IF EXISTS merchantFingerprint_isolation ON "merchantFingerprint"`,
  )
  await client.query(`
    CREATE POLICY merchantFingerprint_isolation ON "merchantFingerprint"
    FOR ALL
    USING (
      current_setting('app.bypass_rls', true) = 'on'
      OR "userId" = current_setting('app.user_id', true)
    )
    WITH CHECK (
      current_setting('app.bypass_rls', true) = 'on'
      OR "userId" = current_setting('app.user_id', true)
    )
  `)
}
