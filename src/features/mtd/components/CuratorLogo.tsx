import { Text, View } from 'react-native'

import { APP_NAME } from '~/constants/app'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'

const LOGO_SIZE = 24

export function CuratorLogo() {
  const { brand } = useBrandTheme()

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        overflow: 'visible',
        // android clips flush glyphs; keep the wordmark inside the box
        paddingTop: 4,
        paddingBottom: 4,
        paddingHorizontal: 6,
      }}
    >
      <Text
        allowFontScaling={false}
        style={{
          fontSize: LOGO_SIZE,
          lineHeight: LOGO_SIZE + 4,
          fontWeight: '700',
          letterSpacing: -0.5,
          color: brand.colors.text,
          // android: avoid extra font padding that confuses layout
          includeFontPadding: false,
        }}
      >
        {APP_NAME}
      </Text>
    </View>
  )
}
