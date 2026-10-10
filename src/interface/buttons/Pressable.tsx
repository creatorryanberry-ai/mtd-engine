import { forwardRef } from 'react'
import { View, type TamaguiElement, type ViewProps } from 'tamagui'

import { composeHapticPressIn, type HapticStyle } from '~/interface/haptics/haptics'

export type PressableProps = ViewProps & {
  /**
   * press haptic. default light (`true`). set `false` to disable, or a named
   * style (`'medium'`, `'heavy'`, …) to override.
   */
  haptic?: HapticStyle
}

/**
 * shared pressable — default light haptic on press-in (native only).
 * prefer this over raw YStack/XStack + onPress when you want consistent feel.
 */
export const Pressable = forwardRef<TamaguiElement, PressableProps>(function Pressable(
  { haptic = true, onPressIn, disabled, ...props },
  ref,
) {
  return (
    <View
      ref={ref}
      hitSlop={10}
      pressStyle={{ opacity: 0.5 }}
      disabled={disabled}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      onPressIn={composeHapticPressIn(onPressIn, { haptic, disabled: Boolean(disabled) })}
      {...props}
    />
  )
})
