import 'server-only'

import { createDatabase } from '@mtd/database'

import { server } from '~/env'

import * as coreSchema from './schema'
import * as engineSchema from './engineSchema'
import { relations } from './relations'

const connectionString = server.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not configured')
}

export const schema = { ...coreSchema, ...engineSchema }

export const db = createDatabase({
  connectionString,
  schema,
  relations,
})

export const { drizzle, sql } = db
