import { and, eq, sql } from 'drizzle-orm'
import * as v from 'valibot'

import { drizzle } from '~/database/db'
import {
  engineExperiment,
  engineExperimentArm,
  engineWorkspace,
} from '~/database/engineSchema'
import { experimentResultSchema } from '~/features/engine/contract'
import { httpError } from '~/features/engine/core/server/httpError'
import { countExclusions, sortArms } from '~/features/engine/measure/server/assignment'
import {
  classifyLift,
  meanOf,
  probabilityTreatmentBetter,
  proportionDifference,
  relativeLift,
  sampleRatioMismatch,
  varianceOf,
  welchDifference,
} from '~/features/engine/measure/stats'

import type { ExperimentResultDto } from '~/features/engine/contract'
import type { ExclusionCounts } from '~/features/engine/measure/server/assignment'
import type { Counts, Interval, Moments } from '~/features/engine/measure/stats'

export const HOLDOUT_KEY = 'holdout'
export const SRM_THRESHOLD = 0.001

type ComparisonDto = ExperimentResultDto['comparisons'][number]
type GroupDto = ExperimentResultDto['groups'][number]
type ComparisonMetric = ComparisonDto['metric']

/** per group sufficient statistics straight from sql: assigned contacts and per-contact gross profit */
export type GroupAggregate = {
  /** arm id, or 'holdout' */
  key: string
  n: number
  /** contacts with at least one outcome */
  conversions: number
  sum: number
  sumSq: number
}

export type ResultArm = { id: string; name: string; isControl: boolean; weight: number }

export type BuildExperimentResultInput = {
  successMetric: string
  holdoutRate: number
  minSamplePerArm: number
  currency: string
  arms: ResultArm[]
  aggregates: GroupAggregate[]
  windowFrom: string
  windowTo: string
  computedAt: string
  exclusions?: ExclusionCounts
}

type Group = GroupDto & { moments: Moments; counts: Counts }

function finiteOrNull(value: number | null | undefined) {
  return value != null && Number.isFinite(value) ? value : null
}

function roundedOrNull(value: number | null | undefined) {
  const finite = finiteOrNull(value)
  return finite == null ? null : Math.round(finite)
}

function toGroup(
  key: string,
  label: string,
  flags: { isHoldout: boolean; isControl: boolean },
  aggregate: GroupAggregate | undefined,
): Group {
  const moments: Moments = {
    n: aggregate?.n ?? 0,
    sum: aggregate?.sum ?? 0,
    sumSq: aggregate?.sumSq ?? 0,
  }
  const counts: Counts = { n: moments.n, conversions: aggregate?.conversions ?? 0 }
  return {
    key,
    label,
    ...flags,
    n: moments.n,
    conversions: counts.conversions,
    conversionRate: moments.n > 0 ? counts.conversions / moments.n : 0,
    grossProfitMinor: Math.round(moments.sum),
    meanGrossProfitMinor: meanOf(moments),
    sdGrossProfitMinor: Math.sqrt(varianceOf(moments)),
    moments,
    counts,
  }
}

function relativeFields(interval: Interval, baselineLevel: number) {
  const relative = relativeLift(interval, baselineLevel)
  return {
    relativeLift: finiteOrNull(relative?.estimate),
    relativeCiLow: finiteOrNull(relative?.low),
    relativeCiHigh: finiteOrNull(relative?.high),
  }
}

function grossProfitComparison(
  treatment: Group,
  baseline: Group,
  minSample: number,
): ComparisonDto {
  const interval = welchDifference(treatment.moments, baseline.moments)
  const scale = treatment.n
  return {
    treatmentKey: treatment.key,
    baselineKey: baseline.key,
    metric: 'gross_profit_per_contact',
    diff: interval.estimate,
    ciLow: finiteOrNull(interval.low),
    ciHigh: finiteOrNull(interval.high),
    ...relativeFields(interval, meanOf(baseline.moments)),
    pValue: finiteOrNull(interval.pValue),
    probabilityBetter: null,
    verdict: classifyLift({
      low: interval.low,
      high: interval.high,
      nTreatment: treatment.n,
      nBaseline: baseline.n,
      minSample,
    }),
    incrementalGrossProfitMinor: Math.round(interval.estimate * scale),
    incrementalCiLowMinor: roundedOrNull(interval.low * scale),
    incrementalCiHighMinor: roundedOrNull(interval.high * scale),
  }
}

function conversionComparison(
  treatment: Group,
  baseline: Group,
  minSample: number,
): ComparisonDto {
  const interval = proportionDifference(treatment.counts, baseline.counts)
  // a rate over zero contacts is undefined, whatever the score interval says
  const defined = treatment.n > 0 && baseline.n > 0
  return {
    treatmentKey: treatment.key,
    baselineKey: baseline.key,
    metric: 'conversion_rate',
    diff: interval.estimate,
    ciLow: defined ? finiteOrNull(interval.low) : null,
    ciHigh: defined ? finiteOrNull(interval.high) : null,
    ...relativeFields(interval, baseline.conversionRate),
    pValue: defined ? finiteOrNull(interval.pValue) : null,
    probabilityBetter: defined
      ? finiteOrNull(probabilityTreatmentBetter(treatment.counts, baseline.counts))
      : null,
    verdict: classifyLift({
      low: interval.low,
      high: interval.high,
      nTreatment: treatment.n,
      nBaseline: baseline.n,
      minSample,
    }),
    incrementalGrossProfitMinor: null,
    incrementalCiLowMinor: null,
    incrementalCiHighMinor: null,
  }
}

export function comparisonMetricFor(successMetric: string): ComparisonMetric {
  return successMetric === 'conversion_rate'
    ? 'conversion_rate'
    : 'gross_profit_per_contact'
}

/** intended shares in group order: holdout first (when present), then arms by weight */
function intendedShares(holdoutRate: number, arms: ResultArm[], withHoldout: boolean) {
  const rate = withHoldout ? holdoutRate : 0
  const totalWeight = arms.reduce((acc, arm) => acc + Math.max(arm.weight, 0), 0)
  const armShares = arms.map((arm) =>
    totalWeight > 0
      ? ((1 - rate) * Math.max(arm.weight, 0)) / totalWeight
      : (1 - rate) / arms.length,
  )
  return withHoldout ? [rate, ...armShares] : armShares
}

/** pure: raw group statistics and experiment config to the result the api returns */
export function buildExperimentResult(
  input: BuildExperimentResultInput,
): ExperimentResultDto {
  const byKey = new Map(input.aggregates.map((aggregate) => [aggregate.key, aggregate]))
  const minSample = input.minSamplePerArm
  const withHoldout = input.holdoutRate > 0 || (byKey.get(HOLDOUT_KEY)?.n ?? 0) > 0

  const armGroups = input.arms.map((arm) =>
    toGroup(
      arm.id,
      arm.name,
      { isHoldout: false, isControl: arm.isControl },
      byKey.get(arm.id),
    ),
  )
  const holdout = withHoldout
    ? toGroup(
        HOLDOUT_KEY,
        'Holdout',
        { isHoldout: true, isControl: false },
        byKey.get(HOLDOUT_KEY),
      )
    : null
  const groups = holdout ? [holdout, ...armGroups] : armGroups

  const control = armGroups.find((group) => group.isControl) ?? null
  const baseline = control ?? holdout
  const treatments = armGroups.filter((group) => group !== baseline && !group.isControl)

  const comparisons: ComparisonDto[] = []
  if (baseline) {
    for (const treatment of treatments) {
      comparisons.push(grossProfitComparison(treatment, baseline, minSample))
      comparisons.push(conversionComparison(treatment, baseline, minSample))
    }
    if (control && holdout && input.holdoutRate > 0) {
      comparisons.push(grossProfitComparison(control, holdout, minSample))
      comparisons.push(conversionComparison(control, holdout, minSample))
    }
  }

  const primaryMetric = comparisonMetricFor(input.successMetric)
  const firstTreatment = treatments[0]
  const primary =
    baseline && firstTreatment
      ? (comparisons.find(
          (comparison) =>
            comparison.treatmentKey === firstTreatment.key &&
            comparison.baselineKey === baseline.key &&
            comparison.metric === primaryMetric,
        ) ?? null)
      : null

  const srmTest = sampleRatioMismatch(
    groups.map((group) => group.n),
    intendedShares(input.holdoutRate, input.arms, withHoldout),
  )
  const srm = {
    chiSquare: finiteOrNull(srmTest.chiSquare) ?? 0,
    pValue: finiteOrNull(srmTest.pValue) ?? 1,
    mismatch: srmTest.pValue < SRM_THRESHOLD,
  }

  const warnings: string[] = []
  if (srm.mismatch) {
    warnings.push(
      `Sample ratio mismatch (chi-square p = ${srm.pValue.toPrecision(2)}): group sizes do not match the intended split, so these results are not trustworthy.`,
    )
  }
  const small = groups.filter((group) => group.n < minSample)
  if (small.length > 0) {
    const list = small.map((group) => `${group.label} (${group.n})`).join(', ')
    warnings.push(
      `Below the minimum sample of ${minSample} per group: ${list}. Verdicts stay collecting until every group reaches it.`,
    )
  }
  if (!baseline) {
    warnings.push('No baseline group: add a control arm or a holdout to measure lift.')
  }
  if (input.exclusions) {
    const { global_holdout, audience, consent } = input.exclusions
    const total = global_holdout + audience + consent
    if (total > 0) {
      warnings.push(
        `${total} contacts excluded (${global_holdout} global holdout, ${audience} outside the audience, ${consent} without consent).`,
      )
    }
  }

  return {
    computedAt: input.computedAt,
    windowFrom: input.windowFrom,
    windowTo: input.windowTo,
    currency: input.currency,
    primaryMetric:
      input.successMetric === 'conversion_rate'
        ? 'conversion_rate'
        : 'incremental_gross_profit',
    groups: groups.map(({ moments: _moments, counts: _counts, ...group }) => group),
    comparisons,
    primary,
    srm,
    warnings,
  }
}

/** the stored engineExperiment.result, or null when absent or from an older shape */
export function parseStoredResult(value: unknown): ExperimentResultDto | null {
  if (value == null) return null
  const parsed = v.safeParse(experimentResultSchema, value)
  return parsed.success ? parsed.output : null
}

type AggregateRow = {
  key: string | null
  n: number
  conversions: number
  sum: number
  sum_sq: number
}

/**
 * one aggregate query: per contact gross profit from purchase, first purchase and
 * deal won outcomes after assignment and inside the window, then moments per group
 */
async function groupAggregates(
  experimentId: string,
  windowFrom: string,
  windowTo: string,
) {
  const { rows } = await drizzle.execute<AggregateRow>(sql`
    with per_contact as (
      select
        a."armId" as arm_id,
        a."isHoldout" as is_holdout,
        count(o."id") as outcomes,
        coalesce(sum(o."grossProfitMinor"), 0)::float8 as gp
      from "engineAssignment" a
      left join "engineOutcome" o
        on o."workspaceId" = a."workspaceId"
        and o."contactId" = a."contactId"
        and o."type" in ('purchase', 'first_purchase', 'deal_won')
        and o."occurredAt" >= greatest(a."assignedAt", ${windowFrom}::timestamptz)
        and o."occurredAt" < ${windowTo}::timestamptz
      where a."experimentId" = ${experimentId}
      group by a."id"
    )
    select
      case when is_holdout then ${HOLDOUT_KEY} else arm_id end as key,
      count(*)::int as n,
      (count(*) filter (where outcomes > 0))::int as conversions,
      coalesce(sum(gp), 0)::float8 as sum,
      coalesce(sum(gp * gp), 0)::float8 as sum_sq
    from per_contact
    group by 1
  `)
  return rows.flatMap((row): GroupAggregate[] =>
    row.key == null
      ? []
      : [
          {
            key: row.key,
            n: Number(row.n),
            conversions: Number(row.conversions),
            sum: Number(row.sum),
            sumSq: Number(row.sum_sq),
          },
        ],
  )
}

async function loadExperimentForResult(experimentId: string) {
  const [row] = await drizzle
    .select({
      experiment: engineExperiment,
      currency: engineWorkspace.currency,
    })
    .from(engineExperiment)
    .innerJoin(engineWorkspace, eq(engineWorkspace.id, engineExperiment.workspaceId))
    .where(eq(engineExperiment.id, experimentId))
    .limit(1)
  if (!row) throw httpError(404, 'Experiment not found')
  const arms = await drizzle
    .select()
    .from(engineExperimentArm)
    .where(eq(engineExperimentArm.experimentId, experimentId))
  return { ...row, arms: sortArms(arms) }
}

/** outcomes count from max(assignment, start) until the earlier of end and now */
export async function computeExperimentResult(
  experimentId: string,
  now = new Date(),
): Promise<ExperimentResultDto> {
  const { experiment, currency, arms } = await loadExperimentForResult(experimentId)
  const windowFrom = new Date(experiment.startsAt ?? experiment.createdAt)
  const end = experiment.endsAt ? new Date(experiment.endsAt) : now
  const windowTo = end < now ? end : now

  const [aggregates, exclusions] = await Promise.all([
    groupAggregates(experimentId, windowFrom.toISOString(), windowTo.toISOString()),
    countExclusions(experimentId),
  ])

  return buildExperimentResult({
    successMetric: experiment.successMetric,
    holdoutRate: experiment.holdoutRate,
    minSamplePerArm: experiment.minSamplePerArm,
    currency,
    arms: arms.map((arm) => ({
      id: arm.id,
      name: arm.name,
      isControl: arm.isControl,
      weight: arm.weight,
    })),
    aggregates,
    windowFrom: windowFrom.toISOString(),
    windowTo: windowTo.toISOString(),
    computedAt: now.toISOString(),
    exclusions,
  })
}

/** recompute, store on the experiment and roll group totals onto the arms */
export async function refreshExperimentResult(
  experimentId: string,
  now = new Date(),
): Promise<ExperimentResultDto> {
  const result = await computeExperimentResult(experimentId, now)
  const updatedAt = now.toISOString()

  await drizzle
    .update(engineExperiment)
    .set({ result, updatedAt })
    .where(eq(engineExperiment.id, experimentId))

  for (const group of result.groups) {
    if (group.isHoldout) continue
    await drizzle
      .update(engineExperimentArm)
      .set({
        exposures: group.n,
        conversions: group.conversions,
        grossProfitMinor: group.grossProfitMinor,
        alpha: 1 + group.conversions,
        beta: 1 + group.n - group.conversions,
        updatedAt,
      })
      .where(
        and(
          eq(engineExperimentArm.id, group.key),
          eq(engineExperimentArm.experimentId, experimentId),
        ),
      )
  }
  return result
}
