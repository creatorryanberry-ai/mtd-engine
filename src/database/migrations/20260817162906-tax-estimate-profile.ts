import type { PoolClient } from 'pg'

export async function up(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "taxEstimateProfile" (
      "id" text PRIMARY KEY NOT NULL,
      "userId" text NOT NULL,
      "taxYearStart" text NOT NULL,
      "answersJson" text DEFAULT '{}' NOT NULL,
      "useProjection" boolean DEFAULT true NOT NULL,
      "jurisdiction" text DEFAULT 'england' NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `)
  await client.query(
    `CREATE INDEX IF NOT EXISTS "taxEstimateProfile_userId_idx" ON "taxEstimateProfile" ("userId")`,
  )
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "taxEstimateProfile_user_tax_year_idx"
    ON "taxEstimateProfile" ("userId", "taxYearStart")
  `)

  await client.query(`ALTER TABLE "taxEstimateProfile" ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE "taxEstimateProfile" FORCE ROW LEVEL SECURITY`)
  await client.query(
    `DROP POLICY IF EXISTS taxEstimateProfile_isolation ON "taxEstimateProfile"`,
  )
  await client.query(`
    CREATE POLICY taxEstimateProfile_isolation ON "taxEstimateProfile"
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
