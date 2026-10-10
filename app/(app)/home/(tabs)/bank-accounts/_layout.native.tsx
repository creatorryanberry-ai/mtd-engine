import { Stack } from 'one'

import { DetailSlideCloseProvider } from '~/features/mtd/components/DetailSlideLayout'
import { SlideFromRightScreen } from '~/features/mtd/components/SlideFromRightScreen'
import { useMtdThemeColors } from '~/features/mtd/useMtdThemeColors'

export function BankAccountsLayout() {
  const colors = useMtdThemeColors()

  return (
    <SlideFromRightScreen>
      {(requestClose) => (
        <DetailSlideCloseProvider requestClose={requestClose}>
          <Stack
            screenOptions={{
              headerShown: false,
              animation: 'slide_from_right',
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </DetailSlideCloseProvider>
      )}
    </SlideFromRightScreen>
  )
}
