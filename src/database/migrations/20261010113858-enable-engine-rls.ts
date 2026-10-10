import type { PoolClient } from 'pg'

/** every engine table scoped by workspaceId (engineWorkspace itself is keyed by id) */
const WORKSPACE_TABLES = [
  'engineBrand',
  'engineBrandKit',
  'engineCompany',
  'engineContact',
  'engineIdentity',
  'engineConsent',
  'engineSegment',
  'engineProduct',
  'engineDeal',
  'engineOrder',
  'engineChannel',
  'engineConnection',
  'engineOAuthState',
  'engineCampaign',
  'engineJourney',
  'engineJourneyStep',
  'engineAsset',
  'engineAssetVariant',
  'engineAssetFeature',
  'engineProviderJob',
  'engineExperiment',
  'engineExperimentArm',
  'engineAssignment',
  'engineEvent',
  'engineOutcome',
  'engineMetricsDaily',
  'engineHypothesis',
  'engineLearning',
  'engineLearningEvidence',
  'engineModelRegistry',
  'enginePrediction',
  'engineAutonomySettings',
  'engineGuardrail',
  'engineApproval',
  'engineLlmCall',
] as const

const bypass = `current_setting('app.bypass_rls', true) = 'on'`

/** a row is visible when the acting user holds a membership in its workspace */
function memberOf(column: string) {
  return `EXISTS (
    SELECT 1 FROM "engineMembership" m
    WHERE m."workspaceId" = ${column}
      AND m."userId" = current_setting('app.user_id', true)
  )`
}

/**
 * Workspace tenancy enforced in Postgres. app.user_id is set per request after
 * auth; app.bypass_rls=on is used by migrations and workers before they know
 * the workspace. The membership table's own policy is user-keyed, so the EXISTS
 * subqueries above never recurse.
 */
export async function up(client: PoolClient) {
  await client.query(`ALTER TABLE "engineMembership" ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE "engineMembership" FORCE ROW LEVEL SECURITY`)
  await client.query(
    `DROP POLICY IF EXISTS engineMembership_isolation ON "engineMembership"`,
  )
  await client.query(`
    CREATE POLICY engineMembership_isolation ON "engineMembership"
    FOR ALL
    USING (${bypass} OR "userId" = current_setting('app.user_id', true))
    WITH CHECK (${bypass} OR "userId" = current_setting('app.user_id', true))
  `)

  await client.query(`ALTER TABLE "engineWorkspace" ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE "engineWorkspace" FORCE ROW LEVEL SECURITY`)
  await client.query(
    `DROP POLICY IF EXISTS engineWorkspace_isolation ON "engineWorkspace"`,
  )
  await client.query(`
    CREATE POLICY engineWorkspace_isolation ON "engineWorkspace"
    FOR ALL
    USING (${bypass} OR ${memberOf('"engineWorkspace"."id"')})
    WITH CHECK (${bypass} OR ${memberOf('"engineWorkspace"."id"')})
  `)

  for (const table of WORKSPACE_TABLES) {
    const column = `"${table}"."workspaceId"`
    await client.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
    await client.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`)
    await client.query(`DROP POLICY IF EXISTS ${table}_isolation ON "${table}"`)
    await client.query(`
      CREATE POLICY ${table}_isolation ON "${table}"
      FOR ALL
      USING (${bypass} OR ${memberOf(column)})
      WITH CHECK (${bypass} OR ${memberOf(column)})
    `)
  }

  // audit log is append-only: select + insert only, no update/delete policy exists
  await client.query(`ALTER TABLE "engineAuditLog" ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE "engineAuditLog" FORCE ROW LEVEL SECURITY`)
  await client.query(`DROP POLICY IF EXISTS engineAuditLog_select ON "engineAuditLog"`)
  await client.query(`DROP POLICY IF EXISTS engineAuditLog_insert ON "engineAuditLog"`)
  await client.query(`
    CREATE POLICY engineAuditLog_select ON "engineAuditLog"
    FOR SELECT
    USING (${bypass} OR ${memberOf('"engineAuditLog"."workspaceId"')})
  `)
  await client.query(`
    CREATE POLICY engineAuditLog_insert ON "engineAuditLog"
    FOR INSERT
    WITH CHECK (${bypass} OR ${memberOf('"engineAuditLog"."workspaceId"')})
  `)
}
