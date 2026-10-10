import type { PoolClient } from 'pg'

export async function up(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "mileageSeries" (
      "id" text PRIMARY KEY NOT NULL,
      "userId" text NOT NULL,
      "fromLocation" text,
      "journeyDetails" text NOT NULL,
      "milesPerJourney" real NOT NULL,
      "includesReturnJourney" boolean DEFAULT false NOT NULL,
      "recurrenceType" text NOT NULL,
      "selectedWeekdays" text DEFAULT '[]' NOT NULL,
      "startDate" text NOT NULL,
      "endDate" text NOT NULL,
      "excludedDates" text DEFAULT '[]' NOT NULL,
      "deletedDates" text DEFAULT '[]' NOT NULL,
      "active" boolean DEFAULT true NOT NULL,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `)
  await client.query(
    `CREATE INDEX IF NOT EXISTS "mileageSeries_userId_idx" ON "mileageSeries" ("userId")`,
  )

  await client.query(
    `ALTER TABLE "mileageEntry" ADD COLUMN IF NOT EXISTS "seriesId" text`,
  )
  await client.query(
    `ALTER TABLE "mileageEntry" ADD COLUMN IF NOT EXISTS "seriesOverride" boolean DEFAULT false NOT NULL`,
  )
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'mileageEntry_seriesId_mileageSeries_id_fk'
      ) THEN
        ALTER TABLE "mileageEntry"
          ADD CONSTRAINT "mileageEntry_seriesId_mileageSeries_id_fk"
          FOREIGN KEY ("seriesId") REFERENCES "mileageSeries"("id") ON DELETE SET NULL;
      END IF;
    END $$
  `)
  await client.query(
    `CREATE INDEX IF NOT EXISTS "mileageEntry_seriesId_idx" ON "mileageEntry" ("seriesId")`,
  )

  await client.query(`ALTER TABLE "mileageSeries" ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE "mileageSeries" FORCE ROW LEVEL SECURITY`)
  await client.query(`DROP POLICY IF EXISTS mileageSeries_isolation ON "mileageSeries"`)
  await client.query(`
    CREATE POLICY mileageSeries_isolation ON "mileageSeries"
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
