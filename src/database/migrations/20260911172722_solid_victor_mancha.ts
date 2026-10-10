import type { PoolClient } from 'pg'

const sql = `ALTER TABLE "plaidItem" RENAME TO "bankLinkItem";--> statement-breakpoint
ALTER TABLE "bankAccount" RENAME COLUMN "plaidItemId" TO "bankLinkItemId";--> statement-breakpoint
ALTER TABLE "bankAccount" RENAME COLUMN "plaidAccountId" TO "externalAccountId";--> statement-breakpoint
ALTER TABLE "bankLinkItem" RENAME COLUMN "plaidItemId" TO "externalItemId";--> statement-breakpoint
ALTER TABLE "mtdTransaction" RENAME COLUMN "plaidTransactionId" TO "externalTransactionId";--> statement-breakpoint
ALTER INDEX "bankAccount_plaidItemId_idx" RENAME TO "bankAccount_bankLinkItemId_idx";--> statement-breakpoint
ALTER INDEX "bankAccount_user_plaid_account_idx" RENAME TO "bankAccount_user_external_account_idx";--> statement-breakpoint
ALTER INDEX "mtdTransaction_user_plaid_tx_idx" RENAME TO "mtdTransaction_user_external_tx_idx";`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
