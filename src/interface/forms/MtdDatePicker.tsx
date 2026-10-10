import { useRef } from 'react'
import { isWeb } from 'tamagui'

import { formatBusinessDateUk } from '~/features/business/businessDateFormat'

import { MtdDatePickerTrigger, type MtdDatePickerProps } from './MtdDatePickerTrigger'

export type { MtdDatePickerProps } from './MtdDatePickerTrigger'

export function MtdDatePicker({
  value,
  onChange,
  placeholder = 'DD/MM/YYYY',
  testID,
  minDate,
  maxDate,
  onOpen,
  onClose,
}: MtdDatePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const displayValue = value ? formatBusinessDateUk(value) : ''
  const resolvedMax =
    maxDate === false ? undefined : (maxDate ?? new Date().toISOString().slice(0, 10))

  const openPicker = () => {
    onOpen?.()
    const input = inputRef.current
    if (!input) return
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker()
        return
      }
    } catch {
      // some browsers throw if showPicker runs outside a direct gesture
    }
    input.click()
  }

  return (
    <MtdDatePickerTrigger
      displayValue={displayValue}
      placeholder={placeholder}
      onPress={openPicker}
      testID={testID}
    >
      {isWeb ? (
        <input
          ref={inputRef}
          type="date"
          value={value}
          min={minDate}
          max={resolvedMax}
          onChange={(event) => {
            onChange(event.currentTarget.value)
            onClose?.()
            event.currentTarget.blur()
          }}
          onBlur={() => onClose?.()}
          style={{
            position: 'absolute',
            opacity: 0,
            width: 1,
            height: 1,
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </MtdDatePickerTrigger>
  )
}
