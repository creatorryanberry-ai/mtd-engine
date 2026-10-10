/** keyset cursors: `<timestamp>|<id>` ordered desc on both */

export const DEFAULT_PAGE_SIZE = 50

/** limit is a number after valibot parsing but typed as the raw query string by defineRoute */
export type PageQuery = { limit?: number | string; cursor?: string }

export type KeysetCursor = { ts: string; id: string }

export function encodeCursor(ts: string, id: string) {
  return `${ts}|${id}`
}

export function decodeCursor(cursor: string | null | undefined): KeysetCursor | null {
  if (!cursor) return null
  const index = cursor.lastIndexOf('|')
  if (index <= 0 || index === cursor.length - 1) return null
  return { ts: cursor.slice(0, index), id: cursor.slice(index + 1) }
}

export function pageLimit(limit: number | string | undefined) {
  const parsed = typeof limit === 'string' ? Number(limit) : limit
  if (!parsed || !Number.isFinite(parsed)) return DEFAULT_PAGE_SIZE
  return Math.min(Math.max(Math.floor(parsed), 1), 200)
}

/** fetch limit + 1 rows, then hand them here to split items from the next cursor */
export function toPage<T>(rows: T[], limit: number, cursorOf: (row: T) => string) {
  const hasMore = rows.length > limit
  const items = hasMore ? rows.slice(0, limit) : rows
  const last = items[items.length - 1]
  return { items, nextCursor: hasMore && last ? cursorOf(last) : null }
}
