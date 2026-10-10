import { SizableText, XStack } from 'tamagui'

import { MileageRowContent } from '~/features/mileage/components/MileageRowContent'
import { confirmDeleteMileageEntry } from '~/features/mileage/utils/confirmDeleteMileageEntry'

import type { MileageEntryDto } from '~/features/mileage/client/useMileageEntries'

const DELETE_RED = '#991B1B'

type MileageSwipeableRowProps = {
  entry: MileageEntryDto
  fromLocation?: string | null
  onPress: () => void
  onPressSeries?: () => void
  onDelete: (entry: MileageEntryDto) => void | Promise<void>
}

export function MileageSwipeableRow({
  entry,
  fromLocation,
  onPress,
  onPressSeries,
  onDelete,
}: MileageSwipeableRowProps) {
  const handleDelete = async () => {
    if (!entry.seriesId) {
      const confirmed = await confirmDeleteMileageEntry(entry)
      if (!confirmed) return
    }

    await onDelete(entry)
  }

  return (
    <MileageRowContent
      entry={entry}
      fromLocation={fromLocation}
      onPress={onPress}
      onPressSeries={onPressSeries}
      trailing={
        <XStack
          ml="$2"
          px="$2.5"
          py="$1.5"
          rounded="$3"
          bg={DELETE_RED}
          cursor="pointer"
          pressStyle={{ opacity: 0.9 }}
          onPress={() => void handleDelete()}
          shrink={0}
        >
          <SizableText fontSize={11} fontWeight="700" color="#FFFFFF">
            Delete
          </SizableText>
        </XStack>
      }
    />
  )
}
