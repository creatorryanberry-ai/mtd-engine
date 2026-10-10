/**
 * deterministic synthetic business used by the seed script and tests.
 * northstar roofing: a uk commercial roofing contractor selling to main
 * contractors (b2b) with some direct domestic work (b2c). pure functions,
 * no db access, seeded prng so runs are reproducible.
 */

export type SyntheticCompany = {
  key: string
  name: string
  domain: string
  industry: string
  sizeBand: string
  legalForm: 'limited' | 'sole_trader'
}

export type SyntheticContact = {
  key: string
  companyKey: string | null
  email: string
  firstName: string
  lastName: string
  jobTitle: string | null
  lifecycleStage: 'lead' | 'mql' | 'sql' | 'opportunity' | 'customer'
  source: 'hubspot' | 'web' | 'referral'
  consent: 'granted' | 'soft_optin' | 'corporate_subscriber' | 'withdrawn'
  firstSeenAt: string
}

export type SyntheticOrder = {
  externalId: string
  contactKey: string
  revenueMinor: number
  costMinor: number
  feesMinor: number
  refundedMinor: number
  occurredAt: string
  description: string
}

export type SyntheticEvent = {
  sourceEventId: string
  contactKey: string | null
  type: string
  channelKey: string
  source: string
  occurredAt: string
  properties: Record<string, unknown>
}

export type SyntheticDeal = {
  externalId: string
  contactKey: string
  companyKey: string | null
  name: string
  stage: string
  status: 'open' | 'won' | 'lost'
  amountMinor: number
  closedAt: string | null
}

export type SyntheticBusiness = {
  companies: SyntheticCompany[]
  contacts: SyntheticContact[]
  orders: SyntheticOrder[]
  events: SyntheticEvent[]
  deals: SyntheticDeal[]
}

/** mulberry32: tiny seeded prng, good enough for fixtures */
export function createRng(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST_NAMES = [
  'Amira',
  'Ben',
  'Chloe',
  'Dan',
  'Elena',
  'Femi',
  'Grace',
  'Hassan',
  'Isla',
  'Jack',
  'Kemi',
  'Liam',
  'Maya',
  'Noah',
  'Olivia',
  'Priya',
  'Quinn',
  'Rhys',
  'Sofia',
  'Tom',
]
const LAST_NAMES = [
  'Adams',
  'Begum',
  'Campbell',
  'Davies',
  'Evans',
  'Foster',
  'Griffiths',
  'Hughes',
  'Iqbal',
  'Jones',
  'Khan',
  'Lewis',
  'Morgan',
  'Nowak',
  'Owen',
  'Patel',
  'Quinn',
  'Roberts',
  'Singh',
  'Taylor',
]
const COMPANY_WORDS = [
  'Keystone',
  'Northgate',
  'Beacon',
  'Harbour',
  'Ridgeway',
  'Summit',
  'Granite',
  'Meridian',
  'Pennine',
  'Forge',
  'Anchor',
  'Copper',
  'Linden',
  'Quarry',
  'Severn',
  'Tamar',
]
const COMPANY_SUFFIX = [
  'Construction',
  'Build',
  'Developments',
  'Contracts',
  'Group',
  'Projects',
]
const JOB_TITLES = [
  'Site Manager',
  'Quantity Surveyor',
  'Project Director',
  'Buyer',
  'Operations Lead',
  'Managing Director',
  'Estimator',
  'Facilities Manager',
]
const CHANNELS = ['email', 'meta_ads', 'linkedin_organic', 'google_ads', 'web'] as const
const TOUCH_TYPES = ['impression', 'click', 'open', 'visit', 'form', 'reply'] as const

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!
}

function isoDaysAgo(now: Date, days: number, hourSpread: number, rng: () => number) {
  const d = new Date(now.getTime() - days * 86_400_000 - rng() * hourSpread * 3_600_000)
  return d.toISOString()
}

export function generateSyntheticBusiness(
  options: { seed?: number; now?: Date } = {},
): SyntheticBusiness {
  const rng = createRng(options.seed ?? 20261010)
  const now = options.now ?? new Date('2026-10-10T09:00:00Z')

  const companies: SyntheticCompany[] = []
  for (let i = 0; i < 40; i++) {
    const name = `${pick(rng, COMPANY_WORDS)} ${pick(rng, COMPANY_SUFFIX)}`
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
    companies.push({
      key: `co_${i}`,
      name: `${name} ${i}`,
      domain: `${slug}${i}.co.uk`,
      industry: 'construction',
      sizeBand: pick(rng, ['11-50', '51-200', '201-500', '500+']),
      legalForm: rng() < 0.9 ? 'limited' : 'sole_trader',
    })
  }

  const contacts: SyntheticContact[] = []
  for (let i = 0; i < 120; i++) {
    const firstName = pick(rng, FIRST_NAMES)
    const lastName = pick(rng, LAST_NAMES)
    const b2b = rng() < 0.75
    const company = b2b ? companies[Math.floor(rng() * companies.length)]! : null
    const stageRoll = rng()
    const lifecycleStage =
      stageRoll < 0.35
        ? 'lead'
        : stageRoll < 0.55
          ? 'mql'
          : stageRoll < 0.7
            ? 'sql'
            : stageRoll < 0.8
              ? 'opportunity'
              : 'customer'
    const domain = company
      ? company.domain
      : pick(rng, ['gmail.com', 'outlook.com', 'icloud.com'])
    contacts.push({
      key: `ct_${i}`,
      companyKey: company?.key ?? null,
      email: `${firstName}.${lastName}${i}@${domain}`.toLowerCase(),
      firstName,
      lastName,
      jobTitle: company ? pick(rng, JOB_TITLES) : null,
      lifecycleStage,
      source: pick(rng, ['hubspot', 'web', 'referral']),
      consent: company
        ? company.legalForm === 'limited'
          ? 'corporate_subscriber'
          : rng() < 0.7
            ? 'granted'
            : 'withdrawn'
        : rng() < 0.6
          ? 'granted'
          : 'soft_optin',
      firstSeenAt: isoDaysAgo(now, 20 + Math.floor(rng() * 160), 12, rng),
    })
  }

  const customers = contacts.filter((c) => c.lifecycleStage === 'customer')
  const orders: SyntheticOrder[] = []
  let orderIndex = 0
  for (const customer of customers) {
    const count = 1 + Math.floor(rng() * 4)
    for (let j = 0; j < count; j++) {
      const b2b = customer.companyKey !== null
      const revenueMinor = b2b
        ? 250_000 + Math.floor(rng() * 1_800_000)
        : 45_000 + Math.floor(rng() * 300_000)
      const marginRate = b2b ? 0.28 + rng() * 0.12 : 0.35 + rng() * 0.15
      const refunded = rng() < 0.04 ? Math.floor(revenueMinor * (0.1 + rng() * 0.4)) : 0
      orders.push({
        externalId: `ch_synthetic_${String(orderIndex++).padStart(5, '0')}`,
        contactKey: customer.key,
        revenueMinor,
        costMinor: Math.round(revenueMinor * (1 - marginRate)),
        feesMinor: Math.round(revenueMinor * 0.014 + 20),
        refundedMinor: refunded,
        occurredAt: isoDaysAgo(now, Math.floor(rng() * 84), 10, rng),
        description: b2b ? 'Flat roof replacement (commercial)' : 'Domestic re-roof',
      })
    }
  }
  orders.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))

  const events: SyntheticEvent[] = []
  for (let i = 0; i < 2000; i++) {
    const contact = rng() < 0.85 ? contacts[Math.floor(rng() * contacts.length)]! : null
    const channelKey = pick(rng, CHANNELS)
    const type = pick(rng, TOUCH_TYPES)
    events.push({
      sourceEventId: `syn_evt_${String(i).padStart(5, '0')}`,
      contactKey: contact?.key ?? null,
      type,
      channelKey,
      source: channelKey === 'web' ? 'web' : channelKey,
      occurredAt: isoDaysAgo(now, Math.floor(rng() * 84), 24, rng),
      properties: {
        campaign: pick(rng, ['autumn-flat-roof', 'main-contractor-nurture', 'brand']),
      },
    })
  }

  const deals: SyntheticDeal[] = []
  const dealContacts = contacts.filter((c) =>
    ['sql', 'opportunity', 'customer'].includes(c.lifecycleStage),
  )
  for (const [i, contact] of dealContacts.slice(0, 30).entries()) {
    const roll = rng()
    const status = roll < 0.5 ? 'open' : roll < 0.8 ? 'won' : 'lost'
    deals.push({
      externalId: `deal_synthetic_${i}`,
      contactKey: contact.key,
      companyKey: contact.companyKey,
      name: `${contact.lastName} roofing package`,
      stage:
        status === 'open'
          ? pick(rng, ['qualified', 'proposal', 'negotiation'])
          : status === 'won'
            ? 'closedwon'
            : 'closedlost',
      status,
      amountMinor: 300_000 + Math.floor(rng() * 2_500_000),
      closedAt:
        status === 'open' ? null : isoDaysAgo(now, Math.floor(rng() * 60), 8, rng),
    })
  }

  return { companies, contacts, orders, events, deals }
}

export const SYNTHETIC_BRAND_KIT = {
  colors: [
    { name: 'Slate', hex: '#1f2a37', role: 'primary' },
    { name: 'Copper', hex: '#c0653a', role: 'accent' },
    { name: 'Chalk', hex: '#f4f1ec', role: 'background' },
  ],
  fonts: { heading: 'Inter', body: 'Inter' },
  toneOfVoice:
    'Plain-spoken, confident, specific about materials and timelines. No hype, no jargon, never promise what the survey has not confirmed.',
  bannedWords: ['cheapest', 'guaranteed', 'best in the UK', 'revolutionary'],
  claims: [
    {
      claim: '25-year manufacturer-backed warranty on single-ply systems',
      evidence: 'Sika Sarnafil approved contractor certificate 2026',
      approved: true,
    },
    {
      claim: 'Over 400 commercial roofs completed since 2012',
      evidence: 'Internal job ledger export, 2026-09',
      approved: true,
    },
    {
      claim: 'Lowest price in the region',
      evidence: 'none',
      approved: false,
    },
  ],
  proofPoints: [
    'CHAS accredited',
    'Constructionline Gold',
    'Sika Sarnafil registered contractor',
  ],
  personas: [
    {
      id: 'persona_main_contractor_qs',
      name: 'Main contractor quantity surveyor',
      summary:
        'Procures roofing packages for 10 to 40 projects a year; judges on programme certainty and warranty.',
      painPoints: [
        'Subcontractors slipping programme',
        'Warranty paperwork chasing',
        'Variations with no evidence',
      ],
      goals: ['Hit practical completion', 'No defects at handover'],
      accuracy: null,
    },
    {
      id: 'persona_facilities_manager',
      name: 'Facilities manager, multi-site',
      summary:
        'Owns reactive and planned roof maintenance for an estate of 20+ buildings.',
      painPoints: [
        'Leaks in winter',
        'Capex approval cycles',
        'Finding contractors who document work',
      ],
      goals: ['Predictable maintenance budget', 'Fewer emergency callouts'],
      accuracy: null,
    },
  ],
  aiDisclosure: 'subtle' as const,
}
