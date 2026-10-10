#!/usr/bin/env bun

import { plugin } from 'bun'

import { cmd } from '@mtd/cli'

// server modules import 'server-only', which throws outside a react-server bundle.
// this script is server code, so stub the guard before the dynamic imports below.
plugin({
  name: 'stub-server-only',
  setup(build) {
    build.module('server-only', () => ({ exports: {}, loader: 'object' }))
    build.onResolve({ filter: /^server-only$/ }, () => ({ path: 'server-only' }))
  },
})

/**
 * seeds a synthetic business ("northstar roofing") into the engine for demos
 * and tests. idempotent: re-running updates in place. run with
 * `bun run:dev scripts/db/seed-engine.ts [--email demo@straightup.tax]`.
 */
await cmd`Seed the growth engine with a synthetic business`
  .args('--email string --seed number')
  .run(async ({ args }) => {
    const { enterBypassRlsContext, runWithUserDbContextAsync } =
      await import('@mtd/database')
    const { and, eq } = await import('drizzle-orm')
    const { drizzle } = await import('~/database/db')
    const schema = await import('~/database/schema')
    const engine = await import('~/database/engineSchema')
    const { DEMO_EMAIL } = await import('~/constants/app')
    const { newId, normalizeEmail } = await import('~/features/engine/core/ids')
    const { createWorkspace, listWorkspacesForUser } =
      await import('~/features/engine/core/server/workspaceService')
    const { listBrands, putBrandKit, updateBrand } =
      await import('~/features/engine/core/server/brandService')
    const { resolveContact } = await import('~/features/engine/sense/server/identity')
    const { ingestEvents } = await import('~/features/engine/sense/server/events')
    const { upsertOrderFromRevenue } =
      await import('~/features/engine/sense/server/orders')
    const { writeAudit, systemActor } =
      await import('~/features/engine/core/server/audit')
    const { generateSyntheticBusiness, SYNTHETIC_BRAND_KIT } =
      await import('~/features/engine/seed/syntheticBusiness')
    const { seedMeasurementDemo } =
      await import('~/features/engine/seed/server/seedMeasurement')

    const email = (args.email as string | undefined) ?? DEMO_EMAIL
    const normalized = normalizeEmail(email)
    if (!normalized) throw new Error(`invalid email ${email}`)

    enterBypassRlsContext()

    let [owner] = await drizzle
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.email, email))
      .limit(1)

    if (!owner) {
      // demo user is normally created lazily on first sign-in; create it now so the seed can attach
      const id = `seed-engine-owner`
      const now = new Date().toISOString()
      await drizzle
        .insert(schema.user)
        .values({
          id,
          name: 'Engine Demo',
          username: 'enginedemo',
          email,
          normalizedEmail: normalized,
          emailVerified: true,
          role: 'user',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
      await drizzle
        .insert(schema.userPublic)
        .values({
          id,
          name: 'Engine Demo',
          username: 'enginedemo',
          image: null,
          joinedAt: now,
        })
        .onConflictDoNothing()
      await drizzle
        .insert(schema.userState)
        .values({ userId: id, darkMode: false, hasOnboarded: true })
        .onConflictDoNothing()
      owner = { id }
      console.info(`created owner user ${email}`)
    }

    const WORKSPACE_NAME = 'Northstar Roofing'

    await runWithUserDbContextAsync(owner.id, async () => {
      enterBypassRlsContext()

      let workspace = (await listWorkspacesForUser(owner.id)).find(
        (w) => w.name === WORKSPACE_NAME,
      )
      if (!workspace) {
        workspace = await createWorkspace(owner.id, {
          name: WORKSPACE_NAME,
          currency: 'GBP',
          timezone: 'Europe/London',
        })
        console.info(`created workspace ${workspace.id}`)
      } else {
        console.info(`using workspace ${workspace.id}`)
      }
      const workspaceId = workspace.id

      const [brand] = await listBrands(workspaceId)
      if (!brand) throw new Error('workspace bootstrap did not create a default brand')
      await updateBrand(workspaceId, owner.id, brand.id, {
        name: WORKSPACE_NAME,
        websiteUrl: 'https://northstar-roofing.example',
        industry: 'Commercial roofing',
        market: 'both',
      })
      const kit = await putBrandKit(workspaceId, owner.id, brand.id, SYNTHETIC_BRAND_KIT)
      console.info(`brand kit v${kit.version}`)

      // products give the order ingestion a margin rate to estimate cost from
      for (const product of [
        {
          name: 'Single-ply flat roof system (per m²)',
          priceMinor: 9_500,
          grossMarginRate: 0.32,
        },
        { name: 'Domestic re-roof package', priceMinor: 850_000, grossMarginRate: 0.42 },
        {
          name: 'Planned maintenance contract (annual)',
          priceMinor: 240_000,
          grossMarginRate: 0.55,
        },
      ]) {
        const existing = await drizzle
          .select({ id: engine.engineProduct.id })
          .from(engine.engineProduct)
          .where(
            and(
              eq(engine.engineProduct.workspaceId, workspaceId),
              eq(engine.engineProduct.name, product.name),
            ),
          )
          .limit(1)
        if (existing.length === 0) {
          await drizzle.insert(engine.engineProduct).values({
            id: newId('pr'),
            workspaceId,
            brandId: brand.id,
            name: product.name,
            priceMinor: product.priceMinor,
            grossMarginRate: product.grossMarginRate,
            currency: 'GBP',
            source: 'seed',
          })
        }
      }

      const biz = generateSyntheticBusiness({
        seed: (args.seed as number | undefined) ?? 20261010,
      })

      const companyIds = new Map<string, string>()
      for (const company of biz.companies) {
        const [existing] = await drizzle
          .select({ id: engine.engineCompany.id })
          .from(engine.engineCompany)
          .where(
            and(
              eq(engine.engineCompany.workspaceId, workspaceId),
              eq(engine.engineCompany.domain, company.domain),
            ),
          )
          .limit(1)
        if (existing) {
          companyIds.set(company.key, existing.id)
          continue
        }
        const id = newId('co')
        await drizzle.insert(engine.engineCompany).values({
          id,
          workspaceId,
          name: company.name,
          domain: company.domain,
          industry: company.industry,
          sizeBand: company.sizeBand,
          country: 'GB',
          legalForm: company.legalForm,
          source: 'seed',
          externalIds: { hubspot: `seed-${company.key}` },
        })
        companyIds.set(company.key, id)
      }
      console.info(`companies: ${companyIds.size}`)

      const contactIds = new Map<string, string>()
      for (const contact of biz.contacts) {
        const row = await resolveContact({
          workspaceId,
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          jobTitle: contact.jobTitle,
          country: 'GB',
          companyId: contact.companyKey
            ? (companyIds.get(contact.companyKey) ?? null)
            : null,
          source: contact.source,
          lifecycleStage: contact.lifecycleStage,
          activityAt: contact.firstSeenAt,
          identities: [
            { kind: 'crm_id', provider: 'hubspot', value: `seed-${contact.key}` },
          ],
        })
        contactIds.set(contact.key, row.id)
        await drizzle
          .insert(engine.engineConsent)
          .values({
            id: newId('cs'),
            workspaceId,
            contactId: row.id,
            channel: 'email',
            status: contact.consent,
            lawfulBasis: contact.consent === 'corporate_subscriber' ? 'pecr' : 'uk_gdpr',
            source: 'seed',
          })
          .onConflictDoNothing()
      }
      console.info(`contacts: ${contactIds.size}`)

      const emailByKey = new Map(biz.contacts.map((c) => [c.key, c.email] as const))
      let ordersWritten = 0
      for (const order of biz.orders) {
        await upsertOrderFromRevenue(workspaceId, 'stripe', {
          externalId: order.externalId,
          status:
            order.refundedMinor === 0
              ? 'paid'
              : order.refundedMinor >= order.revenueMinor
                ? 'refunded'
                : 'partially_refunded',
          currency: 'GBP',
          revenueMinor: order.revenueMinor,
          costMinor: order.costMinor,
          feesMinor: order.feesMinor,
          refundedMinor: order.refundedMinor,
          occurredAt: order.occurredAt,
          customer: {
            email: emailByKey.get(order.contactKey) ?? null,
            externalId: `cus_${order.contactKey}`,
          },
          lineItems: [
            { name: order.description, quantity: 1, amountMinor: order.revenueMinor },
          ],
        })
        ordersWritten++
      }
      console.info(`orders: ${ordersWritten}`)

      const batch = biz.events.map((event) => ({
        type: event.type,
        occurredAt: event.occurredAt,
        contactId: event.contactKey ? (contactIds.get(event.contactKey) ?? null) : null,
        channelKey: event.channelKey,
        source: event.source,
        sourceEventId: event.sourceEventId,
        properties: event.properties,
      }))
      let accepted = 0
      let duplicates = 0
      for (let i = 0; i < batch.length; i += 250) {
        const result = await ingestEvents(workspaceId, batch.slice(i, i + 250), 'seed')
        accepted += result.accepted
        duplicates += result.duplicates
      }
      console.info(`events: ${accepted} new, ${duplicates} already present`)

      for (const deal of biz.deals) {
        await drizzle
          .insert(engine.engineDeal)
          .values({
            id: newId('dl'),
            workspaceId,
            contactId: contactIds.get(deal.contactKey) ?? null,
            companyId: deal.companyKey ? (companyIds.get(deal.companyKey) ?? null) : null,
            name: deal.name,
            stage: deal.stage,
            status: deal.status,
            amountMinor: deal.amountMinor,
            currency: 'GBP',
            source: 'hubspot',
            externalId: deal.externalId,
            closedAt: deal.closedAt,
          })
          .onConflictDoNothing()
      }
      console.info(`deals: ${biz.deals.length}`)

      // a connected-looking stripe connection without credentials so the integrations screen has state
      const [connection] = await drizzle
        .select({ id: engine.engineConnection.id })
        .from(engine.engineConnection)
        .where(
          and(
            eq(engine.engineConnection.workspaceId, workspaceId),
            eq(engine.engineConnection.provider, 'stripe'),
          ),
        )
        .limit(1)
      if (!connection) {
        await drizzle.insert(engine.engineConnection).values({
          id: newId('cn'),
          workspaceId,
          provider: 'stripe',
          externalAccountId: 'acct_seed_northstar',
          displayName: 'Northstar Roofing (seeded, no credentials)',
          status: 'connected',
          scopes: ['read_only'],
          settings: { seeded: true },
          lastSyncAt: new Date().toISOString(),
          connectedBy: owner.id,
        })
      }

      // starter learnings and hypotheses so the command centre and strategy board are not empty
      const learnings = [
        {
          statement:
            'Case-study led emails to main contractor QSs lift demo bookings vs product-led emails',
          grade: 'B',
          testType: 'ab',
          effectSize: 0.18,
          ciLow: 0.04,
          ciHigh: 0.32,
          sampleSize: 1_240,
          scope: 'channel',
          scopeId: 'email',
        },
        {
          statement:
            'Meta prospecting to domestic homeowners converts below cost of acquisition in winter',
          grade: 'C',
          testType: 'observational',
          effectSize: -0.22,
          ciLow: null,
          ciHigh: null,
          sampleSize: 310,
          scope: 'channel',
          scopeId: 'meta_ads',
        },
      ]
      for (const learning of learnings) {
        const [existing] = await drizzle
          .select({ id: engine.engineLearning.id })
          .from(engine.engineLearning)
          .where(
            and(
              eq(engine.engineLearning.workspaceId, workspaceId),
              eq(engine.engineLearning.statement, learning.statement),
            ),
          )
          .limit(1)
        if (existing) continue
        await drizzle.insert(engine.engineLearning).values({
          id: newId('lrn'),
          workspaceId,
          ...learning,
        })
      }

      const hypotheses = [
        {
          statement:
            'A 20-second site-walk video hook will lift demo bookings among mid-size contractors by 10%',
          channelKey: 'linkedin_organic',
          expectedEffect: 0.1,
          confidence: 0.4,
          priority: 0.04,
          budgetMinor: 50_000,
        },
        {
          statement:
            'Offering a free roof condition survey in nurture email step 3 will lift SQL rate by 15%',
          channelKey: 'email',
          expectedEffect: 0.15,
          confidence: 0.55,
          priority: 0.0825,
          budgetMinor: 0,
        },
      ]
      for (const hypothesis of hypotheses) {
        const [existing] = await drizzle
          .select({ id: engine.engineHypothesis.id })
          .from(engine.engineHypothesis)
          .where(
            and(
              eq(engine.engineHypothesis.workspaceId, workspaceId),
              eq(engine.engineHypothesis.statement, hypothesis.statement),
            ),
          )
          .limit(1)
        if (existing) continue
        await drizzle.insert(engine.engineHypothesis).values({
          id: newId('hyp'),
          workspaceId,
          brandId: brand.id,
          proposedBy: 'strategist',
          status: 'proposed',
          ...hypothesis,
        })
      }

      const measurement = await seedMeasurementDemo({ workspace, ownerId: owner.id })
      console.info(
        `measurement: ${measurement.nurtureLeads} nurture leads, ${measurement.assigned} assigned (${measurement.treated} treated), ${measurement.orders} experiment-window orders, ${measurement.touchesAccepted} new touches, ${measurement.mediaAccepted} new media events, rollup ${measurement.rollup.days} days / ${measurement.rollup.rows} rows`,
      )
      console.info(
        `experiment verdict: ${measurement.verdict}, incremental gross profit (minor): ${measurement.incrementalGrossProfitMinor}`,
      )

      await writeAudit({
        workspaceId,
        actor: systemActor('seed'),
        action: 'workspace.seeded',
        entityType: 'workspace',
        entityId: workspaceId,
        reasoning: 'synthetic business seeded for demo and tests',
        evidence: {
          contacts: contactIds.size,
          orders: ordersWritten,
          events: accepted,
          nurtureLeads: measurement.nurtureLeads,
          experimentId: measurement.experimentId,
        },
      })

      console.info(`done: open /engine/${workspaceId}`)
    })

    process.exit(0)
  })
