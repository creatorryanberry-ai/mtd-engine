import pg from 'pg'

import { server } from '~/env'

import { userNotifyChannel } from '../notify'

const { Client } = pg

export type NotifyHandler = (payload: string) => void

export async function subscribeUserEvents(userId: string, onNotify: NotifyHandler) {
  const connectionString = server.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured')
  }

  const client = new Client({ connectionString })
  await client.connect()
  const channel = userNotifyChannel(userId)

  const listener = (msg: pg.Notification) => {
    if (msg.channel === channel && msg.payload) {
      onNotify(msg.payload)
    }
  }

  client.on('notification', listener)
  await client.query(`LISTEN ${channel}`)

  return async () => {
    client.removeListener('notification', listener)
    try {
      await client.query(`UNLISTEN ${channel}`)
    } finally {
      await client.end()
    }
  }
}
