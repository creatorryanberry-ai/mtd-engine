import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  lt,
  lte,
  notInArray,
  sql,
  sum,
} from 'drizzle-orm'

import { drizzle } from '~/database/db'
import {
  engineApproval,
  engineConnection,
  engineContact,
  engineDeal,
  engineExperiment,
  engineGuardrail,
  engineLearning,
  engineLlmCall,
  engineMetricsDaily,
  engineOrder,
} from '~/database/engineSchema'

import { microsToCents } from '../../core/money'
import { addDays, utcDay } from '../../measure/metricsMath'
import { computeIncrementalReport } from '../../measure/server/incremental'

import type { DashboardSummaryDto } from '../../contract'
import type { EngineWorkspace } from '~/database/engineSchema'

const NON_REVENUE_STATUSES = ['pending', 'failed']
const LLM_BUDGET_WARNING_RATIO = 0.8
const TREND_DAYS = 28

function toNumber(value: string | number | null | undefined) {
  if (value == null) return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** monday 00:00 utc of the week containing `now` (workspace timezone in a later phase) */
export function weekStart(now: Date) {
  const sinceMonday = (now.getUTCDay() + 6) % 7
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday),
  )
}

function monthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

async function orderTotals(workspaceId: string, from: string, to: string) {
  const [row] = await drizzle
    .select({
      grossProfit: sum(engineOrder.grossProfitMinor),
      revenue: sum(engineOrder.revenueMinor),
      orders: count(),
      newCustomers: count(sql`CASE WHEN ${engineOrder.isFirstOrder} THEN 1 END`),
    })
    .from(engineOrder)
    .where(
      and(
        eq(engineOrder.workspaceId, workspaceId),
        gte(engineOrder.occurredAt, from),
        lt(engineOrder.occurredAt, to),
        notInArray(engineOrder.status, NON_REVENUE_STATUSES),
      ),
    )
  return {
    grossProfit: toNumber(row?.grossProfit),
    revenue: toNumber(row?.revenue),
    orders: row?.orders ?? 0,
    newCustomers: row?.newCustomers ?? 0,
  }
}

export async function getDashboardSummary(
  workspace: EngineWorkspace,
  now = new Date(),
): Promise<DashboardSummaryDto> {
  const workspaceId = workspace.id
  const thisWeekFrom = weekStart(now)
  const lastWeekFrom = new Date(thisWeekFrom.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisFrom = thisWeekFrom.toISOString()
  const lastFrom = lastWeekFrom.toISOString()
  const nowIso = now.toISOString()
  const thisWeekDay = thisFrom.slice(0, 10)
  const monthFrom = monthStart(now).toISOString()
  const today = utcDay(now)
  const yesterday = addDays(today, -1)
  const trendFrom = addDays(today, -(TREND_DAYS - 1))

  const [
    thisWeek,
    lastWeek,
    [spendRow],
    [spendCap],
    [contactsRow],
    [newContactsRow],
    [openDealsRow],
    [wonDealsRow],
    [experimentsRow],
    [approvalsRow],
    learnings,
    [llmRow],
    connections,
    incremental,
    trendRows,
    [yesterdayRollup],
    [ordersBeforeToday],
  ] = await Promise.all([
    orderTotals(workspaceId, thisFrom, nowIso),
    orderTotals(workspaceId, lastFrom, thisFrom),
    drizzle
      .select({ spend: sum(engineMetricsDaily.spendMinor) })
      .from(engineMetricsDaily)
      .where(
        and(
          eq(engineMetricsDaily.workspaceId, workspaceId),
          gte(engineMetricsDaily.day, thisWeekDay),
          // per-channel rows repeat what the 'all' row already totals
          eq(engineMetricsDaily.channelKey, 'all'),
          eq(engineMetricsDaily.campaignId, 'all'),
          eq(engineMetricsDaily.armId, 'all'),
        ),
      ),
    drizzle
      .select({ config: engineGuardrail.config })
      .from(engineGuardrail)
      .where(
        and(
          eq(engineGuardrail.workspaceId, workspaceId),
          eq(engineGuardrail.kind, 'spend_cap'),
          eq(engineGuardrail.enabled, true),
        ),
      )
      .orderBy(asc(engineGuardrail.createdAt))
      .limit(1),
    drizzle
      .select({ total: count() })
      .from(engineContact)
      .where(eq(engineContact.workspaceId, workspaceId)),
    drizzle
      .select({ total: count() })
      .from(engineContact)
      .where(
        and(
          eq(engineContact.workspaceId, workspaceId),
          gte(engineContact.createdAt, thisFrom),
        ),
      ),
    drizzle
      .select({ total: count(), value: sum(engineDeal.amountMinor) })
      .from(engineDeal)
      .where(and(eq(engineDeal.workspaceId, workspaceId), eq(engineDeal.status, 'open'))),
    drizzle
      .select({ total: count() })
      .from(engineDeal)
      .where(
        and(
          eq(engineDeal.workspaceId, workspaceId),
          eq(engineDeal.status, 'won'),
          gte(engineDeal.closedAt, thisFrom),
        ),
      ),
    drizzle
      .select({ total: count() })
      .from(engineExperiment)
      .where(
        and(
          eq(engineExperiment.workspaceId, workspaceId),
          eq(engineExperiment.status, 'running'),
        ),
      ),
    drizzle
      .select({ total: count() })
      .from(engineApproval)
      .where(
        and(
          eq(engineApproval.workspaceId, workspaceId),
          eq(engineApproval.status, 'pending'),
        ),
      ),
    drizzle
      .select({
        id: engineLearning.id,
        statement: engineLearning.statement,
        grade: engineLearning.grade,
        status: engineLearning.status,
      })
      .from(engineLearning)
      .where(
        and(
          eq(engineLearning.workspaceId, workspaceId),
          eq(engineLearning.status, 'active'),
        ),
      )
      .orderBy(asc(engineLearning.grade), desc(engineLearning.observedAt))
      .limit(5),
    drizzle
      .select({ cost: sum(engineLlmCall.costMicros), calls: count() })
      .from(engineLlmCall)
      .where(
        and(
          eq(engineLlmCall.workspaceId, workspaceId),
          gte(engineLlmCall.createdAt, monthFrom),
        ),
      ),
    drizzle
      .select({
        provider: engineConnection.provider,
        status: engineConnection.status,
        lastSyncAt: engineConnection.lastSyncAt,
      })
      .from(engineConnection)
      .where(eq(engineConnection.workspaceId, workspaceId))
      .orderBy(asc(engineConnection.provider)),
    workspace.globalHoldoutRate > 0
      ? computeIncrementalReport(workspace, { from: thisFrom, to: nowIso })
      : Promise.resolve(null),
    drizzle
      .select({
        day: engineMetricsDaily.day,
        revenueMinor: engineMetricsDaily.revenueMinor,
        grossProfitMinor: engineMetricsDaily.grossProfitMinor,
        conversions: engineMetricsDaily.conversions,
        spendMinor: engineMetricsDaily.spendMinor,
      })
      .from(engineMetricsDaily)
      .where(
        and(
          eq(engineMetricsDaily.workspaceId, workspaceId),
          gte(engineMetricsDaily.day, trendFrom),
          lte(engineMetricsDaily.day, today),
          eq(engineMetricsDaily.channelKey, 'all'),
          eq(engineMetricsDaily.campaignId, 'all'),
          eq(engineMetricsDaily.armId, 'all'),
        ),
      )
      .orderBy(asc(engineMetricsDaily.day)),
    drizzle
      .select({ id: engineMetricsDaily.id })
      .from(engineMetricsDaily)
      .where(
        and(
          eq(engineMetricsDaily.workspaceId, workspaceId),
          eq(engineMetricsDaily.day, yesterday),
          eq(engineMetricsDaily.channelKey, 'all'),
          eq(engineMetricsDaily.campaignId, 'all'),
          eq(engineMetricsDaily.armId, 'all'),
        ),
      )
      .limit(1),
    drizzle
      .select({ id: engineOrder.id })
      .from(engineOrder)
      .where(
        and(
          eq(engineOrder.workspaceId, workspaceId),
          lt(engineOrder.occurredAt, `${today}T00:00:00.000Z`),
        ),
      )
      .limit(1),
  ])

  const capConfig = spendCap?.config
  const dailyCapMinor =
    capConfig && typeof capConfig.dailyCapMinor === 'number'
      ? capConfig.dailyCapMinor
      : null

  const monthCostCents = microsToCents(toNumber(llmRow?.cost))
  const monthBudgetCents = workspace.llmBudgetMonthlyCents

  const alerts: DashboardSummaryDto['alerts'] = []
  if (workspace.killSwitch) {
    alerts.push({
      id: 'kill_switch',
      level: 'critical',
      message: 'Kill switch is on: no autonomous action will run',
    })
  }
  if (monthBudgetCents > 0 && monthCostCents >= monthBudgetCents) {
    alerts.push({
      id: 'llm_budget',
      level: 'critical',
      message: 'Monthly LLM budget spent: the gateway is refusing calls',
    })
  } else if (
    monthBudgetCents > 0 &&
    monthCostCents > monthBudgetCents * LLM_BUDGET_WARNING_RATIO
  ) {
    const used = Math.round((monthCostCents / monthBudgetCents) * 100)
    alerts.push({
      id: 'llm_budget',
      level: 'warning',
      message: `${used}% of this month's LLM budget used`,
    })
  }
  if (incremental?.verdict === 'negative') {
    alerts.push({
      id: 'incremental_negative',
      level: 'critical',
      message:
        'Contacts outside the permanent holdout are producing less gross profit than the holdout this week',
    })
  }
  if (ordersBeforeToday && !yesterdayRollup) {
    alerts.push({
      id: 'metrics_rollup_stale',
      level: 'info',
      message: `Daily metrics have not been rolled up for ${yesterday}; trend and spend may be out of date`,
    })
  }
  for (const connection of connections) {
    if (connection.status === 'error') {
      alerts.push({
        id: `connection_${connection.provider}`,
        level: 'warning',
        message: `${connection.provider} connection needs attention`,
      })
    }
  }

  return {
    workspaceId,
    currency: workspace.currency,
    period: { from: thisFrom, to: nowIso },
    grossProfit: {
      thisWeekMinor: thisWeek.grossProfit,
      lastWeekMinor: lastWeek.grossProfit,
      incrementalThisWeekMinor: incremental?.incrementalMinor ?? null,
    },
    revenue: { thisWeekMinor: thisWeek.revenue, lastWeekMinor: lastWeek.revenue },
    orders: {
      thisWeek: thisWeek.orders,
      lastWeek: lastWeek.orders,
      newCustomersThisWeek: thisWeek.newCustomers,
    },
    spend: { thisWeekMinor: toNumber(spendRow?.spend), dailyCapMinor },
    contacts: { total: contactsRow?.total ?? 0, newThisWeek: newContactsRow?.total ?? 0 },
    deals: {
      open: openDealsRow?.total ?? 0,
      openValueMinor: toNumber(openDealsRow?.value),
      wonThisWeek: wonDealsRow?.total ?? 0,
    },
    experiments: { running: experimentsRow?.total ?? 0 },
    approvals: { pending: approvalsRow?.total ?? 0 },
    learnings,
    llm: { monthCostCents, monthBudgetCents, calls: llmRow?.calls ?? 0 },
    connections,
    alerts,
    incremental,
    trend: trendRows,
  }
}
