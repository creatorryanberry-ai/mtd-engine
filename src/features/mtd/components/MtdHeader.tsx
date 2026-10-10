import { router, type Href } from 'one'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { isWeb } from 'tamagui'

import { openSettings } from '~/features/mtd/mtdNavigationSession'
import { Pressable } from '~/interface/buttons/Pressable'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'
import { CuratorLogo } from './CuratorLogo'
import { MTD_TOKENS } from '../mtdTokens'

function HeaderBar() {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 56,
      }}
    >
      <CuratorLogo />
      <Pressable
        aria-label="Settings"
        onPress={() => openSettings((href) => router.push(href as Href))}
        width={40}
        height={40}
        items="center"
        justify="center"
      >
        <GearIcon size={22} color={MTD_TOKENS.text} />
      </Pressable>
    </View>
  )
}

export function MtdHeader() {
  if (isWeb) {
    return (
      <View style={{ marginBottom: 0 }}>
        <HeaderBar />
      </View>
    )
  }

  return (
    <SafeAreaView edges={['top']} style={{ marginBottom: 0 }}>
      <HeaderBar />
    </SafeAreaView>
  )
}
