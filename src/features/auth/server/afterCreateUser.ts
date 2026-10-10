import { eq } from 'drizzle-orm'

import { DEMO_EMAIL } from '~/constants/app'
import { drizzle } from '~/database/db'
import { user as userTable, userPublic, userState } from '~/database/schema'
import { ensureDefaultBankAccounts } from '~/features/bankAccounts/server/ensureDefaultBankAccounts'

export async function afterCreateUser(user: { id: string; email: string }) {
  try {
    const db = drizzle
    const userId = user.id
    const email = user.email

    console.info(`[afterCreateUser] Creating user records for ${email}`)

    const existingUser = await db
      .select()
      .from(userPublic)
      .where(eq(userPublic.id, userId))
      .limit(1)

    const [userPrivate] = await db
      .select({
        name: userTable.name,
        username: userTable.username,
        image: userTable.image,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))

    if (existingUser.length === 1) {
      console.info(`[afterCreateUser] User ${email} already exists`)
      return userPrivate
    }

    if (!userPrivate) {
      console.error(`[afterCreateUser] No user data found in private table for ${email}`)
      return
    }

    const existingUserState = await db
      .select()
      .from(userState)
      .where(eq(userState.userId, userId))
      .limit(1)

    if (existingUserState.length === 0) {
      await db.insert(userState).values({
        userId,
        darkMode: false,
      })
    }

    const isDemoUser = email === DEMO_EMAIL
    const { name, username, image, createdAt } = userPrivate

    await db.insert(userPublic).values({
      id: userId,
      name: name || '',
      username: isDemoUser ? 'demo' : username || '',
      image: image || '',
      joinedAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
    })

    await ensureDefaultBankAccounts(userId)

    console.info(`[afterCreateUser] ✅ User ${email} setup complete`)
    return userPrivate
  } catch (error) {
    console.error(`[afterCreateUser] ❌ Error creating user records:`, error)
    throw error
  }
}
