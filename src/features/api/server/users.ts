import { and, eq, ne } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import { userPublic, userState } from '~/database/schema'

export async function getUserPublicById(userId: string) {
  const rows = await drizzle
    .select()
    .from(userPublic)
    .where(eq(userPublic.id, userId))
    .limit(1)
  return rows[0] ?? null
}

export async function getUserWithState(userId: string) {
  const [user, stateRows] = await Promise.all([
    getUserPublicById(userId),
    drizzle.select().from(userState).where(eq(userState.userId, userId)).limit(1),
  ])

  const state = stateRows[0] ?? null
  if (!user && !state) return null

  return { user, state }
}

export async function validateUsername(username?: string, excludeUserId?: string) {
  if (!username) return

  if (username.length < 3) {
    throw new Error('Username must be at least 3 characters')
  }

  if (username.length > 30) {
    throw new Error('Username must be less than 30 characters')
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw new Error(
      'Username can only contain letters, numbers, underscores, and hyphens',
    )
  }

  const whereCondition = excludeUserId
    ? and(eq(userPublic.username, username), ne(userPublic.id, excludeUserId))
    : eq(userPublic.username, username)

  const existingUser = await drizzle
    .select()
    .from(userPublic)
    .where(whereCondition)
    .limit(1)

  if (existingUser.length > 0) {
    throw new Error('Username is already taken')
  }

  return true
}

export async function updateUserPublic(
  userId: string,
  patch: Partial<Pick<typeof userPublic.$inferInsert, 'name' | 'username' | 'image'>>,
) {
  const rows = await drizzle
    .update(userPublic)
    .set(patch)
    .where(eq(userPublic.id, userId))
    .returning()
  return rows[0] ?? null
}

export async function updateUserState(
  userId: string,
  patch: Partial<{ darkMode: boolean; hasOnboarded: boolean }>,
) {
  const rows = await drizzle
    .update(userState)
    .set(patch)
    .where(eq(userState.userId, userId))
    .returning()
  return rows[0] ?? null
}
