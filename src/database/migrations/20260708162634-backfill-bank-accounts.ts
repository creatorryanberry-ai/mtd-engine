import type { PoolClient } from 'pg'

const sql = `
INSERT INTO "bankAccount" (
  "id",
  "userId",
  "plaidItemId",
  "plaidAccountId",
  "institutionName",
  "accountName",
  "lastSyncedAt",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  pi."userId",
  pi."id",
  'legacy-' || pi."id",
  pi."institutionName",
  COALESCE(
    (
      SELECT t."accountName"
      FROM "mtdTransaction" t
      WHERE t."userId" = pi."userId"
        AND t."accountName" IS NOT NULL
      GROUP BY t."accountName"
      ORDER BY COUNT(*) DESC
      LIMIT 1
    ),
    pi."institutionName",
    'Business account'
  ),
  pi."lastSyncedAt",
  NOW(),
  NOW()
FROM "plaidItem" pi
WHERE NOT EXISTS (
  SELECT 1 FROM "bankAccount" ba WHERE ba."plaidItemId" = pi."id"
);
--> statement-breakpoint
UPDATE "mtdTransaction" t
SET "bankAccountId" = ba."id"
FROM "bankAccount" ba
INNER JOIN "plaidItem" pi ON pi."id" = ba."plaidItemId"
WHERE t."userId" = ba."userId"
  AND t."bankAccountId" IS NULL
  AND (
    t."accountName" IS NULL
    OR t."accountName" = ba."accountName"
    OR ba."plaidAccountId" = 'legacy-' || pi."id"
  );
`

export async function up(client: PoolClient) {
  for (const stmt of sql.split('--> statement-breakpoint')) {
    const trimmed = stmt.trim()
    if (trimmed) await client.query(trimmed)
  }
}
