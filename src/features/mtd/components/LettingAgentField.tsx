import { useEffect, useMemo, useRef, useState } from 'react'
import { SizableText, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { mtdInputProps } from '~/features/mtd/mtdFormStyles'
import { Input, type Input as InputElement } from '~/interface/forms/Input'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'

type LettingAgentFieldProps = {
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  autoFocus?: boolean
}

export function LettingAgentField({
  value,
  onChange,
  suggestions,
  autoFocus = false,
}: LettingAgentFieldProps) {
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<InputElement | null>(null)

  useEffect(() => {
    if (!autoFocus) return

    const timer = setTimeout(() => {
      inputRef.current?.focus()
    }, 50)

    return () => clearTimeout(timer)
  }, [autoFocus])

  const filtered = useMemo(() => {
    const query = value.trim().toLowerCase()
    const matches = query
      ? suggestions.filter((agent) => agent.toLowerCase().includes(query))
      : suggestions
    return matches.slice(0, 6)
  }, [suggestions, value])

  const showSuggestions = focused && filtered.length > 0

  return (
    <YStack gap="$1.5" position="relative" z={showSuggestions ? 20 : 0}>
      <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
        Letting Agent
      </SizableText>
      <Input
        ref={inputRef}
        value={value}
        onChangeText={onChange}
        placeholder="Letting agent name"
        autoCapitalize="words"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // delay so suggestion press can register
          setTimeout(() => setFocused(false), 150)
        }}
        {...mtdInputProps}
      />
      {showSuggestions ? (
        <YStack
          position="absolute"
          t="100%"
          l={0}
          r={0}
          mt="$1"
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$4"
          overflow="hidden"
          z={30}
        >
          {filtered.map((agent) => (
            <MtdAccentMutedBg
              key={agent}
              accent={agent.toLowerCase() === value.trim().toLowerCase()}
              fallbackBg="transparent"
              px="$3.5"
              py="$3"
              pressStyle={{ opacity: 0.9 }}
              onPress={() => {
                onChange(agent)
                setFocused(false)
              }}
            >
              <SizableText fontSize={15} color={MTD_TOKENS.text}>
                {agent}
              </SizableText>
            </MtdAccentMutedBg>
          ))}
        </YStack>
      ) : null}
    </YStack>
  )
}
