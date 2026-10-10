import type { FC } from 'react'
import type { SvgProps } from 'react-native-svg'
import type { ColorTokens, SizeTokens } from 'tamagui'

export type IconProps = SvgProps & {
  size?: number | SizeTokens
  /** Tamagui tokens (`$color12`) or hex (`#F97316`). */
  color?: ColorTokens | string
}

export type IconComponent = FC<IconProps>
