import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Theme, YStack } from 'tamagui'

import { MTD_THEME_NAME } from '~/tamagui/themes'
import { TamaguiRootProvider } from '~/tamagui/TamaguiRootProvider'

import '../src/interface/fonts/jetbrains.css'
import '../src/tamagui/tamagui.css'

import type { Preview } from '@storybook/react'

const preview: Preview = {
  parameters: {
    layout: 'centered',
    backgrounds: {
      default: 'mtd',
      values: [{ name: 'mtd', value: '#050505' }],
    },
  },
  decorators: [
    (Story) => (
      <TamaguiRootProvider>
        <Theme name={MTD_THEME_NAME}>
          <SafeAreaProvider>
            <YStack p="$4" minW={280}>
              <Story />
            </YStack>
          </SafeAreaProvider>
        </Theme>
      </TamaguiRootProvider>
    ),
  ],
}

export default preview
