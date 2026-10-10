import { describe, expect, it } from 'vitest'

import { formatLastUpdated } from '~/features/mtd/utils/formatLastUpdated'

describe('formatLastUpdated', () => {
  it('returns a friendly relative label for recent syncs', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(formatLastUpdated(twoHoursAgo)).toBe('2 hours ago')
  })

  it('returns not yet synced when empty', () => {
    expect(formatLastUpdated(null)).toBe('Not yet synced')
  })
})
