import { eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { device } from '~/database/schema'

export async function upsertDevice(userId: string, row: typeof device.$inferInsert) {
  const existing = await drizzle
    .select()
    .from(device)
    .where(eq(device.id, row.id))
    .limit(1)

  if (existing[0]) {
    const rows = await drizzle
      .update(device)
      .set({ ...row, userId, updatedAt: new Date().toISOString() })
      .where(eq(device.id, row.id))
      .returning()
    return rows[0]
  }

  const rows = await drizzle
    .insert(device)
    .values({ ...row, userId })
    .returning()
  return rows[0]
}

export async function updateDevice(
  userId: string,
  id: string,
  patch: Partial<typeof device.$inferInsert>,
) {
  const rows = await drizzle
    .update(device)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(device.id, id))
    .returning()
  if (rows[0]?.userId !== userId) return null
  return rows[0]
}
