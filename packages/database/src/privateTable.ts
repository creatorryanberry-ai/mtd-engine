import { getTableName } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'

const PRIVATE = Symbol.for('take-out/database/private')

/** wrap pgTable to mark tables as private (excluded from public API exposure) */
export function privateTable<T extends (...args: any[]) => any>(createTable: T): T {
  return ((...args: any[]) => {
    const table = createTable(...args)
    ;(table as any)[PRIVATE] = true
    return table
  }) as unknown as T
}

/** check if a table is marked as private */
export function isPrivateTable(table: unknown): boolean {
  return !!(table && typeof table === 'object' && PRIVATE in table)
}

/** derive public table names from a schema (all tables not marked private) */
export function derivePublicTables(schema: Record<string, unknown>): string[] {
  return Object.values(schema)
    .filter((v) => v instanceof PgTable && !isPrivateTable(v))
    .map((t) => getTableName(t as PgTable))
}
