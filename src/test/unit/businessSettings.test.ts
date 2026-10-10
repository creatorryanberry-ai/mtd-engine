import { describe, expect, it } from 'vitest'

import {
  normalizeBusinessSettingsPatch,
  validateBusinessSettingsPatch,
} from '~/features/business/businessSettingsValidation'

describe('validateBusinessSettingsPatch', () => {
  const validSelfEmployed = {
    businessName: 'Acme Plumbing',
    businessStartDate: '2020-04-06',
    businessDescription: 'Residential plumbing services',
    businessType: 'self-employed' as const,
    cisRegistered: true,
    vehicleClaimMethod: 'mileage' as const,
  }

  it('accepts a complete self-employed patch', () => {
    expect(() => validateBusinessSettingsPatch(validSelfEmployed)).not.toThrow()
  })

  it('requires business name', () => {
    expect(() =>
      validateBusinessSettingsPatch({ ...validSelfEmployed, businessName: '  ' }),
    ).toThrow('Business name is required')
  })

  it('requires a valid ISO start date', () => {
    expect(() =>
      validateBusinessSettingsPatch({
        ...validSelfEmployed,
        businessStartDate: '06-04-2020',
      }),
    ).toThrow('Business start date must be YYYY-MM-DD')
  })

  it('requires CIS registration for self-employed', () => {
    expect(() =>
      validateBusinessSettingsPatch({ ...validSelfEmployed, cisRegistered: undefined }),
    ).toThrow('CIS registration status is required for self-employed')
  })

  it('accepts landlord without CIS registration', () => {
    expect(() =>
      validateBusinessSettingsPatch({
        ...validSelfEmployed,
        businessType: 'landlord',
        cisRegistered: undefined,
      }),
    ).not.toThrow()
  })
})

describe('normalizeBusinessSettingsPatch', () => {
  it('clears CIS registration for landlords', () => {
    expect(
      normalizeBusinessSettingsPatch({
        businessName: 'Rental Co',
        businessStartDate: '2018-01-01',
        businessDescription: 'Residential lettings',
        businessType: 'landlord',
        cisRegistered: true,
        vehicleClaimMethod: 'actual',
      }),
    ).toMatchObject({
      businessName: 'Rental Co',
      businessType: 'landlord',
      cisRegistered: null,
      vehicleClaimMethod: 'actual',
    })
  })

  it('trims text fields', () => {
    expect(
      normalizeBusinessSettingsPatch({
        businessName: '  Acme  ',
        businessStartDate: '2020-04-06',
        businessDescription: '  Plumbing  ',
        businessType: 'self-employed',
        cisRegistered: false,
        vehicleClaimMethod: 'mileage',
      }),
    ).toMatchObject({
      businessName: 'Acme',
      businessDescription: 'Plumbing',
      cisRegistered: false,
    })
  })
})
