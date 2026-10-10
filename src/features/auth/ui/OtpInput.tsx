import { getClipboardText } from '@mtd/helpers'
import { memo, useEffect, useRef, useState } from 'react'
import {
  SizableText,
  Input as TamaguiInput,
  useWindowDimensions,
  View,
  XStack,
  YStack,
  type InputProps,
} from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { inputCaretColor, inputFocusStyle, type Input } from '~/interface/forms/Input'
import { ClipboardIcon } from '~/interface/icons/phosphor/ClipboardIcon'

export const OTP_FOCUS_DELAY_MS = 650

export interface IOtpInput {
  otpCount?: number
  onCodeFilled?: (code: string) => void
  onCodeChanged?: (code: string) => void
  isError?: boolean
  defaultValue?: string
  autoFocus?: boolean
  'data-testid'?: string
  inputProps?: InputProps
}

export const OtpInput = memo(function OtpInput({
  otpCount = 6,
  onCodeFilled,
  onCodeChanged,
  isError: _isError = false,
  defaultValue = '',
  autoFocus = false,
  'data-testid': testId,
  inputProps,
}: IOtpInput) {
  const { width: windowWidth } = useWindowDimensions()
  const width = Math.min(340, windowWidth)

  const inputRef = useRef<Array<Input>>([])

  useEffect(() => {
    if (!autoFocus) return
    const timer = setTimeout(() => {
      inputRef.current[0]?.focus()
    }, OTP_FOCUS_DELAY_MS)
    return () => clearTimeout(timer)
  }, [autoFocus])

  const [otpValue, setOtpValue] = useState<string[]>(() => {
    if (defaultValue) {
      const values = defaultValue.split('').slice(0, otpCount)
      return [...values, ...Array(otpCount - values.length).fill('')]
    }
    return Array(otpCount).fill('')
  })

  const inputWidth = (width - 58) / otpCount

  const handlePasteValue = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, otpCount)
    const newOtpValue = Array(otpCount).fill('')
    for (let i = 0; i < digits.length; i++) {
      newOtpValue[i] = digits[i] ?? ''
    }
    setOtpValue(newOtpValue)

    if (digits.length >= otpCount) {
      inputRef.current[otpCount - 1]?.blur()
    } else {
      const nextIndex = Math.min(digits.length, otpCount - 1)
      inputRef.current[nextIndex]?.focus()
    }
  }

  const onFocusNext = (value: string, index: number) => {
    if (value.length > 1) {
      handlePasteValue(value)
      return
    }

    const newOtpValue = [...otpValue]
    newOtpValue[index] = value
    setOtpValue(newOtpValue)

    if (index < otpCount - 1 && value) {
      inputRef.current[index + 1]?.focus()
    } else if (index === otpCount - 1) {
      inputRef.current[index]?.blur()
    }
  }

  const onFocusPrevious = (key: string, index: number) => {
    if (key === 'Backspace') {
      if (index !== 0) {
        inputRef.current[index - 1]?.focus()
        const newOtpValue = [...otpValue]
        newOtpValue[index - 1] = ''
        setOtpValue(newOtpValue)
      } else {
        const newOtpValue = [...otpValue]
        newOtpValue[0] = ''
        setOtpValue(newOtpValue)
      }
    }
  }

  const handlePaste = async () => {
    const text = await getClipboardText()
    if (text) {
      handlePasteValue(text)
    }
  }

  const codeString = otpValue.join('')
  const isFilled = codeString.length === otpCount

  useEffect(() => {
    onCodeChanged?.(codeString)
    if (isFilled) {
      onCodeFilled?.(codeString)
    }
  }, [onCodeChanged, onCodeFilled, codeString, isFilled])

  return (
    <YStack gap="$3">
      <XStack gap={8}>
        {Array(otpCount)
          .fill(null)
          .map((_, i) => {
            return (
              <View key={i} position="relative">
                <TamaguiInput
                  testID={testId ? `${testId}-${i}` : undefined}
                  width={inputWidth}
                  height={inputWidth}
                  rounded={12}
                  type="number"
                  ref={(ref) => {
                    if (ref) inputRef.current[i] = ref
                  }}
                  fontSize="$5"
                  fontWeight="500"
                  textAlign="center"
                  value={otpValue[i]}
                  onChange={(e) => onFocusNext((e.target as HTMLInputElement).value, i)}
                  onKeyDown={(e) => onFocusPrevious(e.nativeEvent.key, i)}
                  autoComplete="one-time-code"
                  autoFocus={false}
                  borderWidth={0.5}
                  showSoftInputOnFocus
                  cursorColor={inputCaretColor}
                  caretColor={inputCaretColor}
                  selectionColor={inputCaretColor}
                  focusStyle={inputFocusStyle}
                  focusVisibleStyle={inputFocusStyle}
                  {...(inputProps as any)}
                />
              </View>
            )
          })}
      </XStack>

      <XStack
        onPress={handlePaste}
        self="center"
        items="center"
        gap="$2"
        cursor="pointer"
        pressStyle={{ opacity: 0.8 }}
        pointerEvents="box-only"
        {...(isFilled && {
          opacity: 0,
          pointerEvents: 'none',
        })}
      >
        <ClipboardIcon size={14} color={MTD_TOKENS.textMuted} />
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
          Paste code
        </SizableText>
      </XStack>
    </YStack>
  )
})
