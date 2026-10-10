import { AsyncLocalStorage } from 'node:async_hooks'

export type DbUserContext = {
  userId: string | null
  bypassRls: boolean
}

const storage = new AsyncLocalStorage<DbUserContext>()

/** default: bypass on so migrations, auth, and workers without context keep working */
export function getDbUserContext(): DbUserContext {
  return storage.getStore() ?? { userId: null, bypassRls: true }
}

/** bind the rest of this async request/job to a user for RLS */
export function enterUserDbContext(userId: string) {
  storage.enterWith({ userId, bypassRls: false })
}

export function enterBypassRlsContext() {
  storage.enterWith({ userId: null, bypassRls: true })
}

export function runWithUserDbContext<T>(userId: string, fn: () => T): T {
  return storage.run({ userId, bypassRls: false }, fn)
}

export async function runWithUserDbContextAsync<T>(
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return storage.run({ userId, bypassRls: false }, fn)
}
