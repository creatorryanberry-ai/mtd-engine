import { SizableText, YStack } from 'tamagui'

import { useMtdSelectionColors } from '../useMtdSelectionColors'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'

type MtdRadioOptionProps = {
  label: string
  selected: boolean
  onPress: () => void
  flex?: number
}

export function MtdRadioOption({ label, selected, onPress, flex }: MtdRadioOptionProps) {
  const { borderColor, iconColor, textColor } = useMtdSelectionColors(selected)

  return (
    <MtdAccentMutedBg
      accent={selected}
      row
      flex={flex}
      minW={0}
      self={flex != null ? undefined : 'flex-start'}
      px="$3"
      py="$3"
      gap="$2.5"
      rounded="$4"
      borderWidth={1}
      borderColor={borderColor}
      items="center"
      cursor="pointer"
      pressStyle={{ opacity: 0.9 }}
      onPress={onPress}
    >
      <YStack
        width={16}
        height={16}
        rounded="$10"
        borderWidth={2}
        borderColor={borderColor}
        items="center"
        justify="center"
        shrink={0}
      >
        {selected ? <YStack width={8} height={8} rounded="$10" bg={iconColor} /> : null}
      </YStack>
      <SizableText
        flex={flex != null ? 1 : undefined}
        shrink={flex != null ? 1 : 0}
        fontSize={15}
        fontWeight={selected ? '600' : '500'}
        color={textColor}
        lineHeight={20}
        numberOfLines={flex != null ? 1 : undefined}
      >
        {label}
      </SizableText>
    </MtdAccentMutedBg>
  )
}
