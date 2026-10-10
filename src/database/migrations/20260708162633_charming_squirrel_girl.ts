import type { PoolClient } from 'pg'

const sql = `CREATE TABLE "bankAccount" (
	"id" text PRIMARY KEY,
	"userId" text NOT NULL,
	"plaidItemId" text NOT NULL,
	"plaidAccountId" text NOT NULL,
	"institutionName" text,
	"accountName" text,
	"sortCode" text,
	"accountNumber" text,
	"accountType" text,
	"balance" real,
	"currency" text,
	"lastSyncedAt" timestamp,
	"syncError" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plaidItem" DROP CONSTRAINT "plaidItem_userId_key";--> statement-breakpoint
ALTER TABLE "mtdTransaction" ADD COLUMN "bankAccountId" text;--> statement-breakpoint
CREATE INDEX "bankAccount_userId_idx" ON "bankAccount" ("userId");--> statement-breakpoint
CREATE INDEX "bankAccount_plaidItemId_idx" ON "bankAccount" ("plaidItemId");--> statement-breakpoint
CREATE UNIQUE INDEX "bankAccount_user_plaid_account_idx" ON "bankAccount" ("userId","plaidAccountId");--> statement-breakpoint
CREATE INDEX "mtdTransaction_bankAccountId_idx" ON "mtdTransaction" ("bankAccountId");--> statement-breakpoint
ALTER TABLE "bankAccount" ADD CONSTRAINT "bankAccount_userId_user_id_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bankAccount" ADD CONSTRAINT "bankAccount_plaidItemId_plaidItem_id_fkey" FOREIGN KEY ("plaidItemId") REFERENCES "plaidItem"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "mtdTransaction" ADD CONSTRAINT "mtdTransaction_bankAccountId_bankAccount_id_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bankAccount"("id") ON DELETE SET NULL;`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
