import type { PoolClient } from 'pg'

const USER_ID_TABLES = [
  'plaidItem',
  'bankAccount',
  'businessSettings',
  'userState',
  'mtdTransaction',
  'hmrcConnection',
  'hmrcOAuthState',
  'mtdSubmission',
  'mtdSubmissionJob',
  'mileageEntry',
  'categorisationRule',
  'device',
  'notification',
] as const

/**
 * Row-level security keyed by app.user_id (set per request after auth).
 * app.bypass_rls=on keeps migrations, better-auth, and privileged jobs working.
 */
export async function up(client: PoolClient) {
  for (const table of USER_ID_TABLES) {
    await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
    await client.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`)
    await client.query(`DROP POLICY IF EXISTS ${table}_isolation ON "${table}"`)
    await client.query(`
      CREATE POLICY ${table}_isolation ON "${table}"
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

  // public profile reads stay open; writes are own-row only
  await client.query(`ALTER TABLE "userPublic" ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE "userPublic" FORCE ROW LEVEL SECURITY`)
  await client.query(`DROP POLICY IF EXISTS userPublic_select ON "userPublic"`)
  await client.query(`DROP POLICY IF EXISTS userPublic_write ON "userPublic"`)
  await client.query(`
    CREATE POLICY userPublic_select ON "userPublic"
    FOR SELECT
    USING (true)
  `)
  await client.query(`
    CREATE POLICY userPublic_write ON "userPublic"
    FOR ALL
    USING (
      current_setting('app.bypass_rls', true) = 'on'
      OR id = current_setting('app.user_id', true)
    )
    WITH CHECK (
      current_setting('app.bypass_rls', true) = 'on'
      OR id = current_setting('app.user_id', true)
    )
  `)

  // join table: only via owning categorisation rule
  await client.query(
    `ALTER TABLE "categorisationRuleBankAccount" ENABLE ROW LEVEL SECURITY`,
  )
  await client.query(
    `ALTER TABLE "categorisationRuleBankAccount" FORCE ROW LEVEL SECURITY`,
  )
  await client.query(
    `DROP POLICY IF EXISTS categorisationRuleBankAccount_isolation ON "categorisationRuleBankAccount"`,
  )
  await client.query(`
    CREATE POLICY categorisationRuleBankAccount_isolation ON "categorisationRuleBankAccount"
    FOR ALL
    USING (
      current_setting('app.bypass_rls', true) = 'on'
      OR EXISTS (
        SELECT 1 FROM "categorisationRule" r
        WHERE r.id = "ruleId"
          AND r."userId" = current_setting('app.user_id', true)
      )
    )
    WITH CHECK (
      current_setting('app.bypass_rls', true) = 'on'
      OR EXISTS (
        SELECT 1 FROM "categorisationRule" r
        WHERE r.id = "ruleId"
          AND r."userId" = current_setting('app.user_id', true)
      )
    )
  `)
}
