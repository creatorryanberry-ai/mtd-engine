import { describe, expect, it } from 'vitest'

import {
  firstAssociationId,
  mapDealStatus,
  mapLifecycleStage,
  nextAllCursor,
  parseAllCursor,
  sizeBandFromEmployees,
  toMinor,
  toProbability,
} from '~/features/engine/channels/hubspot/mapping'

describe('hubspot deal status mapping', () => {
  it('prefers the closed flags', () => {
    expect(mapDealStatus({ hs_is_closed_won: 'true', dealstage: 'anything' })).toBe('won')
    expect(mapDealStatus({ hs_is_closed_lost: 'true', dealstage: 'closedwon' })).toBe(
      'lost',
    )
  })

  it('falls back to the default pipeline stage ids', () => {
    expect(mapDealStatus({ dealstage: 'closedwon' })).toBe('won')
    expect(mapDealStatus({ dealstage: 'closedlost' })).toBe('lost')
    expect(mapDealStatus({ dealstage: 'custom_won' })).toBe('won')
    expect(mapDealStatus({ dealstage: 'appointmentscheduled' })).toBe('open')
  })

  it('treats closed-but-not-won as lost and unknown as open', () => {
    expect(mapDealStatus({ hs_is_closed: 'true', dealstage: 'stage_42' })).toBe('lost')
    expect(mapDealStatus({ hs_is_closed: 'false', dealstage: 'stage_42' })).toBe('open')
    expect(mapDealStatus({})).toBe('open')
    expect(mapDealStatus({ hs_is_closed_won: null, dealstage: null })).toBe('open')
  })
})

describe('hubspot value mapping', () => {
  it('converts decimal amounts to minor units', () => {
    expect(toMinor('1250.5')).toBe(125_050)
    expect(toMinor('0')).toBe(0)
    expect(toMinor('')).toBeNull()
    expect(toMinor(null)).toBeNull()
    expect(toMinor('abc')).toBeNull()
  })

  it('clamps probabilities and maps lifecycle stages', () => {
    expect(toProbability('0.75')).toBe(0.75)
    expect(toProbability('7')).toBe(1)
    expect(toProbability(undefined)).toBeNull()
    expect(mapLifecycleStage('marketingqualifiedlead')).toBe('mql')
    expect(mapLifecycleStage('Customer')).toBe('customer')
    expect(mapLifecycleStage('made_up')).toBeNull()
    expect(sizeBandFromEmployees('120')).toBe('50-249')
    expect(sizeBandFromEmployees(null)).toBeNull()
  })

  it('reads the first association id', () => {
    expect(
      firstAssociationId(
        {
          id: '1',
          properties: {},
          associations: { contacts: { results: [{ id: '9', type: 'deal_to_contact' }] } },
        },
        'contacts',
      ),
    ).toBe('9')
    expect(firstAssociationId({ id: '1', properties: {} }, 'contacts')).toBeNull()
  })
})

describe('hubspot scope=all cursor', () => {
  it('walks companies, contacts, deals and ends with null', () => {
    expect(parseAllCursor(null)).toEqual({ object: 'companies', after: null })
    expect(parseAllCursor('contacts|abc')).toEqual({ object: 'contacts', after: 'abc' })
    expect(parseAllCursor('garbage')).toEqual({ object: 'companies', after: null })
    expect(nextAllCursor('companies', 'p2')).toBe('companies|p2')
    expect(nextAllCursor('companies', null)).toBe('contacts|')
    expect(nextAllCursor('contacts', null)).toBe('deals|')
    expect(nextAllCursor('deals', null)).toBeNull()
  })
})
