import { and, eq, inArray, like } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  engineAssignment,
  engineConsent,
  engineContact,
  engineExperiment,
} from '~/database/engineSchema'

import { hashBucket, newId } from '../../core/ids'
import { systemActor } from '../../core/server/audit'
import {
  createExperiment,
  refreshExperiment,
  transitionExperiment,
} from '../../measure/server/experimentService'
import { rollupWorkspaceDays } from '../../measure/server/metricsRollup'
import { ingestEvents } from '../../sense/server/events'
import { upsertOrderFromRevenue } from '../../sense/server/orders'
import {
  generateNurtureAudience,
  generateNurtureOutcomes,
  generatePaidMedia,
} from '../syntheticMeasurement'

import type { EngineWorkspace } from '~/database/engineSchema'
import type { IngestEventInput } from '../../contract'
import type { ChannelEvent } from '../syntheticMeasurement'

const EXPERIMENT_NAME = 'Autumn nurture email'
const EXPERIMENT_DAYS = 42
const NURTURE_DOMAIN = '@nurture.example'
const DAY_MS = 86_400_000

function toIngest(event: ChannelEvent): IngestEventInput {
  return {
    type: event.type,
    occurredAt: event.occurredAt,
    contactId: event.contactId,
    channelKey: event.channelKey,
    source: event.source,
    sourceEventId: event.sourceEventId,
    valueMinor: event.valueMinor,
    currency: event.valueMinor === null ? null : 'GBP',
    properties: event.properties,
  }
}

async function ingestInBatches(workspaceId: string, events: ChannelEvent[]) {
  let accepted = 0
  for (let i = 0; i < events.length; i += 250) {
    const result = await ingestEvents(
      workspaceId,
      events.slice(i, i + 250).map(toIngest),
      'seed',
    )
    accepted += result.accepted
  }
  return accepted
}

/**
 * phase 2 demo: a 5,000-lead nurture audience, a holdout experiment on email
 * that started six weeks ago, the orders and touches it caused, paid media
 * spend with platform claims, and a 90-day metrics rollup. idempotent.
 * callers must run under an rls bypass context.
 */
export async function seedMeasurementDemo(input: {
  workspace: EngineWorkspace
  ownerId: string
  now?: Date
}) {
  const { workspace, ownerId } = input
  const now = input.now ?? new Date()
  const workspaceId = workspace.id
  const startedAt = new Date(now.getTime() - EXPERIMENT_DAYS * DAY_MS)

  const leads = generateNurtureAudience({ now })
  for (let i = 0; i < leads.length; i += 500) {
    const batch = leads.slice(i, i + 500)
    await drizzle
      .insert(engineContact)
      .values(
        batch.map((lead) => ({
          id: newId('ct'),
          workspaceId,
          email: lead.email,
          emailNormalized: lead.email,
          firstName: lead.firstName,
          lastName: lead.lastName,
          country: 'GB',
          lifecycleStage: lead.lifecycleStage,
          hashBucket: hashBucket(lead.email, workspaceId),
          source: 'web',
          firstSeenAt: lead.firstSeenAt,
          lastActivityAt: lead.firstSeenAt,
          createdAt: lead.firstSeenAt,
        })),
      )
      .onConflictDoNothing()
  }

  const contacts = await drizzle
    .select({ id: engineContact.id, email: engineContact.emailNormalized })
    .from(engineContact)
    .where(
      and(
        eq(engineContact.workspaceId, workspaceId),
        like(engineContact.emailNormalized, `%${NURTURE_DOMAIN}`),
      ),
    )
  const idByEmail = new Map(contacts.map((c) => [c.email ?? '', c.id] as const))

  for (let i = 0; i < leads.length; i += 500) {
    const values = leads.slice(i, i + 500).flatMap((lead) => {
      const contactId = idByEmail.get(lead.email)
      if (!contactId) return []
      return [
        {
          id: newId('cs'),
          workspaceId,
          contactId,
          channel: 'email',
          status: lead.consent,
          lawfulBasis: lead.consent === 'soft_optin' ? 'pecr' : 'uk_gdpr',
          source: 'web_form',
          recordedAt: lead.firstSeenAt,
        },
      ]
    })
    if (values.length > 0)
      await drizzle.insert(engineConsent).values(values).onConflictDoNothing()
  }

  let [experiment] = await drizzle
    .select({ id: engineExperiment.id, status: engineExperiment.status })
    .from(engineExperiment)
    .where(
      and(
        eq(engineExperiment.workspaceId, workspaceId),
        eq(engineExperiment.name, EXPERIMENT_NAME),
      ),
    )
    .limit(1)

  if (!experiment) {
    const created = await createExperiment(workspace, ownerId, {
      name: EXPERIMENT_NAME,
      kind: 'holdout',
      successMetric: 'incremental_gross_profit',
      channelKey: 'email',
      holdoutRate: 0.2,
      minSamplePerArm: 200,
      audience: { lifecycleStages: ['lead', 'mql'], requireConsentChannel: 'email' },
    })
    experiment = { id: created.id, status: created.status }
  }

  if (experiment.status === 'draft') {
    await transitionExperiment({
      workspace,
      experimentId: experiment.id,
      to: 'running',
      reason: 'seeded demo: three-step nurture email to warm leads, 20% holdout',
      actor: systemActor('seed'),
      now: startedAt,
    })
    // seed only: the service stamps assignment time with the database clock,
    // so align it to the backdated start so the window covers the demo orders
    await drizzle
      .update(engineAssignment)
      .set({ assignedAt: startedAt.toISOString() })
      .where(eq(engineAssignment.experimentId, experiment.id))
  }

  const assignments = await drizzle
    .select({
      contactId: engineAssignment.contactId,
      isHoldout: engineAssignment.isHoldout,
    })
    .from(engineAssignment)
    .where(
      and(
        eq(engineAssignment.experimentId, experiment.id),
        inArray(engineAssignment.contactId, [...idByEmail.values()]),
      ),
    )
  const treated = new Set(assignments.filter((a) => !a.isHoldout).map((a) => a.contactId))

  // everyone not in the treatment arm buys at the organic rate: experiment holdout,
  // permanent holdout, and leads excluded for consent alike
  const measured = leads.flatMap((lead) => {
    const contactId = idByEmail.get(lead.email)
    return contactId
      ? [{ contactId, email: lead.email, isHoldout: !treated.has(contactId) }]
      : []
  })
  const { orders, touches } = generateNurtureOutcomes({
    contacts: measured,
    startedAt,
    now,
  })

  for (const order of orders) {
    await upsertOrderFromRevenue(workspaceId, 'stripe', {
      externalId: order.externalId,
      status: 'paid',
      currency: 'GBP',
      revenueMinor: order.revenueMinor,
      costMinor: order.costMinor,
      feesMinor: order.feesMinor,
      refundedMinor: 0,
      occurredAt: order.occurredAt,
      customer: { email: order.email },
      lineItems: [
        { name: order.description, quantity: 1, amountMinor: order.revenueMinor },
      ],
    })
  }

  const touchesAccepted = await ingestInBatches(workspaceId, touches)
  const mediaAccepted = await ingestInBatches(workspaceId, generatePaidMedia({ now }))

  const toDay = new Date(now.getTime() - DAY_MS).toISOString().slice(0, 10)
  const fromDay = new Date(now.getTime() - 90 * DAY_MS).toISOString().slice(0, 10)
  const rollup = await rollupWorkspaceDays(workspaceId, fromDay, toDay)
  const result = await refreshExperiment(workspace, ownerId, experiment.id)

  return {
    nurtureLeads: leads.length,
    experimentId: experiment.id,
    treated: treated.size,
    assigned: assignments.length,
    orders: orders.length,
    touchesAccepted,
    mediaAccepted,
    rollup,
    verdict: result.primary?.verdict ?? null,
    incrementalGrossProfitMinor: result.primary?.incrementalGrossProfitMinor ?? null,
  }
}
