import { dialogConfirm } from '~/interface/dialogs/actions'

import type { MileageEntryDto } from '~/features/mileage/client/useMileageEntries'

export async function confirmDeleteMileageEntry(entry: MileageEntryDto) {
  return dialogConfirm({
    title: 'Delete journey?',
    description: `Remove "${entry.journeyDetails}" from your mileage log? This cannot be undone.`,
  })
}

export async function confirmStopMileageSeries() {
  return dialogConfirm({
    title: 'Stop this repeating journey?',
    description:
      'The series will stop repeating. Existing journeys stay in your mileage log.',
    confirmText: 'Stop series',
  })
}
