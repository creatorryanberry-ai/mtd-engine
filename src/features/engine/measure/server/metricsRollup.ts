import { and, asc, eq, gte, inArray, lte, notInArray, sql } from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  engineEvent,
  engineMetricsDaily,
  engineOrder,
  engineWorkspace,
} from '~/database/engineSchema'

import { newId } from '../../core/ids'
import { DEFAULT_LOOKBACK_DAYS, creditTouches, parseTimestamp } from '../attribution'
import {
  addChannelCredit,
  addDays,
  applyEventAggregate,
  dayStartIso,
  emptyDayMetrics,
  hasActivity,
  listDays,
  roundCredit,
  utcDay,
} from '../metricsMath'
import { NON_REVENUE_ORDER_STATUSES, loadOutcomesWithTouches } from './touches'

import type { MetricsDailyRowDto } from '../../contract'
import type { ChannelCredit, DayMetrics, EventAggregate } from '../metricsMath'

/**
 * daily metrics rollup into engineMetricsDaily (campaignId and armId stay 'all'
 * in phase 2). days are utc YYYY-MM-DD, ranges inclusive.
 *
 * channel 'all' (written for every day in range, zeros included, so a missing
 * row means the rollup did not run):
 * - revenue, gross profit, conversions (= paid orders) and new customers from
 *   engineOrder with status not pending / failed
 * - impressions, clicks, spend, unsubscribes, complaints from events of every channel
 * - platform conversions / revenue summed over platform_report events, null when none
 *
 * per channel (only days with activity or credit):
 * - the same event-derived counts for that channel
 * - conversions, new customers, revenue and gross profit credited by first-party
 *   last touch with a 30-day lookback. credit is fractional in general, so it is
 *   summed per channel per day and rounded half-even once at the end; per-channel
 *   sums can differ from the 'all' row by rounding and because 'all' counts
 *   orders without a contact or touch.
 */

const ROLLUP_EVENT_TYPES = [
  'impression',
  'click',
  'spend',
  'unsubscribe',
  'complaint',
  'platform_report',
]

const ALL = 'all'

type RollupRow = typeof engineMetricsDaily.$inferInsert

function utcDayExpr(
  column: typeof engineEvent.occurredAt | typeof engineOrder.occurredAt,
) {
  return sql<string>`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`
}

export async function rollupWorkspaceDays(
  workspaceId: string,
  fromDay: string,
  toDay: string,
): Promise<{ days: number; rows: number }> {
  const days = listDays(fromDay, toDay)
  if (days.length === 0) return { days: 0, rows: 0 }
  const fromIso = dayStartIso(fromDay)
  const toIso = dayStartIso(addDays(toDay, 1))

  const [workspace] = await drizzle
    .select({ currency: engineWorkspace.currency })
    .from(engineWorkspace)
    .where(eq(engineWorkspace.id, workspaceId))
    .limit(1)
  if (!workspace) return { days: 0, rows: 0 }

  const eventDay = utcDayExpr(engineEvent.occurredAt)
  const orderDay = utcDayExpr(engineOrder.occurredAt)

  const [eventRows, orderRows, outcomes] = await Promise.all([
    drizzle
      .select({
        day: eventDay,
        channelKey: engineEvent.channelKey,
        type: engineEvent.type,
        count: sql<number>`count(*)::int`,
        valueMinor: sql<number>`coalesce(sum(${engineEvent.valueMinor}), 0)::float8`,
        platformConversions: sql<number>`coalesce(sum(CASE WHEN jsonb_typeof(${engineEvent.properties}->'conversions') = 'number' THEN (${engineEvent.properties}->>'conversions')::float8 ELSE 0 END), 0)::float8`,
      })
      .from(engineEvent)
      .where(
        and(
          eq(engineEvent.workspaceId, workspaceId),
          inArray(engineEvent.type, ROLLUP_EVENT_TYPES),
          gte(engineEvent.occurredAt, fromIso),
          sql`${engineEvent.occurredAt} < ${toIso}`,
        ),
      )
      .groupBy(eventDay, engineEvent.channelKey, engineEvent.type),
    drizzle
      .select({
        day: orderDay,
        orders: sql<number>`count(*)::int`,
        newCustomers: sql<number>`count(*) FILTER (WHERE ${engineOrder.isFirstOrder})::int`,
        revenue: sql<number>`coalesce(sum(${engineOrder.revenueMinor}), 0)::float8`,
        grossProfit: sql<number>`coalesce(sum(${engineOrder.grossProfitMinor}), 0)::float8`,
      })
      .from(engineOrder)
      .where(
        and(
          eq(engineOrder.workspaceId, workspaceId),
          gte(engineOrder.occurredAt, fromIso),
          sql`${engineOrder.occurredAt} < ${toIso}`,
          notInArray(engineOrder.status, NON_REVENUE_ORDER_STATUSES),
        ),
      )
      .groupBy(orderDay),
    loadOutcomesWithTouches({
      workspaceId,
      fromIso,
      toIso,
      lookbackDays: DEFAULT_LOOKBACK_DAYS,
    }),
  ])

  const allByDay = new Map<string, DayMetrics>()
  const channelByKey = new Map<string, DayMetrics>()
  for (const raw of eventRows) {
    const row: EventAggregate = {
      day: raw.day,
      channelKey: raw.channelKey,
      type: raw.type,
      count: Number(raw.count),
      valueMinor: Number(raw.valueMinor),
      platformConversions: Number(raw.platformConversions),
    }
    const all = allByDay.get(row.day) ?? emptyDayMetrics()
    applyEventAggregate(all, row)
    allByDay.set(row.day, all)
    if (row.channelKey && row.channelKey !== ALL) {
      const key = `${row.day}|${row.channelKey}`
      const channel = channelByKey.get(key) ?? emptyDayMetrics()
      applyEventAggregate(channel, row)
      channelByKey.set(key, channel)
    }
  }

  const credit = new Map<string, ChannelCredit>()
  for (const outcome of outcomes) {
    const shares = creditTouches(outcome.touches, outcome.occurredAt, 'last_touch')
    const day = utcDay(new Date(parseTimestamp(outcome.occurredAt)))
    for (const [channelKey, share] of Object.entries(shares)) {
      if (channelKey === ALL) continue
      addChannelCredit(credit, `${day}|${channelKey}`, share, {
        revenueMinor: outcome.revenueMinor,
        grossProfitMinor: outcome.grossProfitMinor,
        isNewCustomer: outcome.type === 'first_purchase',
      })
    }
  }

  const ordersByDay = new Map(orderRows.map((row) => [row.day, row]))
  const computedAt = new Date().toISOString()
  const base = {
    workspaceId,
    campaignId: ALL,
    armId: ALL,
    currency: workspace.currency,
    computedAt,
  }
  const rows: RollupRow[] = []

  for (const day of days) {
    const events = allByDay.get(day) ?? emptyDayMetrics()
    const orders = ordersByDay.get(day)
    rows.push({
      ...base,
      id: newId('md'),
      day,
      channelKey: ALL,
      ...events,
      conversions: Number(orders?.orders ?? 0),
      newCustomers: Number(orders?.newCustomers ?? 0),
      revenueMinor: Math.round(Number(orders?.revenue ?? 0)),
      grossProfitMinor: Math.round(Number(orders?.grossProfit ?? 0)),
    })
  }

  const channelKeys = new Set([...channelByKey.keys(), ...credit.keys()])
  for (const key of channelKeys) {
    const [day, channelKey] = key.split('|') as [string, string]
    const events = channelByKey.get(key) ?? emptyDayMetrics()
    const credited = credit.get(key)
    if (!credited && !hasActivity(events)) continue
    const rounded = roundCredit(
      credited ?? {
        conversions: 0,
        newCustomers: 0,
        revenueMinor: 0,
        grossProfitMinor: 0,
      },
    )
    rows.push({ ...base, id: newId('md'), day, channelKey, ...events, ...rounded })
  }

  await drizzle.transaction(async (tx) => {
    // rows from earlier runs that no longer have data are removed, the rest upserted
    await tx.delete(engineMetricsDaily).where(
      and(
        eq(engineMetricsDaily.workspaceId, workspaceId),
        gte(engineMetricsDaily.day, fromDay),
        lte(engineMetricsDaily.day, toDay),
        eq(engineMetricsDaily.campaignId, ALL),
        eq(engineMetricsDaily.armId, ALL),
        notInArray(
          sql`${engineMetricsDaily.day} || '|' || ${engineMetricsDaily.channelKey}`,
          rows.map((row) => `${row.day}|${row.channelKey}`),
        ),
      ),
    )
    const chunkSize = 500
    for (let i = 0; i < rows.length; i += chunkSize) {
      await tx
        .insert(engineMetricsDaily)
        .values(rows.slice(i, i + chunkSize))
        .onConflictDoUpdate({
          target: [
            engineMetricsDaily.workspaceId,
            engineMetricsDaily.day,
            engineMetricsDaily.channelKey,
            engineMetricsDaily.campaignId,
            engineMetricsDaily.armId,
          ],
          set: {
            spendMinor: sql`excluded."spendMinor"`,
            impressions: sql`excluded."impressions"`,
            clicks: sql`excluded."clicks"`,
            conversions: sql`excluded."conversions"`,
            newCustomers: sql`excluded."newCustomers"`,
            revenueMinor: sql`excluded."revenueMinor"`,
            grossProfitMinor: sql`excluded."grossProfitMinor"`,
            unsubscribes: sql`excluded."unsubscribes"`,
            complaints: sql`excluded."complaints"`,
            platformConversions: sql`excluded."platformConversions"`,
            platformRevenueMinor: sql`excluded."platformRevenueMinor"`,
            currency: sql`excluded."currency"`,
            computedAt: sql`excluded."computedAt"`,
          },
        })
    }
  })

  return { days: days.length, rows: rows.length }
}

export type WorkspaceRollupResult = {
  workspaceId: string
  days: number
  rows: number
  error: string | null
}

/** every workspace; callers run this under bypass (the job) */
export async function rollupAllWorkspaces(
  fromDay: string,
  toDay: string,
): Promise<WorkspaceRollupResult[]> {
  const workspaces = await drizzle
    .select({ id: engineWorkspace.id })
    .from(engineWorkspace)
    .orderBy(asc(engineWorkspace.id))
  const results: WorkspaceRollupResult[] = []
  for (const workspace of workspaces) {
    try {
      const result = await rollupWorkspaceDays(workspace.id, fromDay, toDay)
      results.push({ workspaceId: workspace.id, ...result, error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error('[engine:metrics] rollup failed', workspace.id, error)
      results.push({ workspaceId: workspace.id, days: 0, rows: 0, error: message })
    }
  }
  return results
}

/** inclusive day range, oldest first; every channel unless channelKey is given */
export async function listMetricsDaily(
  workspaceId: string,
  query: { fromDay: string; toDay: string; channelKey?: string },
): Promise<{ items: MetricsDailyRowDto[] }> {
  const rows = await drizzle
    .select({
      day: engineMetricsDaily.day,
      channelKey: engineMetricsDaily.channelKey,
      spendMinor: engineMetricsDaily.spendMinor,
      impressions: engineMetricsDaily.impressions,
      clicks: engineMetricsDaily.clicks,
      conversions: engineMetricsDaily.conversions,
      newCustomers: engineMetricsDaily.newCustomers,
      revenueMinor: engineMetricsDaily.revenueMinor,
      grossProfitMinor: engineMetricsDaily.grossProfitMinor,
      unsubscribes: engineMetricsDaily.unsubscribes,
      complaints: engineMetricsDaily.complaints,
      platformConversions: engineMetricsDaily.platformConversions,
      platformRevenueMinor: engineMetricsDaily.platformRevenueMinor,
      currency: engineMetricsDaily.currency,
      computedAt: engineMetricsDaily.computedAt,
    })
    .from(engineMetricsDaily)
    .where(
      and(
        eq(engineMetricsDaily.workspaceId, workspaceId),
        gte(engineMetricsDaily.day, query.fromDay),
        lte(engineMetricsDaily.day, query.toDay),
        eq(engineMetricsDaily.campaignId, ALL),
        eq(engineMetricsDaily.armId, ALL),
        query.channelKey
          ? eq(engineMetricsDaily.channelKey, query.channelKey)
          : undefined,
      ),
    )
    .orderBy(asc(engineMetricsDaily.day), asc(engineMetricsDaily.channelKey))
  return {
    items: rows.map((row) => ({
      ...row,
      computedAt: new Date(parseTimestamp(row.computedAt)).toISOString(),
    })),
  }
}
