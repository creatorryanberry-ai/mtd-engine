import { Text } from 'react-native'

import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'

export function EstimatePoundsText({
  pounds,
  fontSize = 20,
  fontWeight = '700',
}: {
  pounds: number
  fontSize?: number
  fontWeight?: '600' | '700'
}) {
  const { brand } = useBrandTheme()

  return (
    <Text
      style={{
        fontSize,
        lineHeight: Math.round(fontSize * 1.25),
        fontWeight,
        color: brand.colors.text,
      }}
    >
      {formatSubmissionAmount(pounds)}
    </Text>
  )
}
