import { and, eq, gte, inArray, isNotNull, lt, ne, sql } from 'drizzle-orm'
import * as v from 'valibot'

import { drizzle } from '~/database/db'
import { engineExperiment, engineMetricsDaily } from '~/database/engineSchema'

import { experimentResultSchema } from '../../contract'
import { ATTRIBUTION_MODELS, creditTouches } from '../attribution'
import { addDays, roundHalfEven } from '../metricsMath'
import { attributionFlags, combineExperimentLifts } from '../triangulation'
import { loadOutcomesWithTouches, outcomeTotals } from './touches'

import type {
  AttributionChannelDto,
  AttributionModelValue,
  AttributionReportDto,
} from '../../contract'
import type { ExperimentPrimary } from '../triangulation'
import type { EngineWorkspace } from '~/database/engineSchema'

/**
 * triangulated attribution over [from, to) (utc days, `to` exclusive):
 * - first party: the newest 5000 outcomes with a contact, credited to the
 *   contact's touches inside the lookback under every model
 * - platform: platform_report numbers from engineMetricsDaily, null when the
 *   channel never reported
 * - experiment: holdout-backed incremental gross profit from running or
 *   completed experiments on the channel that overlap the window
 * - mmm: null until phase 7
 * the sources are never blended; disagreements become flags (see triangulation.ts).
 */

export const ATTRIBUTION_OUTCOME_CAP = 5000

type Credit = { conversions: number; grossProfitMinor: number }

function emptyCredit(): Credit {
  return { conversions: 0, grossProfitMinor: 0 }
}

function roundCreditValue(credit: Credit): Credit {
  return {
    conversions: Math.round(credit.conversions * 100) / 100,
    grossProfitMinor: roundHalfEven(credit.grossProfitMinor),
  }
}

export async function buildAttributionReport(
  workspace: Pick<EngineWorkspace, 'id' | 'currency'>,
  input: { from: string; to: string; model: AttributionModelValue; lookbackDays: number },
): Promise<AttributionReportDto> {
  const fromIso = `${input.from}T00:00:00.000Z`
  const toIso = `${input.to}T00:00:00.000Z`
  const lastDay = addDays(input.to, -1)

  const [outcomes, totals, metricRows, experimentRows] = await Promise.all([
    loadOutcomesWithTouches({
      workspaceId: workspace.id,
      fromIso,
      toIso,
      lookbackDays: input.lookbackDays,
      limit: ATTRIBUTION_OUTCOME_CAP,
    }),
    outcomeTotals(workspace.id, fromIso, toIso),
    drizzle
      .select({
        channelKey: engineMetricsDaily.channelKey,
        spend: sql<number>`coalesce(sum(${engineMetricsDaily.spendMinor}), 0)::float8`,
        platformRows: sql<number>`(count(${engineMetricsDaily.platformConversions}) + count(${engineMetricsDaily.platformRevenueMinor}))::int`,
        platformConversions: sql<number>`coalesce(sum(${engineMetricsDaily.platformConversions}), 0)::float8`,
        platformRevenue: sql<number>`coalesce(sum(${engineMetricsDaily.platformRevenueMinor}), 0)::float8`,
      })
      .from(engineMetricsDaily)
      .where(
        and(
          eq(engineMetricsDaily.workspaceId, workspace.id),
          ne(engineMetricsDaily.channelKey, 'all'),
          eq(engineMetricsDaily.campaignId, 'all'),
          eq(engineMetricsDaily.armId, 'all'),
          gte(engineMetricsDaily.day, input.from),
          sql`${engineMetricsDaily.day} <= ${lastDay}`,
        ),
      )
      .groupBy(engineMetricsDaily.channelKey),
    drizzle
      .select({
        id: engineExperiment.id,
        channelKey: engineExperiment.channelKey,
        result: engineExperiment.result,
      })
      .from(engineExperiment)
      .where(
        and(
          eq(engineExperiment.workspaceId, workspace.id),
          isNotNull(engineExperiment.channelKey),
          inArray(engineExperiment.status, ['running', 'completed']),
          lt(
            sql`coalesce(${engineExperiment.startsAt}, ${engineExperiment.createdAt})`,
            toIso,
          ),
          sql`(${engineExperiment.endsAt} IS NULL OR ${engineExperiment.endsAt} >= ${fromIso})`,
        ),
      ),
  ])

  // first-party credit under every model
  const byChannel = new Map<string, Record<AttributionModelValue, Credit>>()
  let attributedOutcomes = 0
  for (const outcome of outcomes) {
    let credited = false
    for (const model of ATTRIBUTION_MODELS) {
      const shares = creditTouches(outcome.touches, outcome.occurredAt, model)
      for (const [channelKey, share] of Object.entries(shares)) {
        credited = true
        const entry =
          byChannel.get(channelKey) ??
          (Object.fromEntries(
            ATTRIBUTION_MODELS.map((m) => [m, emptyCredit()]),
          ) as Record<AttributionModelValue, Credit>)
        entry[model].conversions += share
        entry[model].grossProfitMinor += share * outcome.grossProfitMinor
        byChannel.set(channelKey, entry)
      }
    }
    if (credited) attributedOutcomes++
  }

  const spendByChannel = new Map<string, number>()
  const platformByChannel = new Map<
    string,
    { conversions: number; revenueMinor: number }
  >()
  for (const row of metricRows) {
    spendByChannel.set(row.channelKey, Math.round(Number(row.spend)))
    if (Number(row.platformRows) > 0) {
      platformByChannel.set(row.channelKey, {
        conversions: Math.round(Number(row.platformConversions)),
        revenueMinor: Math.round(Number(row.platformRevenue)),
      })
    }
  }

  const experimentsByChannel = new Map<string, ExperimentPrimary[]>()
  for (const row of experimentRows) {
    if (!row.channelKey || !row.result) continue
    const parsed = v.safeParse(experimentResultSchema, row.result)
    if (!parsed.success) continue
    const primary = parsed.output.primary
    if (
      !primary ||
      primary.metric !== 'gross_profit_per_contact' ||
      primary.incrementalGrossProfitMinor == null
    ) {
      continue
    }
    const list = experimentsByChannel.get(row.channelKey) ?? []
    list.push({
      incrementalGrossProfitMinor: primary.incrementalGrossProfitMinor,
      incrementalCiLowMinor: primary.incrementalCiLowMinor,
      incrementalCiHighMinor: primary.incrementalCiHighMinor,
    })
    experimentsByChannel.set(row.channelKey, list)
  }

  const channelKeys = new Set(
    [
      ...byChannel.keys(),
      ...spendByChannel.keys(),
      ...platformByChannel.keys(),
      ...experimentRows.map((row) => row.channelKey),
    ].filter((key): key is string => !!key && key !== 'all'),
  )

  const channels: AttributionChannelDto[] = [...channelKeys].map((channelKey) => {
    const credits = byChannel.get(channelKey)
    const byModel: Record<string, Credit> = {}
    for (const model of ATTRIBUTION_MODELS) {
      byModel[model] = roundCreditValue(credits?.[model] ?? emptyCredit())
    }
    const firstParty = byModel[input.model]!
    const spendMinor = spendByChannel.get(channelKey) ?? 0
    const platform = platformByChannel.get(channelKey) ?? null
    const experiment = combineExperimentLifts(experimentsByChannel.get(channelKey) ?? [])
    return {
      channelKey,
      spendMinor,
      firstParty,
      byModel,
      platform,
      experiment,
      mmm: null,
      flags: attributionFlags({
        channelKey,
        spendMinor,
        firstParty,
        firstPartyLastTouch: byModel.last_touch!,
        platform,
        experiment,
      }),
    }
  })

  channels.sort(
    (a, b) =>
      b.firstParty.grossProfitMinor - a.firstParty.grossProfitMinor ||
      b.spendMinor - a.spendMinor ||
      a.channelKey.localeCompare(b.channelKey),
  )

  return {
    from: input.from,
    to: input.to,
    currency: workspace.currency,
    model: input.model,
    lookbackDays: input.lookbackDays,
    totals: {
      outcomes: totals.outcomes,
      attributedOutcomes,
      unattributedOutcomes: Math.max(0, totals.outcomes - attributedOutcomes),
      grossProfitMinor: Math.round(totals.grossProfitMinor),
    },
    channels,
  }
}
