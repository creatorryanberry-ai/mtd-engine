/**
 * phase 2 demo data: a nurture audience large enough to measure, the orders
 * and touches an autumn nurture email programme would cause, and paid media
 * spend with platform-reported numbers that overclaim. pure and seeded so
 * tests and the seed script agree.
 */

import { createRng } from './syntheticBusiness'

export type NurtureLead = {
  key: string
  email: string
  firstName: string
  lastName: string
  lifecycleStage: 'lead' | 'mql'
  consent: 'granted' | 'soft_optin' | 'withdrawn'
  firstSeenAt: string
}

export type MeasuredContact = { contactId: string; email: string; isHoldout: boolean }

export type ExperimentOrder = {
  externalId: string
  contactId: string
  email: string
  revenueMinor: number
  costMinor: number
  feesMinor: number
  occurredAt: string
  description: string
}

export type ChannelEvent = {
  sourceEventId: string
  contactId: string | null
  type: string
  channelKey: string
  source: string
  occurredAt: string
  valueMinor: number | null
  properties: Record<string, unknown>
}

const FIRST = [
  'Aisha',
  'Bryn',
  'Cara',
  'Dev',
  'Ella',
  'Finn',
  'Gwen',
  'Harry',
  'Ines',
  'Joel',
  'Kira',
  'Leo',
]
const LAST = [
  'Ahmed',
  'Baker',
  'Clarke',
  'Dunn',
  'Ellis',
  'Ford',
  'Gill',
  'Hall',
  'Ivers',
  'Jarvis',
  'Kerr',
  'Lowe',
]
const DAY_MS = 86_400_000

function pick<T>(rng: () => number, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length)]!
}

function daysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * DAY_MS)
}

/** domestic and small-commercial leads captured from web forms over the last six months */
export function generateNurtureAudience(
  options: { seed?: number; now?: Date; count?: number } = {},
): NurtureLead[] {
  const rng = createRng(options.seed ?? 4242)
  const now = options.now ?? new Date('2026-10-10T09:00:00Z')
  const count = options.count ?? 5000
  const leads: NurtureLead[] = []
  for (let i = 0; i < count; i++) {
    const firstName = pick(rng, FIRST)
    const lastName = pick(rng, LAST)
    const consentRoll = rng()
    leads.push({
      key: `nl_${i}`,
      email: `${firstName}.${lastName}.${i}@nurture.example`.toLowerCase(),
      firstName,
      lastName,
      lifecycleStage: rng() < 0.7 ? 'lead' : 'mql',
      consent:
        consentRoll < 0.6 ? 'granted' : consentRoll < 0.93 ? 'soft_optin' : 'withdrawn',
      firstSeenAt: daysAgo(now, 50 + Math.floor(rng() * 130)).toISOString(),
    })
  }
  return leads
}

/**
 * orders and email touches over the experiment window. holdout contacts buy at
 * the organic rate; treated contacts buy at the treated rate and receive the
 * nurture emails (opens, clicks). profit per order is the same in both groups
 * so the measured lift comes from conversion alone.
 */
export function generateNurtureOutcomes(options: {
  contacts: MeasuredContact[]
  startedAt: Date
  now: Date
  seed?: number
  holdoutRate?: number
  treatedRate?: number
}): { orders: ExperimentOrder[]; touches: ChannelEvent[] } {
  const rng = createRng(options.seed ?? 777)
  const holdoutRate = options.holdoutRate ?? 0.02
  const treatedRate = options.treatedRate ?? 0.04
  const windowMs = Math.max(options.now.getTime() - options.startedAt.getTime(), DAY_MS)
  const at = (fraction: number) =>
    new Date(options.startedAt.getTime() + fraction * windowMs).toISOString()

  const orders: ExperimentOrder[] = []
  const touches: ChannelEvent[] = []
  for (const [index, contact] of options.contacts.entries()) {
    if (!contact.isHoldout) {
      const sends = 3
      for (let s = 0; s < sends; s++) {
        const sendAt = (s + rng() * 0.3) / (sends + 0.5)
        if (rng() < 0.42) {
          touches.push({
            sourceEventId: `nurture_open_${index}_${s}`,
            contactId: contact.contactId,
            type: 'open',
            channelKey: 'email',
            source: 'email',
            occurredAt: at(sendAt),
            valueMinor: null,
            properties: { campaign: 'autumn-nurture', step: s + 1 },
          })
          if (rng() < 0.18) {
            touches.push({
              sourceEventId: `nurture_click_${index}_${s}`,
              contactId: contact.contactId,
              type: 'click',
              channelKey: 'email',
              source: 'email',
              occurredAt: at(Math.min(sendAt + 0.01, 0.99)),
              valueMinor: null,
              properties: { campaign: 'autumn-nurture', step: s + 1 },
            })
          }
        }
      }
    }

    const rate = contact.isHoldout ? holdoutRate : treatedRate
    if (rng() < rate) {
      const revenueMinor = 180_000 + Math.floor(rng() * 420_000)
      const marginRate = 0.36 + rng() * 0.12
      orders.push({
        externalId: `ch_nurture_${String(index).padStart(5, '0')}`,
        contactId: contact.contactId,
        email: contact.email,
        revenueMinor,
        costMinor: Math.round(revenueMinor * (1 - marginRate)),
        feesMinor: Math.round(revenueMinor * 0.014 + 20),
        occurredAt: at(0.2 + rng() * 0.78),
        description: 'Domestic roof repair',
      })
    }
  }
  return { orders, touches }
}

/**
 * daily paid media spend plus what the platforms claim. meta claims about
 * twice the conversions the first-party data can support; google is closer.
 */
export function generatePaidMedia(
  options: { seed?: number; now?: Date; days?: number } = {},
): ChannelEvent[] {
  const rng = createRng(options.seed ?? 99)
  const now = options.now ?? new Date('2026-10-10T09:00:00Z')
  const days = options.days ?? 84
  const channels = [
    { key: 'meta_ads', dailySpend: 9_000, claimedConversions: 0.9, claimedAov: 380_000 },
    {
      key: 'google_ads',
      dailySpend: 6_500,
      claimedConversions: 0.35,
      claimedAov: 420_000,
    },
  ]
  const events: ChannelEvent[] = []
  for (let d = days; d >= 1; d--) {
    const day = daysAgo(now, d)
    const dayKey = day.toISOString().slice(0, 10)
    const occurredAt = `${dayKey}T12:00:00.000Z`
    for (const channel of channels) {
      const spend = Math.round(channel.dailySpend * (0.8 + rng() * 0.4))
      events.push({
        sourceEventId: `spend_${channel.key}_${dayKey}`,
        contactId: null,
        type: 'spend',
        channelKey: channel.key,
        source: channel.key,
        occurredAt,
        valueMinor: spend,
        properties: { currency: 'GBP' },
      })
      const conversions = Math.round(channel.claimedConversions * (0.5 + rng() * 1.5))
      events.push({
        sourceEventId: `platform_${channel.key}_${dayKey}`,
        contactId: null,
        type: 'platform_report',
        channelKey: channel.key,
        source: channel.key,
        occurredAt,
        valueMinor: conversions * channel.claimedAov,
        properties: { conversions, attributionWindow: '7d_click_1d_view' },
      })
    }
  }
  return events
}
