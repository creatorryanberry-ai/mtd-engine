import { formatMileageDisplayDate } from '~/features/mileage/utils/mileageClaim'
import { formatWeekdaySummary } from '~/features/mileage/utils/mileageOccurrences'

import type { MileageRecurrenceType } from '~/features/mileage/utils/mileageOccurrences'

export type MileageSeriesStatus = 'active' | 'ended' | 'stopped'

export function getMileageSeriesStatus(
  series: { active: boolean; endDate: string },
  today: string,
): MileageSeriesStatus {
  if (!series.active) return 'stopped'
  if (series.endDate < today) return 'ended'
  return 'active'
}

export function formatMileageSeriesStatus(status: MileageSeriesStatus): string {
  if (status === 'stopped') return 'Stopped'
  if (status === 'ended') return 'Ended'
  return 'Active'
}

export function formatMileageSeriesRepeatLabel(input: {
  recurrenceType: MileageRecurrenceType
  selectedWeekdays: number[]
}): string {
  if (input.recurrenceType === 'daily') return 'Daily'
  if (input.recurrenceType === 'monthly') return 'Monthly'
  const weekdays = formatWeekdaySummary(input.selectedWeekdays)
  return weekdays ? `Weekly (${weekdays})` : 'Weekly'
}

export function formatMileageJourneyDescription(
  fromLocation: string | null | undefined,
  journeyDetails: string,
) {
  const from = fromLocation?.trim() ?? ''
  const to = journeyDetails.trim()
  if (from && to) return `${from} → ${to}`
  return to || from
}

export function formatMileageSeriesSubtitle(input: {
  recurrenceType: MileageRecurrenceType
  selectedWeekdays: number[]
  startDate: string
  endDate: string
}): string {
  const range = `${formatMileageDisplayDate(input.startDate)} – ${formatMileageDisplayDate(input.endDate)}`
  if (input.recurrenceType === 'daily') return `Daily · ${range}`
  if (input.recurrenceType === 'monthly') return `Monthly · ${range}`
  const weekdays = formatWeekdaySummary(input.selectedWeekdays) || 'Weekly'
  return `${weekdays} · ${range}`
}
