import { Link, useActiveParams, usePathname } from 'one'
import { useState, type ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { ENGINE_ROUTES, getEngineSection } from '~/features/engine/client/engineRoutes'
import { useEngineWorkspaces } from '~/features/engine/client/useEngineWorkspaces'
import { MtdAccentMutedBg } from '~/features/mtd/components/MtdAccentMutedBg'
import { MTD_ROUTES } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'
import { CaretDownIcon } from '~/interface/icons/phosphor/CaretDownIcon'
import { CaretLeftIcon } from '~/interface/icons/phosphor/CaretLeftIcon'
import { ChartLineUpIcon } from '~/interface/icons/phosphor/ChartLineUpIcon'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { ClipboardIcon } from '~/interface/icons/phosphor/ClipboardIcon'
import { FunnelIcon } from '~/interface/icons/phosphor/FunnelIcon'
import { GearIcon } from '~/interface/icons/phosphor/GearIcon'
import { PaletteIcon } from '~/interface/icons/phosphor/PaletteIcon'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'
import { RocketIcon } from '~/interface/icons/phosphor/RocketIcon'
import { StackIcon } from '~/interface/icons/phosphor/StackIcon'
import { TrendUpIcon } from '~/interface/icons/phosphor/TrendUpIcon'
import { UsersThreeIcon } from '~/interface/icons/phosphor/UsersThreeIcon'

import type { EngineSection } from '~/features/engine/client/engineRoutes'
import type { Href } from 'one'
import type { IconComponent } from '~/interface/icons/types'

type NavItem = { id: EngineSection; label: string; icon: IconComponent; href: Href }

function navItems(workspaceId: string): NavItem[] {
  return [
    {
      id: 'command-centre',
      label: 'Command Centre',
      icon: ChartLineUpIcon,
      href: ENGINE_ROUTES.workspace(workspaceId),
    },
    {
      id: 'audiences',
      label: 'Audiences',
      icon: UsersThreeIcon,
      href: ENGINE_ROUTES.audiences(workspaceId),
    },
    {
      id: 'experiments',
      label: 'Experiments',
      icon: FunnelIcon,
      href: ENGINE_ROUTES.experiments(workspaceId),
    },
    {
      id: 'measurement',
      label: 'Measurement',
      icon: TrendUpIcon,
      href: ENGINE_ROUTES.measurement(workspaceId),
    },
    {
      id: 'brand',
      label: 'Brand kit',
      icon: PaletteIcon,
      href: ENGINE_ROUTES.brand(workspaceId),
    },
    {
      id: 'integrations',
      label: 'Integrations',
      icon: StackIcon,
      href: ENGINE_ROUTES.integrations(workspaceId),
    },
    {
      id: 'audit',
      label: 'Audit log',
      icon: ClipboardIcon,
      href: ENGINE_ROUTES.audit(workspaceId),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: GearIcon,
      href: ENGINE_ROUTES.settings(workspaceId),
    },
  ]
}

function NavLink({
  item,
  active,
  compact,
}: {
  item: NavItem
  active: boolean
  compact?: boolean
}) {
  const color = active ? MTD_TOKENS.orange : MTD_TOKENS.textSubtle
  const Icon = item.icon
  return (
    <Link href={item.href} asChild>
      <MtdAccentMutedBg
        accent={active}
        fallbackBg="transparent"
        row
        gap={compact ? '$1.5' : '$3'}
        items="center"
        px={compact ? '$2.5' : '$3'}
        py={compact ? '$2' : '$2.5'}
        rounded="$4"
        hoverStyle={{ bg: MTD_TOKENS.cardInset }}
        cursor="pointer"
        width={compact ? undefined : '100%'}
        shrink={0}
      >
        <Icon size={compact ? 16 : 20} color={color} />
        <SizableText
          fontSize={compact ? 13 : 14}
          fontWeight={active ? '600' : '400'}
          color={color}
          numberOfLines={1}
        >
          {item.label}
        </SizableText>
      </MtdAccentMutedBg>
    </Link>
  )
}

function WorkspaceSwitcher({ workspaceId }: { workspaceId: string | undefined }) {
  const { workspaces } = useEngineWorkspaces()
  const [open, setOpen] = useState(false)
  const current = workspaces.find((workspace) => workspace.id === workspaceId) ?? null

  return (
    <YStack gap="$1.5" position="relative" z={10}>
      <XStack
        items="center"
        gap="$2"
        px="$3"
        py="$2.5"
        rounded="$4"
        bg={MTD_TOKENS.cardInset}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        cursor="pointer"
        pressStyle={{ opacity: 0.9 }}
        onPress={() => setOpen((value) => !value)}
        aria-label="Switch workspace"
      >
        <YStack
          width={26}
          height={26}
          rounded="$3"
          bg={MTD_TOKENS.orange}
          items="center"
          justify="center"
          shrink={0}
        >
          <RocketIcon size={14} color={MTD_TOKENS.onOrange} />
        </YStack>
        <YStack flex={1} minW={0}>
          <SizableText
            fontSize={13}
            fontWeight="600"
            color={MTD_TOKENS.text}
            numberOfLines={1}
          >
            {current?.name ?? 'Growth engine'}
          </SizableText>
          <SizableText fontSize={11} color={MTD_TOKENS.textSubtle} numberOfLines={1}>
            {current ? current.role : 'No workspace selected'}
          </SizableText>
        </YStack>
        <CaretDownIcon size={14} color={MTD_TOKENS.textSubtle} />
      </XStack>

      {open ? (
        <YStack
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$4"
          overflow="hidden"
          position="absolute"
          t="100%"
          l={0}
          r={0}
          mt="$1"
          z={20}
        >
          {workspaces.map((workspace) => {
            const selected = workspace.id === workspaceId
            return (
              <Link
                key={workspace.id}
                href={ENGINE_ROUTES.workspace(workspace.id)}
                asChild
              >
                <XStack
                  px="$3"
                  py="$2.5"
                  gap="$2"
                  items="center"
                  cursor="pointer"
                  hoverStyle={{ bg: MTD_TOKENS.cardInset }}
                  borderBottomWidth={1}
                  borderBottomColor={MTD_TOKENS.cardBorder}
                  onPress={() => setOpen(false)}
                >
                  <SizableText
                    flex={1}
                    fontSize={13}
                    fontWeight={selected ? '600' : '400'}
                    color={MTD_TOKENS.text}
                    numberOfLines={1}
                  >
                    {workspace.name}
                  </SizableText>
                  {selected ? <CheckIcon size={14} color={MTD_TOKENS.orange} /> : null}
                </XStack>
              </Link>
            )
          })}
          <Link href={ENGINE_ROUTES.index} asChild>
            <XStack
              px="$3"
              py="$2.5"
              gap="$2"
              items="center"
              cursor="pointer"
              hoverStyle={{ bg: MTD_TOKENS.cardInset }}
              onPress={() => setOpen(false)}
            >
              <PlusIcon size={14} color={MTD_TOKENS.textMuted} />
              <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                Create workspace
              </SizableText>
            </XStack>
          </Link>
        </YStack>
      ) : null}
    </YStack>
  )
}

function BackToTaxApp({ compact }: { compact?: boolean }) {
  return (
    <Link href={MTD_ROUTES.settings as Href} asChild>
      <XStack
        gap="$2"
        items="center"
        px={compact ? '$2' : '$3'}
        py="$2"
        rounded="$4"
        cursor="pointer"
        hoverStyle={{ bg: MTD_TOKENS.cardInset }}
      >
        <CaretLeftIcon size={14} color={MTD_TOKENS.textSubtle} />
        {compact ? null : (
          <SizableText fontSize={13} color={MTD_TOKENS.textSubtle}>
            Back to tax app
          </SizableText>
        )}
      </XStack>
    </Link>
  )
}

export function EngineShell({ children }: { children: ReactNode }) {
  const params = useActiveParams<{ workspaceId?: string }>()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const workspaceId = params.workspaceId
  const section = getEngineSection(pathname)
  const items = workspaceId ? navItems(workspaceId) : []

  return (
    <BrandThemeProvider>
      <YStack
        flex={1}
        bg={MTD_TOKENS.background}
        flexDirection="column"
        $lg={{ flexDirection: 'row' }}
        {...(isWeb && {
          minHeight: '100vh' as never,
          width: '100%' as never,
        })}
      >
        <YStack
          width={240}
          bg={MTD_TOKENS.card}
          borderRightWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          px="$3.5"
          py="$5"
          gap="$5"
          display="none"
          $lg={{ display: 'flex' }}
          {...(isWeb && {
            position: 'sticky' as never,
            top: 0,
            height: '100vh' as never,
          })}
        >
          <WorkspaceSwitcher workspaceId={workspaceId} />
          <YStack gap="$1" flex={1}>
            {items.map((item) => (
              <NavLink key={item.id} item={item} active={item.id === section} />
            ))}
          </YStack>
          <BackToTaxApp />
        </YStack>

        <YStack
          display="flex"
          $lg={{ display: 'none' }}
          bg={MTD_TOKENS.card}
          borderBottomWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          pt={isWeb ? '$2' : insets.top + 8}
          pb="$2"
          px="$3"
          gap="$2"
          z={10}
        >
          <XStack items="center" gap="$2">
            <BackToTaxApp compact />
            <YStack flex={1} minW={0}>
              <WorkspaceSwitcher workspaceId={workspaceId} />
            </YStack>
          </XStack>
          {items.length ? (
            <XStack gap="$1" flexWrap="wrap">
              {items.map((item) => (
                <NavLink key={item.id} item={item} active={item.id === section} compact />
              ))}
            </XStack>
          ) : null}
        </YStack>

        <YStack flex={1} minW={0} grow={1} shrink={1} position="relative">
          {children}
        </YStack>
      </YStack>
    </BrandThemeProvider>
  )
}
