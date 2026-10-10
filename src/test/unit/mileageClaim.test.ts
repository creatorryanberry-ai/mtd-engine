import { describe, expect, it } from 'vitest'

import {
  calculateMileageClaim,
  enrichMileageEntriesWithClaims,
  getCumulativeMilesBeforeEntry,
} from '~/features/mileage/utils/mileageClaim'

describe('calculateMileageClaim', () => {
  it('charges 55p for miles within the first 10,000', () => {
    const claim = calculateMileageClaim(100, 0)
    expect(claim.rateLabel).toBe('55p')
    expect(claim.claimPounds).toBe(55)
  })

  it('charges 25p after 10,000 miles in the tax year', () => {
    const claim = calculateMileageClaim(50, 10_000)
    expect(claim.rateLabel).toBe('25p')
    expect(claim.claimPounds).toBe(12.5)
  })

  it('splits claim when a journey crosses the 10,000 mile threshold', () => {
    const claim = calculateMileageClaim(20, 9_990)
    expect(claim.milesAtHighRate).toBe(10)
    expect(claim.milesAtLowRate).toBe(10)
    expect(claim.rateLabel).toBe('55p/25p')
    expect(claim.claimPounds).toBe(8)
  })
})

describe('enrichMileageEntriesWithClaims', () => {
  it('applies cumulative mileage in date order within a tax year', () => {
    const enriched = enrichMileageEntriesWithClaims([
      {
        id: '2',
        date: '2026-08-01',
        miles: 100,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
        journeyDetails: 'Later trip',
      },
      {
        id: '1',
        date: '2026-06-01',
        miles: 9_950,
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
        journeyDetails: 'Earlier trip',
      },
    ])

    const earlier = enriched.find((entry) => entry.id === '1')
    const later = enriched.find((entry) => entry.id === '2')

    expect(earlier?.claim.rateLabel).toBe('55p')
    expect(later?.claim.rateLabel).toBe('55p/25p')
    expect(later?.claim.claimPounds).toBe(40)
  })
})

describe('getCumulativeMilesBeforeEntry', () => {
  it('excludes the entry being edited', () => {
    const entries = [
      {
        id: '1',
        date: '2026-06-01',
        miles: 100,
        createdAt: '2026-06-01T10:00:00.000Z',
        updatedAt: '2026-06-01T10:00:00.000Z',
      },
      {
        id: '2',
        date: '2026-06-01',
        miles: 50,
        createdAt: '2026-06-01T11:00:00.000Z',
        updatedAt: '2026-06-01T11:00:00.000Z',
      },
    ]

    expect(
      getCumulativeMilesBeforeEntry(entries, {
        date: '2026-06-01',
        createdAt: '2026-06-01T11:00:00.000Z',
        excludeId: '2',
      }),
    ).toBe(100)
  })
})
