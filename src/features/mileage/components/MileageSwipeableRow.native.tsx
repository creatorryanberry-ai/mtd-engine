import { useCallback, useRef } from 'react'
import { StyleSheet, View } from 'react-native'
import Swipeable from 'react-native-gesture-handler/Swipeable'
import { Pressable as GesturePressable } from 'react-native-gesture-handler'
import { SizableText } from 'tamagui'

import { MileageRowContent } from '~/features/mileage/components/MileageRowContent'
import { confirmDeleteMileageEntry } from '~/features/mileage/utils/confirmDeleteMileageEntry'
import { lightImpact } from '~/interface/haptics/haptics'

import type { MileageEntryDto } from '~/features/mileage/client/useMileageEntries'

const ACTION_WIDTH = 88
const DELETE_RED = '#991B1B'

type MileageSwipeableRowProps = {
  entry: MileageEntryDto
  fromLocation?: string | null
  onPress: () => void
  onPressSeries?: () => void
  onDelete: (entry: MileageEntryDto) => void | Promise<void>
}

function DeleteActionButton({ onPress }: { onPress: () => void }) {
  return (
    <GesturePressable
      onPress={onPress}
      style={{
        width: ACTION_WIDTH,
        height: '100%',
        backgroundColor: DELETE_RED,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SizableText fontSize={13} fontWeight="700" color="#FFFFFF">
        Delete
      </SizableText>
    </GesturePressable>
  )
}

export function MileageSwipeableRow({
  entry,
  fromLocation,
  onPress,
  onPressSeries,
  onDelete,
}: MileageSwipeableRowProps) {
  const swipeableRef = useRef<Swipeable>(null)

  const handleDeletePress = useCallback(async () => {
    void lightImpact()
    swipeableRef.current?.close()

    if (!entry.seriesId) {
      const confirmed = await confirmDeleteMileageEntry(entry)
      if (!confirmed) return
    }

    await onDelete(entry)
  }, [entry, onDelete])

  const renderLeftActions = useCallback(
    () => (
      <View style={styles.actionSlot}>
        <DeleteActionButton onPress={() => void handleDeletePress()} />
      </View>
    ),
    [handleDeletePress],
  )

  return (
    <Swipeable
      ref={swipeableRef}
      friction={1}
      dragOffsetFromLeftEdge={4}
      leftThreshold={ACTION_WIDTH * 0.35}
      containerStyle={styles.container}
      overshootLeft={false}
      renderLeftActions={renderLeftActions}
    >
      <MileageRowContent
        entry={entry}
        fromLocation={fromLocation}
        onPress={onPress}
        onPressSeries={onPressSeries}
      />
    </Swipeable>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  actionSlot: {
    width: ACTION_WIDTH,
    height: '100%',
    flexDirection: 'row',
  },
})
