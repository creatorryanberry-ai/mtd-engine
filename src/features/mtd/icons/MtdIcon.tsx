import { IS_WEB } from '@mtd/helpers'
import { Svg, Path, Circle, Rect, Text as SvgText } from 'react-native-svg'

import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { MTD_TOKENS } from '../mtdTokens'
import { useResolvedIconColor } from '~/interface/icons/resolveIconColor'
import { mtdBrandColors } from '~/tamagui/themes'

import type { ColorTokens } from 'tamagui'

export type MtdIconProps = {
  size?: number
  color?: ColorTokens | string
}

/** MTD download step badge — custom card + arrow, not in Phosphor. */
export function DownloadBadgeIcon({
  size = 24,
  color = MTD_TOKENS.orange,
}: MtdIconProps) {
  const stroke = useResolvedIconColor(color)
  const cardFill = useResolvedIconColor(MTD_TOKENS.cardInset)

  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" fill="none">
      <Rect x="32" y="48" width="192" height="160" rx="16" fill={cardFill} />
      <Path
        d="M128,72v64m0,0-24-24m24,24,24-24M88,168h80"
        stroke={stroke}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/** Numbered step circles for MTD tab bar — bespoke, not a stock icon. */
export function StepNumberIcon({
  number,
  size = 24,
  color = MTD_TOKENS.orange,
  active = false,
}: MtdIconProps & { number: 1 | 2 | 3; active?: boolean }) {
  const { brand } = useBrandTheme()
  const fill = useResolvedIconColor(color)
  const accentCircle = useResolvedIconColor(MTD_TOKENS.orange)
  const inactiveTextFill = useResolvedIconColor(
    fill === accentCircle ? MTD_TOKENS.onOrange : MTD_TOKENS.text,
  )
  const textFill = active ? brand.colors.stepCircleActiveText : inactiveTextFill

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="12" fill={fill} />
      <SvgText
        x="12"
        y="16"
        fill={textFill}
        stroke="none"
        fontSize="13"
        fontWeight="700"
        textAnchor="middle"
        {...(IS_WEB ? { style: { fill: textFill, color: textFill } } : {})}
      >
        {number}
      </SvgText>
    </Svg>
  )
}

/** @deprecated use MTD_TOKENS.orange */
export const DEFAULT_MTD_ACCENT = mtdBrandColors.accent
