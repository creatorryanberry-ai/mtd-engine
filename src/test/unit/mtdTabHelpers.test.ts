import { describe, expect, test } from 'vitest'

import { getMtdActiveTab, normalizeMtdPathname } from '~/features/mtd/mtdTabHelpers'

describe('mtdTabHelpers', () => {
  test('normalizeMtdPathname adds /home prefix for nested native paths', () => {
    expect(normalizeMtdPathname('/settings')).toBe('/home/settings')
    expect(normalizeMtdPathname('/feed')).toBe('/home/feed')
    expect(normalizeMtdPathname('/home/feed')).toBe('/home/feed')
    expect(normalizeMtdPathname('/home/feed/')).toBe('/home/feed')
  })

  test('getMtdActiveTab highlights more on settings', () => {
    expect(getMtdActiveTab('/home/settings')).toBe('more')
    expect(getMtdActiveTab('/settings')).toBe('more')
    expect(getMtdActiveTab('/home/feed')).toBe('home')
  })

  test('getMtdActiveTab maps remodelled dock destinations', () => {
    expect(getMtdActiveTab('/home/records')).toBe('records')
    expect(getMtdActiveTab('/home/bank-accounts')).toBe('records')
    expect(getMtdActiveTab('/home/mileage')).toBe('records')
    expect(getMtdActiveTab('/home/inbox')).toBe('records')
    expect(getMtdActiveTab('/home/submit-to-hmrc')).toBe('submissions')
    expect(getMtdActiveTab('/home/submissions')).toBe('submissions')
    expect(getMtdActiveTab('/home/submissions/Q2')).toBe('submissions')
    expect(getMtdActiveTab('/home/categorise-transactions')).toBe(null)
    expect(getMtdActiveTab('/home/categorisation-rules')).toBe(null)
  })
})
