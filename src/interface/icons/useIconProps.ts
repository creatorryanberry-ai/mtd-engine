import { type ColorTokens } from 'tamagui'

import { getIconSize } from './helpers'
import { useResolvedIconColor } from './resolveIconColor'

import type { IconProps } from './types'

export const useIconProps = ({
  size,
  color = '$color11' as ColorTokens,
  ...restProps
}: IconProps) => {
  const sizeValue = getIconSize(size)
  const fill = useResolvedIconColor(color)

  return {
    width: sizeValue,
    height: sizeValue,
    fill,
    ...restProps,
  }
}
