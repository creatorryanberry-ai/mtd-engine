import { describe, expect, it } from 'vitest'

import { suggestPrivateUse } from '~/features/mtd/categories/privateUseSuggestions'

describe('suggestPrivateUse', () => {
  it('returns null for empty or unrelated text', () => {
    expect(suggestPrivateUse('')).toBeNull()
    expect(suggestPrivateUse('   ')).toBeNull()
    expect(suggestPrivateUse('AMAZON MARKETPLACE')).toBeNull()
    expect(suggestPrivateUse('STARBUCKS')).toBeNull()
  })

  it('suggests office costs for mobile and phone merchants', () => {
    expect(suggestPrivateUse('EE MOBILE')).toEqual({
      percent: 50,
      chipLabel: 'Often 50% private',
      preferredHmrcCategory: 'office_costs',
    })
    expect(suggestPrivateUse('VODAFONE LTD')).toMatchObject({
      preferredHmrcCategory: 'office_costs',
      percent: 50,
    })
    expect(suggestPrivateUse('GIFFGAFF TOP UP')).toMatchObject({
      preferredHmrcCategory: 'office_costs',
    })
    expect(suggestPrivateUse('Phone bill')).toMatchObject({
      preferredHmrcCategory: 'office_costs',
    })
  })

  it('does not match short tokens inside other words', () => {
    expect(suggestPrivateUse('COFFEE HOUSE')).toBeNull()
    expect(suggestPrivateUse('FEE REFUND')).toBeNull()
    expect(suggestPrivateUse('SUBSCRIPTION')).toBeNull()
  })

  it('suggests office costs for broadband merchants', () => {
    expect(suggestPrivateUse('VIRGIN MEDIA')).toMatchObject({
      preferredHmrcCategory: 'office_costs',
    })
    expect(suggestPrivateUse('BT BROADBAND')).toMatchObject({
      preferredHmrcCategory: 'office_costs',
    })
    expect(suggestPrivateUse('Hyperoptic Fibre')).toMatchObject({
      preferredHmrcCategory: 'office_costs',
    })
  })

  it('suggests rent rates power for utilities', () => {
    expect(suggestPrivateUse('BRITISH GAS')).toMatchObject({
      preferredHmrcCategory: 'rent_rates_power',
    })
    expect(suggestPrivateUse('OCTOPUS ENERGY')).toMatchObject({
      preferredHmrcCategory: 'rent_rates_power',
    })
    expect(suggestPrivateUse('THAMES WATER')).toMatchObject({
      preferredHmrcCategory: 'rent_rates_power',
    })
  })

  it('suggests car van travel for fuel and parking', () => {
    expect(suggestPrivateUse('SHELL PETROL')).toMatchObject({
      preferredHmrcCategory: 'car_van_travel',
    })
    expect(suggestPrivateUse('TESCO FUEL')).toMatchObject({
      preferredHmrcCategory: 'car_van_travel',
    })
    expect(suggestPrivateUse('NCP PARKING')).toMatchObject({
      preferredHmrcCategory: 'car_van_travel',
    })
    expect(suggestPrivateUse('UBER TRIP')).toMatchObject({
      preferredHmrcCategory: 'car_van_travel',
    })
  })

  it('hides vehicle suggestions when mileage claim method is active', () => {
    expect(suggestPrivateUse('SHELL PETROL', { includeVehicle: false })).toBeNull()
    expect(suggestPrivateUse('TESCO FUEL', { includeVehicle: false })).toBeNull()
    expect(suggestPrivateUse('EE MOBILE', { includeVehicle: false })).toMatchObject({
      preferredHmrcCategory: 'office_costs',
    })
  })

  it('prefers more specific merchant matches over generic keywords', () => {
    // "tesco fuel" should win over plain "fuel" / "tesco" (tesco alone not in catalog)
    expect(suggestPrivateUse('TESCO FUEL STORE')).toMatchObject({
      preferredHmrcCategory: 'car_van_travel',
    })
    expect(suggestPrivateUse('SKY MOBILE BILL')).toMatchObject({
      preferredHmrcCategory: 'office_costs',
    })
  })
})
