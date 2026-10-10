import type { PoolClient } from 'pg'

const sql = `CREATE TABLE "businessSettings" (
	"userId" text PRIMARY KEY,
	"businessName" text,
	"businessStartDate" text,
	"businessDescription" text,
	"businessType" text,
	"cisRegistered" boolean,
	"vehicleClaimMethod" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businessSettings" ADD CONSTRAINT "businessSettings_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
