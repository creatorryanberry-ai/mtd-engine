import { usePathname } from 'one'

import type { Href } from 'one'
import { SizableText, YStack, type ColorTokens } from 'tamagui'

import { Link } from '~/interface/app/Link'
import { allowSettingsNavigation } from '~/features/mtd/mtdNavigationSession'
import { openQuickAdd } from '~/features/mtd/quickAddEmitter'
import { MTD_TOKENS } from '../mtdTokens'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'
import type { MtdTabIcon } from '../constants'
import { getMtdActiveTab, getMtdTabHref } from '../mtdTabHelpers'
import { useMtdTabs } from '../useMtdTabs'
import { ArchiveIcon } from '~/interface/icons/phosphor/ArchiveIcon'
import { FileTextIcon } from '~/interface/icons/phosphor/FileTextIcon'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'
import { CuratorLogo } from './CuratorLogo'

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

function SidebarNavItem({
  id,
  label,
  icon,
  active,
}: {
  id: string
  label: string
  icon: MtdTabIcon
  active: boolean
}) {
  const color = active ? MTD_TOKENS.orange : MTD_TOKENS.textSubtle

  return (
    <Link
      href={getMtdTabHref(id) as Href}
      aria-label={label}
      onPress={() => {
        if (id === 'more' && process.env.VITE_NATIVE) {
          allowSettingsNavigation()
        }
      }}
    >
      <MtdAccentMutedBg
        accent={active}
        fallbackBg="transparent"
        row
        gap="$3"
        items="center"
        px="$3"
        py="$2.5"
        rounded="$4"
        hoverStyle={{ bg: MTD_TOKENS.cardInset }}
        cursor="pointer"
        width="100%"
      >
        <TabIcon icon={icon} color={color} size={20} />
        <SizableText fontSize={14} fontWeight={active ? '600' : '400'} color={color}>
          {label}
        </SizableText>
      </MtdAccentMutedBg>
    </Link>
  )
}

export function MtdSidebar() {
  const pathname = usePathname()
  const { tabs } = useMtdTabs()
  const activeTab = getMtdActiveTab(pathname)

  return (
    <YStack
      width={240}
      bg={MTD_TOKENS.card}
      borderRightWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      px="$4"
      py="$5"
      gap="$6"
      display="none"
      $lg={{ display: 'flex' }}
      position="sticky"
      t={0}
      height="100vh"
    >
      <CuratorLogo />
      <YStack gap="$1" flex={1}>
        {tabs.map((tab) => (
          <SidebarNavItem
            key={tab.id}
            id={tab.id}
            label={tab.label}
            icon={tab.icon}
            active={tab.id === activeTab}
          />
        ))}
      </YStack>
      <MtdAccentMutedBg
        fallbackBg="transparent"
        row
        gap="$3"
        items="center"
        px="$3"
        py="$2.5"
        rounded="$4"
        hoverStyle={{ bg: MTD_TOKENS.cardInset }}
        cursor="pointer"
        width="100%"
        onPress={openQuickAdd}
      >
        <YStack
          width={28}
          height={28}
          rounded="$10"
          bg={MTD_TOKENS.orange}
          items="center"
          justify="center"
        >
          <PlusIcon size={16} color={MTD_TOKENS.onOrange} />
        </YStack>
        <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
          Quick add
        </SizableText>
      </MtdAccentMutedBg>
    </YStack>
  )
}

export { MtdBottomNav } from './MtdBottomNav'
