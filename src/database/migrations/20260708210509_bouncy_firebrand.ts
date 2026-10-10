import type { PoolClient } from 'pg'

const sql = `CREATE TABLE "categorisationRuleBankAccount" (
	"ruleId" text,
	"bankAccountId" text,
	CONSTRAINT "categorisationRuleBankAccount_pkey" PRIMARY KEY("ruleId","bankAccountId")
);
--> statement-breakpoint
CREATE INDEX "categorisationRuleBankAccount_bankAccountId_idx" ON "categorisationRuleBankAccount" ("bankAccountId");--> statement-breakpoint
ALTER TABLE "categorisationRuleBankAccount" ADD CONSTRAINT "categorisationRuleBankAccount_ruleId_categorisationRule_id_fkey" FOREIGN KEY ("ruleId") REFERENCES "categorisationRule"("id") ON DELETE CASCADE;`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
