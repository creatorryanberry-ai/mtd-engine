import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker'
import { useState } from 'react'
import { Modal, Platform, Pressable as RNPressable } from 'react-native'
import { SizableText, XStack, YStack } from 'tamagui'

import {
  dateToIso,
  formatBusinessDateUk,
  isoToDate,
} from '~/features/business/businessDateFormat'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useIsDark } from '~/features/theme/useIsDark'

import { MtdDatePickerTrigger, type MtdDatePickerProps } from './MtdDatePickerTrigger'

function toPickerDate(isoDate: string) {
  if (!isoDate) return new Date()
  const next = isoToDate(isoDate)
  return Number.isNaN(next.getTime()) ? new Date() : next
}

function resolveMaxDate(maxDate?: string | false) {
  if (maxDate === false) return undefined
  if (maxDate) {
    const next = isoToDate(maxDate)
    return Number.isNaN(next.getTime()) ? new Date() : next
  }
  return new Date()
}

function resolveMinDate(minDate?: string) {
  if (!minDate) return undefined
  const next = isoToDate(minDate)
  return Number.isNaN(next.getTime()) ? undefined : next
}

function dateBounds(minimumDate?: Date, maximumDate?: Date) {
  return {
    ...(minimumDate ? { minimumDate } : {}),
    ...(maximumDate ? { maximumDate } : {}),
  }
}

export function MtdDatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  testID,
  title = 'Select date',
  minDate,
  maxDate,
  onOpen,
  onClose,
}: MtdDatePickerProps) {
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState(() => toPickerDate(value))
  const displayValue = value ? formatBusinessDateUk(value) : ''
  const themeVariant = useIsDark() ? 'dark' : 'light'
  const bounds = dateBounds(resolveMinDate(minDate), resolveMaxDate(maxDate))

  const closePicker = () => {
    setOpen(false)
    onClose?.()
  }

  const openPicker = () => {
    const next = toPickerDate(value)
    setPicked(next)
    onOpen?.()

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        mode: 'date',
        design: 'material',
        title,
        value: next,
        firstDayOfWeek: 1,
        ...bounds,
        onValueChange: (_event, date) => {
          onChange(dateToIso(date))
          onClose?.()
        },
        onDismiss: () => {
          onClose?.()
        },
      })
      return
    }

    setOpen(true)
  }

  return (
    <>
      <MtdDatePickerTrigger
        displayValue={displayValue}
        placeholder={placeholder}
        onPress={openPicker}
        testID={testID}
      />

      {Platform.OS === 'ios' && open ? (
        <Modal
          visible
          transparent
          animationType="slide"
          presentationStyle="overFullScreen"
          onRequestClose={closePicker}
        >
          <RNPressable
            onPress={closePicker}
            style={{
              flex: 1,
              justifyContent: 'flex-end',
              backgroundColor: 'rgba(0,0,0,0.4)',
            }}
          >
            <RNPressable onPress={(event) => event.stopPropagation()}>
              <YStack
                bg={MTD_TOKENS.card}
                borderTopLeftRadius="$6"
                borderTopRightRadius="$6"
                px="$4"
                pt="$3"
                pb="$6"
                gap="$3"
              >
                <XStack justify="space-between" items="center">
                  <MtdActionButton
                    size="compact"
                    variant="secondary"
                    onPress={closePicker}
                  >
                    Cancel
                  </MtdActionButton>
                  <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
                    {title}
                  </SizableText>
                  <MtdActionButton
                    size="compact"
                    onPress={() => {
                      onChange(dateToIso(picked))
                      closePicker()
                    }}
                    testID="business-setup-date-done"
                  >
                    Done
                  </MtdActionButton>
                </XStack>

                <DateTimePicker
                  mode="date"
                  display="spinner"
                  locale="en-GB"
                  value={picked}
                  themeVariant={themeVariant}
                  style={{ height: 216 }}
                  onChange={(_, date) => {
                    if (date) setPicked(date)
                  }}
                  {...bounds}
                />
              </YStack>
            </RNPressable>
          </RNPressable>
        </Modal>
      ) : null}
    </>
  )
}
