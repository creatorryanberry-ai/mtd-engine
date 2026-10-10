import { and, desc, eq, gte } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { mtdTransaction } from '~/database/schema'
import { getWindowStartDate } from '~/features/bankAccounts/constants'

export async function listMtdTransactions(props: {
  userId: string
  limit?: number
  syncStartDate?: string
}) {
  const syncStartDate = props.syncStartDate ?? getWindowStartDate()
  return drizzle
    .select()
    .from(mtdTransaction)
    .where(
      and(
        eq(mtdTransaction.userId, props.userId),
        gte(mtdTransaction.date, syncStartDate),
      ),
    )
    .orderBy(desc(mtdTransaction.date))
    .limit(props.limit ?? 50)
}

export async function updateMtdTransaction(
  userId: string,
  id: string,
  patch: Partial<typeof mtdTransaction.$inferInsert>,
) {
  const rows = await drizzle
    .update(mtdTransaction)
    .set(patch)
    .where(and(eq(mtdTransaction.id, id), eq(mtdTransaction.userId, userId)))
    .returning()
  return rows[0] ?? null
}
