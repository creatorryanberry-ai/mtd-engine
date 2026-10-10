/** pure mappers from hubspot crm v3 objects to engine rows; no io here */

export type HubspotObject = {
  id: string
  properties: Record<string, string | null>
  createdAt?: string
  updatedAt?: string
  archived?: boolean
  associations?: Record<string, { results: { id: string; type: string }[] }>
}

export type HubspotPage = {
  results: HubspotObject[]
  paging?: { next?: { after: string; link?: string } }
}

export type HubspotObjectType = 'contacts' | 'companies' | 'deals'

export const HUBSPOT_PROPERTIES: Record<HubspotObjectType, string[]> = {
  contacts: [
    'email',
    'firstname',
    'lastname',
    'jobtitle',
    'phone',
    'country',
    'lifecyclestage',
    'associatedcompanyid',
    'hs_object_id',
    'createdate',
    'lastmodifieddate',
  ],
  companies: [
    'name',
    'domain',
    'industry',
    'country',
    'numberofemployees',
    'createdate',
    'hs_lastmodifieddate',
  ],
  deals: [
    'dealname',
    'dealstage',
    'pipeline',
    'amount',
    'deal_currency_code',
    'closedate',
    'hs_is_closed',
    'hs_is_closed_won',
    'hs_is_closed_lost',
    'hs_deal_stage_probability',
    'hubspot_owner_id',
    'createdate',
    'hs_lastmodifieddate',
  ],
}

export type DealStatus = 'open' | 'won' | 'lost'

function flag(value: string | null | undefined) {
  return value === 'true'
}

/**
 * closed flags win; the default pipeline's closedwon / closedlost stage ids are
 * the fallback for portals where the flags are not populated.
 */
export function mapDealStatus(properties: Record<string, string | null>): DealStatus {
  if (flag(properties.hs_is_closed_won)) return 'won'
  if (flag(properties.hs_is_closed_lost)) return 'lost'
  const stage = (properties.dealstage ?? '').toLowerCase()
  if (stage === 'closedwon' || stage.endsWith('_won')) return 'won'
  if (stage === 'closedlost' || stage.endsWith('_lost')) return 'lost'
  if (flag(properties.hs_is_closed)) return 'lost'
  return 'open'
}

/** hubspot amounts are decimal strings in major units */
export function toMinor(value: string | null | undefined) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.round(parsed * 100)
}

export function toProbability(value: string | null | undefined) {
  if (value == null || value === '') return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return Math.min(Math.max(parsed, 0), 1)
}

const LIFECYCLE_MAP: Record<string, string> = {
  subscriber: 'lead',
  lead: 'lead',
  marketingqualifiedlead: 'mql',
  salesqualifiedlead: 'sql',
  opportunity: 'opportunity',
  customer: 'customer',
  evangelist: 'customer',
  other: 'lead',
}

/** hubspot lifecycle stage → engine lifecycle (lead | mql | sql | opportunity | customer) */
export function mapLifecycleStage(value: string | null | undefined) {
  if (!value) return null
  return LIFECYCLE_MAP[value.toLowerCase()] ?? null
}

export function sizeBandFromEmployees(value: string | null | undefined) {
  const count = Number(value)
  if (!value || !Number.isFinite(count)) return null
  if (count < 10) return '1-9'
  if (count < 50) return '10-49'
  if (count < 250) return '50-249'
  if (count < 1000) return '250-999'
  return '1000+'
}

export function toIso(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function firstAssociationId(object: HubspotObject, type: string) {
  return object.associations?.[type]?.results?.[0]?.id ?? null
}

export type ParsedAllCursor = { object: HubspotObjectType; after: string | null }

export const ALL_SEQUENCE: HubspotObjectType[] = ['companies', 'contacts', 'deals']

/** `scope=all` walks companies → contacts → deals; the cursor encodes where we are */
export function parseAllCursor(cursor: string | null | undefined): ParsedAllCursor {
  if (!cursor) return { object: ALL_SEQUENCE[0]!, after: null }
  const [object, after] = cursor.split('|', 2)
  if (object === 'contacts' || object === 'companies' || object === 'deals') {
    return { object, after: after || null }
  }
  return { object: ALL_SEQUENCE[0]!, after: null }
}

export function nextAllCursor(current: HubspotObjectType, after: string | null) {
  if (after) return `${current}|${after}`
  const index = ALL_SEQUENCE.indexOf(current)
  const next = ALL_SEQUENCE[index + 1]
  return next ? `${next}|` : null
}
