import type { PoolClient } from 'pg'

const sql = `ALTER TABLE "engineExperiment" ADD COLUMN "channelKey" text;--> statement-breakpoint
ALTER TABLE "engineExperiment" ADD COLUMN "audience" jsonb DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "engineMetricsDaily" ADD COLUMN "platformConversions" integer;--> statement-breakpoint
ALTER TABLE "engineMetricsDaily" ADD COLUMN "platformRevenueMinor" integer;--> statement-breakpoint
ALTER TABLE "engineWorkspace" ADD COLUMN "globalHoldoutRate" real DEFAULT 0.05 NOT NULL;`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
