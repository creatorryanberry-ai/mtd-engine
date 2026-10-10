import { sql } from '~/database/db'

export function userNotifyChannel(userId: string) {
  return `user_${userId.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

export async function notifyUser(userId: string, payload: Record<string, unknown>) {
  const channel = userNotifyChannel(userId)
  await sql`SELECT pg_notify(${channel}, ${JSON.stringify(payload)})`
}
