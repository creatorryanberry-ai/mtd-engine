---
name: mtd-database
description: PostgreSQL + Drizzle ORM — migrations, getDb, queryDb, pgvector.
---

# Database

PostgreSQL is the primary database. Drizzle ORM manages schema and migrations.

## Local development

Connection string: `DATABASE_URL` (default `postgresql://user:password@127.0.0.1:5433/postgres`).

```bash
bun env:dev bunx postgres psql
```

## Schema

Edit `src/database/schema.ts`. Use `pgPrivateTable` for server-only tables.

```bash
bun db:migrate
```

## Query patterns

```typescript
import { drizzle } from '~/database/db'
import { userPublic } from '~/database/schema'

const rows = await drizzle.select().from(userPublic)
```

Server API handlers live in `src/features/api/server/` and feature `server/` dirs.

Authenticated requests call `enterUserDbContext(userId)` so Postgres RLS session GUCs (`app.user_id` / `app.bypass_rls`) are applied on the pool. See [data-isolation](./data-isolation.md).

## Migrations

- Schema changes: edit `schema.ts` → `bun db:migrate`
- Custom SQL: `bun db:add-migration <name>` → `bun db:migrate`

Never hand-write Drizzle migration SQL — it is auto-generated.
