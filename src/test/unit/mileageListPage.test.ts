import { describe, expect, it } from 'vitest'

import {
  pageMileageEntries,
  parseMileageListPage,
} from '~/features/mileage/utils/mileageListPage'

describe('parseMileageListPage', () => {
  it('returns null when limit is omitted so callers can load every entry', () => {
    expect(parseMileageListPage(new URLSearchParams())).toBeNull()
  })

  it('clamps limit and offset', () => {
    expect(parseMileageListPage(new URLSearchParams('limit=999&offset=-4'))).toEqual({
      limit: 100,
      offset: 0,
    })
  })
})

describe('pageMileageEntries', () => {
  const dtos = [
    { id: 'a', claim: { claimPounds: 1 } },
    { id: 'b', claim: { claimPounds: 2 } },
    { id: 'c', claim: { claimPounds: 3 } },
  ]

  it('returns one page and the full claim total', () => {
    expect(pageMileageEntries(dtos, 0, 2)).toEqual({
      entries: [dtos[0], dtos[1]],
      totalCount: 3,
      totalClaimPounds: 6,
      hasMore: true,
    })
  })

  it('marks the last page', () => {
    expect(pageMileageEntries(dtos, 2, 2).hasMore).toBe(false)
  })
})
