import type { ReactNode } from 'react'
import { SizableText, XStack, YStack } from 'tamagui'

import { MtdAccentMutedBg } from '~/features/mtd/components/MtdAccentMutedBg'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdSelectionColors } from '~/features/mtd/useMtdSelectionColors'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'

type YearEndOptionRowProps = {
  label: string
  selected: boolean
  onPress: () => void
  icon: ReactNode
}

export function YearEndOptionRow({
  label,
  selected,
  onPress,
  icon,
}: YearEndOptionRowProps) {
  const { borderColor, textColor, iconColor } = useMtdSelectionColors(selected)

  return (
    <MtdAccentMutedBg
      accent={selected}
      row
      width="100%"
      px="$4"
      py="$3.5"
      gap="$3"
      rounded="$4"
      borderWidth={1}
      borderColor={borderColor}
      items="center"
      cursor="pointer"
      pressStyle={{ opacity: 0.9 }}
      onPress={onPress}
    >
      <YStack
        width={36}
        height={36}
        rounded="$3"
        bg={MTD_TOKENS.cardInset}
        items="center"
        justify="center"
        shrink={0}
      >
        {icon}
      </YStack>
      <SizableText
        flex={1}
        fontSize={15}
        fontWeight={selected ? '600' : '500'}
        color={textColor}
        lineHeight={22}
      >
        {label}
      </SizableText>
      {selected ? (
        <CheckIcon size={20} color={iconColor} />
      ) : (
        <XStack width={20} height={20} shrink={0} />
      )}
    </MtdAccentMutedBg>
  )
}
