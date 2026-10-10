import { and, desc, eq } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { notification } from '~/database/schema'

export async function listNotifications(userId: string, pageSize = 50) {
  return drizzle
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(pageSize)
}

export async function listUnreadNotifications(userId: string) {
  return drizzle
    .select()
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.read, false)))
    .orderBy(desc(notification.createdAt))
}

export async function countUnreadNotifications(userId: string) {
  const rows = await drizzle
    .select()
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.read, false)))
  return rows.length
}

export async function updateNotification(
  userId: string,
  id: string,
  patch: Partial<{ read: boolean }>,
) {
  const rows = await drizzle
    .update(notification)
    .set(patch)
    .where(and(eq(notification.id, id), eq(notification.userId, userId)))
    .returning()
  return rows[0] ?? null
}
