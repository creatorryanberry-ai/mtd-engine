import { addDays, formatPoints, formatSignedMinor, isoDay, titleCase } from './format'

import type { TransitionExperimentInput } from './engineApi'
import type {
  AttributionModelValue,
  EngineExperimentDto,
  ExperimentResultDto,
} from '~/features/engine/contract'

export type ExperimentComparison = ExperimentResultDto['comparisons'][number]
export type ExperimentGroup = ExperimentResultDto['groups'][number]
export type ExperimentKind = 'ab' | 'holdout'
export type ExperimentMetric = 'incremental_gross_profit' | 'conversion_rate'
export type TransitionTarget = TransitionExperimentInput['to']

export const KIND_OPTIONS: { id: ExperimentKind; label: string }[] = [
  { id: 'holdout', label: 'Holdout' },
  { id: 'ab', label: 'A/B test' },
]

export const METRIC_OPTIONS: { id: ExperimentMetric; label: string }[] = [
  { id: 'incremental_gross_profit', label: 'Gross profit per contact' },
  { id: 'conversion_rate', label: 'Conversion rate' },
]

export const LIFECYCLE_OPTIONS = [
  { id: 'lead', label: 'Lead' },
  { id: 'mql', label: 'MQL' },
  { id: 'sql', label: 'SQL' },
  { id: 'opportunity', label: 'Opportunity' },
  { id: 'customer', label: 'Customer' },
  { id: 'churned', label: 'Churned' },
]

/** channels every workspace can test even before they report any metrics */
export const DEFAULT_CHANNEL_KEYS = ['email', 'meta_ads', 'google_ads']

export const ATTRIBUTION_MODEL_OPTIONS: { id: AttributionModelValue; label: string }[] = [
  { id: 'last_touch', label: 'Last touch' },
  { id: 'first_touch', label: 'First touch' },
  { id: 'linear', label: 'Linear' },
  { id: 'time_decay', label: 'Time decay' },
  { id: 'position_based', label: 'Position based' },
]

export const ATTRIBUTION_MODEL_HELP: Record<AttributionModelValue, string> = {
  last_touch: 'All credit to the last touch before the outcome.',
  first_touch: 'All credit to the first touch in the lookback window.',
  linear: 'Credit split evenly across every touch.',
  time_decay: 'More credit to recent touches, halving every 7 days.',
  position_based:
    '40% to the first touch, 40% to the last, 20% shared across the middle.',
}

export function kindLabel(kind: string) {
  return kind === 'ab' ? 'A/B test' : kind === 'holdout' ? 'Holdout' : titleCase(kind)
}

export function metricLabel(metric: string) {
  switch (metric) {
    case 'incremental_gross_profit':
    case 'gross_profit_per_contact':
      return 'Gross profit per contact'
    case 'conversion_rate':
      return 'Conversion rate'
    default:
      return titleCase(metric)
  }
}

export function channelLabel(channelKey: string | null | undefined) {
  if (!channelKey) return 'Any channel'
  return titleCase(channelKey)
}

export function experimentStatusTone(status: string) {
  switch (status) {
    case 'running':
      return 'green' as const
    case 'paused':
      return 'blue' as const
    case 'completed':
      return 'purple' as const
    case 'aborted':
      return 'orange' as const
    default:
      return 'muted' as const
  }
}

export type TransitionAction = {
  to: TransitionTarget
  label: string
  title: string
  description: string
  variant: 'primary' | 'secondary'
}

const ABORT: TransitionAction = {
  to: 'aborted',
  label: 'Abort',
  title: 'Abort this experiment?',
  description:
    'The experiment stops and is marked aborted. Its result should not be used to make decisions. This cannot be undone.',
  variant: 'secondary',
}

const COMPLETE: TransitionAction = {
  to: 'completed',
  label: 'Complete',
  title: 'Complete this experiment?',
  description:
    'The experiment ends and its last computed result is kept as the final read. This cannot be undone, so refresh the results first if they are stale.',
  variant: 'secondary',
}

/** the transition graph: draft -> running, running <-> paused, -> completed | aborted */
export function transitionsFor(status: string): TransitionAction[] {
  switch (status) {
    case 'draft':
      return [
        {
          to: 'running',
          label: 'Start',
          title: 'Start this experiment?',
          description:
            'Everyone in the audience is assigned now, except contacts in the permanent holdout. Assignment is deterministic and never moves anyone afterwards, and arms, weights and the holdout share can no longer be edited.',
          variant: 'primary',
        },
        ABORT,
      ]
    case 'running':
      return [
        {
          to: 'paused',
          label: 'Pause',
          title: 'Pause this experiment?',
          description:
            'The experiment pauses. Contacts keep the group they were assigned to and you can resume at any time.',
          variant: 'secondary',
        },
        COMPLETE,
        ABORT,
      ]
    case 'paused':
      return [
        {
          to: 'running',
          label: 'Resume',
          title: 'Resume this experiment?',
          description:
            'The experiment runs again. Contacts keep the group they were assigned to.',
          variant: 'primary',
        },
        COMPLETE,
        ABORT,
      ]
    default:
      return []
  }
}

/** the gross-profit comparison for the primary treatment, whatever the primary metric */
export function primaryGrossProfitComparison(result: ExperimentResultDto | null) {
  if (!result) return null
  const gp = result.comparisons.filter(
    (comparison) => comparison.metric === 'gross_profit_per_contact',
  )
  if (result.primary) {
    const match = gp.find(
      (comparison) =>
        comparison.treatmentKey === result.primary?.treatmentKey &&
        comparison.baselineKey === result.primary?.baselineKey,
    )
    if (match) return match
  }
  return gp[0] ?? null
}

export function formatComparisonValue(
  metric: ExperimentComparison['metric'],
  value: number,
  currency: string,
) {
  return metric === 'conversion_rate'
    ? formatPoints(value)
    : formatSignedMinor(value, currency)
}

export function groupLabel(result: ExperimentResultDto, key: string) {
  return result.groups.find((group) => group.key === key)?.label ?? key
}

export function experimentPrimaryVerdict(experiment: EngineExperimentDto) {
  return experiment.result?.primary?.verdict ?? null
}

// --- periods ----------------------------------------------------------------------

export type MeasurePeriod = 'week' | '4w' | '12w'

export const PERIOD_OPTIONS: { id: MeasurePeriod; label: string }[] = [
  { id: 'week', label: 'This week' },
  { id: '4w', label: 'Last 4 weeks' },
  { id: '12w', label: 'Last 12 weeks' },
]

/** utc date range with an exclusive `to` of tomorrow, so today is included */
export function periodRange(period: MeasurePeriod, now = new Date()) {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const to = isoDay(addDays(today, 1))
  if (period === 'week') {
    const sinceMonday = (today.getUTCDay() + 6) % 7
    return { from: isoDay(addDays(today, -sinceMonday)), to }
  }
  const days = period === '4w' ? 28 : 84
  return { from: isoDay(addDays(today, -(days - 1))), to }
}
