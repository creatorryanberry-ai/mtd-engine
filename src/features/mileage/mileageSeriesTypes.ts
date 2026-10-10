import type { MileageRecurrenceType } from '~/features/mileage/utils/mileageOccurrences'

export type MileageSeriesWriteInput = {
  fromLocation?: string | null
  journeyDetails: string
  milesPerJourney: number
  includesReturnJourney: boolean
  recurrenceType: MileageRecurrenceType
  selectedWeekdays: number[]
  startDate: string
  endDate: string
  excludedDates: string[]
}

export type MileageSeriesScope = 'entireSeries' | 'thisAndFuture'

export type MileageSeriesDto = MileageSeriesWriteInput & {
  id: string
  deletedDates: string[]
  active: boolean
  createdAt: string
  updatedAt: string
  journeyCount: number
  totalMiles: number
  claimPounds: number
}
