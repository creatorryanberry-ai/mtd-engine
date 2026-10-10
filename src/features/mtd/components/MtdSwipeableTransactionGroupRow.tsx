import type { ComponentProps } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '../mtdTokens'

import { MtdGroupedTransactionRow } from './MtdTransactionRowDetails'

type MtdSwipeableTransactionGroupRowProps = ComponentProps<
  typeof MtdGroupedTransactionRow
> & {
  onAccept?: () => void | Promise<void>
  onAddRule?: () => void
}

export function MtdSwipeableTransactionGroupRow({
  onAccept: _onAccept,
  onAddRule,
  ...props
}: MtdSwipeableTransactionGroupRowProps) {
  return (
    <YStack mb={12}>
      <MtdGroupedTransactionRow
        {...props}
        trailing={
          onAddRule ? (
            <XStack
              px="$2"
              py="$1"
              rounded="$3"
              bg={MTD_TOKENS.cardInset}
              borderWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              cursor="pointer"
              pressStyle={{ opacity: 0.85 }}
              onPress={onAddRule}
              shrink={0}
            >
              <SizableText fontSize={11} fontWeight="600" color={MTD_TOKENS.textMuted}>
                Add rule
              </SizableText>
            </XStack>
          ) : undefined
        }
      />
    </YStack>
  )
}
