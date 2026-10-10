import { usePathname } from 'one'

import type { Href } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, XStack, YStack, type ColorTokens } from 'tamagui'

import { Link } from '~/interface/app/Link'
import { allowSettingsNavigation } from '~/features/mtd/mtdNavigationSession'
import { openQuickAdd } from '~/features/mtd/quickAddEmitter'
import { MTD_TOKENS } from '../mtdTokens'
import type { MtdTabIcon } from '../constants'
import { getMtdActiveTab, getMtdTabHref } from '../mtdTabHelpers'
import { useMtdTabs } from '../useMtdTabs'
import { ArchiveIcon } from '~/interface/icons/phosphor/ArchiveIcon'
import { FileTextIcon } from '~/interface/icons/phosphor/FileTextIcon'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'
import { composeHapticPressIn } from '~/interface/haptics/haptics'

const tabIcons = {
  home: HouseIcon,
  records: FileTextIcon,
  submissions: ArchiveIcon,
  more: GearIcon,
} as const

function TabIcon({
  icon,
  color,
  size,
}: {
  icon: MtdTabIcon
  color: ColorTokens | string
  size: number
}) {
  const Icon = tabIcons[icon]
  return <Icon size={size} color={color} />
}

type BottomTabItemProps = {
  id: string
  label: string
  icon: MtdTabIcon
  active: boolean
}

function BottomTabItem({ id, label, icon, active }: BottomTabItemProps) {
  const inactiveColor = MTD_TOKENS.textSubtle
  const color = active ? MTD_TOKENS.orange : inactiveColor

  return (
    <Link href={getMtdTabHref(id) as Href} replace={!isWeb} aria-label={label} asChild>
      <YStack
        flex={1}
        items="center"
        justify="center"
        gap="$1"
        py="$2"
        px="$1"
        cursor="pointer"
        pressStyle={{ opacity: 0.75 }}
        onPress={() => {
          if (id === 'more' && process.env.VITE_NATIVE) {
            allowSettingsNavigation()
          }
        }}
      >
        <TabIcon icon={icon} color={color} size={24} />
        <SizableText
          fontSize={11}
          fontWeight={active ? '600' : '400'}
          color={color}
          letterSpacing={0.1}
        >
          {label}
        </SizableText>
      </YStack>
    </Link>
  )
}

function QuickAddButton() {
  return (
    <YStack flex={1} items="center" justify="center" pb="$1">
      <YStack
        width={56}
        height={56}
        mt={-18}
        rounded="$10"
        bg={MTD_TOKENS.orange}
        items="center"
        justify="center"
        cursor="pointer"
        pressStyle={{ opacity: 0.88, scale: 0.96 }}
        onPress={openQuickAdd}
        onPressIn={composeHapticPressIn(undefined, { haptic: 'medium' })}
        aria-label="Quick add"
        boxShadow="0 4px 14px rgba(249, 115, 22, 0.35)"
      >
        <PlusIcon size={28} color={MTD_TOKENS.onOrange} />
      </YStack>
    </YStack>
  )
}

export function MtdBottomNav() {
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const { tabs } = useMtdTabs()
  const activeTab = getMtdActiveTab(pathname)
  const bottomInset = isWeb ? 8 : Math.max(insets.bottom, 8)

  // Home | Records | + | Submissions | Settings
  const leftTabs = tabs.filter((tab) => tab.id === 'home' || tab.id === 'records')
  const rightTabs = tabs.filter((tab) => tab.id === 'submissions' || tab.id === 'more')

  return (
    <YStack
      bg={MTD_TOKENS.background}
      borderTopWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      display="flex"
      $lg={{ display: 'none' }}
      {...(isWeb
        ? { position: 'sticky' as const, b: 0, z: 100 }
        : {
            position: 'absolute' as const,
            b: 0,
            l: 0,
            r: 0,
            z: 100,
          })}
    >
      <XStack items="stretch" justify="space-around" px="$1" pt="$1.5">
        {leftTabs.map((tab) => (
          <BottomTabItem
            key={tab.id}
            id={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={tab.id === activeTab}
          />
        ))}
        <QuickAddButton />
        {rightTabs.map((tab) => (
          <BottomTabItem
            key={tab.id}
            id={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={tab.id === activeTab}
          />
        ))}
      </XStack>
      <YStack height={bottomInset} />
    </YStack>
  )
}
