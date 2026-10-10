#!/usr/bin/env bun

import { cmd } from '@mtd/cli'

await cmd`Seed database with demo users`.run(async () => {
  // allow self-signed certs for managed databases
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  const { Pool } = await import('pg')

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL not set')
  }

  // only use ssl for non-localhost connections
  const isLocalhost =
    connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
  const pool = new Pool({
    connectionString,
    ssl: isLocalhost ? false : { rejectUnauthorized: false },
  })

  const seedUsers = [
    {
      id: 'seed-user-1',
      name: 'Sarah Chen',
      username: 'sarahc',
      email: 'sarah@example.com',
      image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
    },
    {
      id: 'seed-user-2',
      name: 'Marcus Johnson',
      username: 'marcusj',
      email: 'marcus@example.com',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
    },
    {
      id: 'seed-user-3',
      name: 'Emma Wilson',
      username: 'emmaw',
      email: 'emma@example.com',
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400',
    },
    {
      id: 'seed-user-4',
      name: 'Alex Rivera',
      username: 'alexr',
      email: 'alex@example.com',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400',
    },
  ]

  async function seed() {
    const now = new Date().toISOString()

    // demo user is created lazily via signInAsDemo helper, no need to seed it

    console.info('seeding users...')

    for (const u of seedUsers) {
      // insert into private user table (auth)
      await pool.query(
        `INSERT INTO "user" (id, name, username, email, "emailVerified", image, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.username, u.email, true, u.image, 'user'],
      )

      // insert into public user table
      await pool.query(
        `INSERT INTO "userPublic" (id, name, username, image, "joinedAt")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.username, u.image, now],
      )

      // insert user state (seeded users are treated as already onboarded)
      await pool.query(
        `INSERT INTO "userState" ("userId", "darkMode", "hasOnboarded")
         VALUES ($1, $2, $3)
         ON CONFLICT ("userId") DO NOTHING`,
        [u.id, false, true],
      )

      await pool.query(
        `INSERT INTO "businessSettings" (
          "userId",
          "businessName",
          "businessStartDate",
          "businessDescription",
          "businessType",
          "cisRegistered",
          "vehicleClaimMethod",
          "updatedAt"
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT ("userId") DO NOTHING`,
        [
          u.id,
          `${u.name} Ltd`,
          '2020-04-06',
          'Demo business activity',
          'self-employed',
          false,
          'mileage',
          now,
        ],
      )

      console.info(`  created user: ${u.username}`)
    }

    console.info('done!')
    await pool.end()
    process.exit(0)
  }

  seed().catch((err: unknown) => {
    console.error('seed failed:', err instanceof Error ? err.message : err)
    process.exit(1)
  })
})
