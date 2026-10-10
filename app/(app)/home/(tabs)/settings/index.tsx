import { Link, Redirect, router, usePathname, type Href } from 'one'
import { useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { APP_VERSION, DOMAIN } from '~/constants/app'
import { authFetch } from '~/features/auth/client/authFetch'
import { useLogout } from '~/features/auth/useLogout'
import { notifyMtdTransactionsChanged } from '~/features/bankAccounts/client/mtdTransactionsEmitter'
import { notifyMtdSubmissionChanged } from '~/features/submission/client/mtdSubmissionEmitter'
import { HmrcConnectSection } from '~/features/hmrc/components/HmrcConnectSection'
import { notifyHmrcConnectionChanged } from '~/features/hmrc/client/hmrcEmitter'
import { CuratorLogo } from '~/features/mtd/components/CuratorLogo'
import { SlideFromRightPanel } from '~/features/mtd/components/SlideFromRightPanel'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { shouldBlockNativeSettingsLanding } from '~/features/mtd/mtdNavigationSession'
import { useBrandTheme, type BrandThemeId } from '~/features/theme/BrandThemeProvider'
import { brandThemeList } from '~/features/theme/brandThemes'
import { BankIcon } from '~/interface/icons/phosphor/BankIcon'
import { BriefcaseIcon } from '~/interface/icons/phosphor/BriefcaseIcon'
import { CaretRightIcon } from '~/interface/icons/phosphor/CaretRightIcon'
import { isDemoMode } from '~/helpers/isDemoMode'

const showTestingTools =
  isDemoMode || import.meta.env.VITE_API_HOSTNAME === 'staging-api.straightup.tax'
const showEngine = !!(
  import.meta.env.VITE_ENGINE_ENABLED || process.env.VITE_ENGINE_ENABLED
)
import { dialogConfirm } from '~/interface/dialogs/actions'
import { DoorIcon } from '~/interface/icons/phosphor/DoorIcon'
import { ListIcon } from '~/interface/icons/phosphor/ListIcon'
import { EnvelopeIcon } from '~/interface/icons/phosphor/EnvelopeIcon'
import { RocketIcon } from '~/interface/icons/phosphor/RocketIcon'
import { UserIcon } from '~/interface/icons/phosphor/UserIcon'
import { XIcon } from '~/interface/icons/phosphor/XIcon'
import { showToast } from '~/interface/toast/helpers'

import type { IconComponent } from '~/interface/icons/types'

interface SettingItem {
  id: string
  title: string
  icon?: IconComponent
  onPress?: () => void
  href?: Href
  external?: boolean
  destructive?: boolean
}

interface SettingSection {
  title: string
  items: SettingItem[]
}

function SettingRow({ item, isLast }: { item: SettingItem; isLast: boolean }) {
  const Icon = item.icon
  const titleColor = item.destructive ? MTD_TOKENS.orange : MTD_TOKENS.text

  const rowProps = {
    cursor: 'pointer' as const,
    px: '$3.5' as const,
    py: '$3.5' as const,
    gap: '$3' as const,
    items: 'center' as const,
    borderBottomWidth: isLast ? 0 : 1,
    borderBottomColor: MTD_TOKENS.cardBorder,
    pressStyle: { opacity: 0.9 },
    hoverStyle: { bg: MTD_TOKENS.cardInset },
  }

  const rowContent = (
    <>
      {Icon && (
        <YStack
          width={36}
          height={36}
          rounded="$10"
          bg={item.destructive ? MTD_TOKENS.orangeMuted : MTD_TOKENS.cardInset}
          items="center"
          justify="center"
          shrink={0}
        >
          <Icon
            size={18}
            color={item.destructive ? MTD_TOKENS.orange : MTD_TOKENS.textSubtle}
          />
        </YStack>
      )}
      <SizableText fontSize={15} fontWeight="500" color={titleColor} flex={1}>
        {item.title}
      </SizableText>
      <CaretRightIcon size={18} color={MTD_TOKENS.textSubtle} />
    </>
  )

  if (item.onPress) {
    return (
      <XStack {...rowProps} onPress={item.onPress}>
        {rowContent}
      </XStack>
    )
  }

  if (item.href) {
    if (item.external && !isWeb) {
      return (
        <XStack
          {...rowProps}
          onPress={() => Linking.openURL(`https://${DOMAIN}${item.href as string}`)}
        >
          {rowContent}
        </XStack>
      )
    }

    if (isWeb) {
      return (
        <Link href={item.href} target={item.external ? '_blank' : undefined} asChild>
          <XStack {...rowProps}>{rowContent}</XStack>
        </Link>
      )
    }

    return (
      <XStack {...rowProps} onPress={() => router.push(item.href!)}>
        {rowContent}
      </XStack>
    )
  }

  return null
}

function SettingsSection({ section }: { section: SettingSection }) {
  return (
    <YStack gap="$2.5">
      <SizableText
        fontSize={12}
        fontWeight="600"
        color={MTD_TOKENS.textSubtle}
        textTransform="uppercase"
        letterSpacing={0.8}
        px="$1"
      >
        {section.title}
      </SizableText>
      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$4"
        overflow="hidden"
      >
        {section.items.map((item, index) => (
          <SettingRow
            key={item.id}
            item={item}
            isLast={index === section.items.length - 1}
          />
        ))}
      </YStack>
    </YStack>
  )
}

function ThemePicker() {
  const insets = useSafeAreaInsets()
  const [open, setOpen] = useState(false)
  const { brand, brandId, setBrandId } = useBrandTheme()
  const options = brandThemeList

  const handleSelect = (id: BrandThemeId) => {
    setBrandId(id)
  }

  return (
    <>
      <YStack gap="$2.5">
        <SizableText
          fontSize={12}
          fontWeight="600"
          color={MTD_TOKENS.textSubtle}
          textTransform="uppercase"
          letterSpacing={0.8}
          px="$1"
        >
          Appearance
        </SizableText>
        <YStack
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$4"
          overflow="hidden"
        >
          <XStack
            cursor="pointer"
            px="$3.5"
            py="$3.5"
            gap="$3"
            items="center"
            pressStyle={{ opacity: 0.9 }}
            hoverStyle={{ bg: MTD_TOKENS.cardInset }}
            onPress={() => setOpen(true)}
          >
            <SizableText fontSize={15} fontWeight="500" color={MTD_TOKENS.text} flex={1}>
              Select theme
            </SizableText>
            <SizableText fontSize={14} color={MTD_TOKENS.textMuted} numberOfLines={1}>
              {brand.name}
            </SizableText>
            <CaretRightIcon size={18} color={MTD_TOKENS.textSubtle} />
          </XStack>
        </YStack>
      </YStack>

      {open ? (
        <SlideFromRightPanel onClose={() => setOpen(false)}>
          {(requestClose) => (
            <YStack flex={1} bg={MTD_TOKENS.background}>
              <XStack
                px="$4"
                pt={isWeb ? '$3' : insets.top + 12}
                pb="$3"
                items="center"
                justify="space-between"
                borderBottomWidth={1}
                borderColor={MTD_TOKENS.cardBorder}
              >
                <SizableText
                  fontSize={18}
                  fontWeight="600"
                  color={MTD_TOKENS.text}
                  flex={1}
                >
                  Select theme
                </SizableText>
                <XStack
                  width={36}
                  height={36}
                  rounded="$10"
                  bg={MTD_TOKENS.card}
                  borderWidth={1}
                  borderColor={MTD_TOKENS.cardBorder}
                  items="center"
                  justify="center"
                  cursor="pointer"
                  pressStyle={{ opacity: 0.85 }}
                  onPress={requestClose}
                  aria-label="Close"
                >
                  <XIcon size={18} color={MTD_TOKENS.text} />
                </XStack>
              </XStack>

              <ScrollView flex={1} showsVerticalScrollIndicator={false}>
                <YStack
                  gap="$3"
                  px="$4"
                  pt="$4"
                  pb={isWeb ? '$8' : insets.bottom + 24}
                  maxW={480}
                  width="100%"
                  mx="auto"
                >
                  <YStack
                    bg={MTD_TOKENS.card}
                    borderWidth={1}
                    borderColor={MTD_TOKENS.cardBorder}
                    rounded="$4"
                    overflow="hidden"
                  >
                    {options.map((option, index) => {
                      const selected = option.id === brandId
                      const isLast = index === options.length - 1

                      return (
                        <XStack
                          key={option.id}
                          cursor="pointer"
                          px="$3.5"
                          py="$3.5"
                          gap="$3"
                          items="center"
                          borderBottomWidth={isLast ? 0 : 1}
                          borderBottomColor={MTD_TOKENS.cardBorder}
                          pressStyle={{ opacity: 0.9 }}
                          hoverStyle={{ bg: MTD_TOKENS.cardInset }}
                          onPress={() => handleSelect(option.id)}
                        >
                          <YStack flex={1} gap="$0.5" minW={0}>
                            <SizableText
                              fontSize={15}
                              fontWeight="500"
                              color={MTD_TOKENS.text}
                            >
                              {option.name}
                            </SizableText>
                            <SizableText
                              fontSize={12}
                              color={MTD_TOKENS.textMuted}
                              numberOfLines={2}
                            >
                              {option.description}
                            </SizableText>
                          </YStack>
                          <YStack
                            width={22}
                            height={22}
                            rounded="$10"
                            borderWidth={2}
                            borderColor={
                              selected ? MTD_TOKENS.orange : MTD_TOKENS.cardBorder
                            }
                            items="center"
                            justify="center"
                            shrink={0}
                          >
                            {selected ? (
                              <YStack
                                width={10}
                                height={10}
                                rounded="$10"
                                bg={MTD_TOKENS.orange}
                              />
                            ) : null}
                          </YStack>
                        </XStack>
                      )
                    })}
                  </YStack>
                </YStack>
              </ScrollView>
            </YStack>
          )}
        </SlideFromRightPanel>
      ) : null}
    </>
  )
}

export function ProfileSettingsPage() {
  const insets = useSafeAreaInsets()
  const { logout } = useLogout()
  const [isClearingRules, setIsClearingRules] = useState(false)
  const [isUnsubmitting, setIsUnsubmitting] = useState(false)

  useEffect(() => {
    if (!isWeb || typeof window === 'undefined') return

    const params = new URLSearchParams(window.location.search)
    const hmrc = params.get('hmrc')
    const message = params.get('message')

    if (hmrc === 'connected') {
      notifyHmrcConnectionChanged()
      showToast('HMRC connected', { type: 'success' })
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    if (hmrc === 'error') {
      showToast(
        message
          ? `HMRC connection failed: ${message.replace(/_/g, ' ')}`
          : 'HMRC connection failed',
        { type: 'error' },
      )
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const clearRules = async () => {
    if (isClearingRules) return

    const confirmed = await dialogConfirm({
      title: 'Clear rules?',
      description: 'This removes all categorisation rules for your account.',
    })
    if (!confirmed) return

    setIsClearingRules(true)
    try {
      const response = await authFetch<{ count: number }>('/api/categorisation/rules', {
        method: 'DELETE',
      })
      if (response.error) {
        throw new Error(response.error.message || 'Failed to clear rules')
      }
      showToast('Rules cleared', { type: 'success' })
      notifyMtdTransactionsChanged()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to clear rules', {
        type: 'error',
      })
    } finally {
      setIsClearingRules(false)
    }
  }

  const unsubmitQuarterly = async () => {
    if (isUnsubmitting) return

    const confirmed = await dialogConfirm({
      title: 'Unsubmit quarterly update?',
      description:
        'This removes your HMRC submission for the current quarter so you can test submitting again.',
    })
    if (!confirmed) return

    setIsUnsubmitting(true)
    try {
      const response = await authFetch<{ quarterId: string }>(
        '/api/submissions/quarterly',
        {
          method: 'DELETE',
        },
      )
      if (response.error) {
        throw new Error(response.error.message || 'Failed to unsubmit')
      }
      showToast('Quarterly submission cleared', { type: 'success' })
      notifyMtdSubmissionChanged()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to unsubmit', {
        type: 'error',
      })
    } finally {
      setIsUnsubmitting(false)
    }
  }

  const sections: SettingSection[] = [
    {
      title: 'Account',
      items: [
        {
          id: 'profile',
          title: 'Edit Profile',
          icon: UserIcon,
          href: '/home/settings/edit-profile',
        },
        {
          id: 'business-setup',
          title: 'Business setup',
          icon: BriefcaseIcon,
          href: MTD_ROUTES.settingsBusinessSetup,
        },
        {
          id: 'mtd-email',
          title: 'Your MTD email',
          icon: EnvelopeIcon,
          href: MTD_ROUTES.settingsMtdEmail as Href,
        },
        {
          id: 'bank-accounts',
          title: 'Bank Accounts',
          icon: BankIcon,
          href: MTD_ROUTES.settingsBankAccounts,
        },
        ...(showEngine
          ? [
              {
                id: 'growth-engine',
                title: 'Growth engine',
                icon: RocketIcon,
                href: '/engine' as Href,
              } satisfies SettingItem,
            ]
          : []),
      ],
    },
    ...(showTestingTools
      ? [
          {
            title: 'Testing',
            items: [
              {
                id: 'clear-rules',
                title: isClearingRules ? 'Clearing rules…' : 'Clear rules',
                icon: ListIcon,
                onPress: () => void clearRules(),
              },
              {
                id: 'unsubmit-quarterly',
                title: isUnsubmitting ? 'Unsubmitting…' : 'Unsubmit quarterly update',
                icon: ListIcon,
                onPress: () => void unsubmitQuarterly(),
              },
            ],
          } satisfies SettingSection,
        ]
      : []),
    {
      title: 'Other',
      items: [
        {
          id: 'logout',
          title: 'Log Out',
          icon: DoorIcon,
          onPress: () => void logout(),
          destructive: true,
        },
      ],
    },
  ]

  const content = (
    <YStack
      gap="$5"
      px="$4"
      pt="$4"
      pb={isWeb ? '$8' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={720}
      width="100%"
      mx="auto"
      $lg={{ px: '$6', pt: '$6' }}
    >
      <YStack gap="$1">
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
          Account settings and preferences
        </SizableText>
      </YStack>

      <HmrcConnectSection />

      <ThemePicker />

      {sections.map((section) => (
        <SettingsSection key={section.title} section={section} />
      ))}

      <YStack items="center" gap="$2" pt="$4">
        <CuratorLogo />
        <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
          v{APP_VERSION}
        </SizableText>
      </YStack>
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} overflow="scroll">
        {content}
      </YStack>
    )
  }

  return (
    <ScrollView flex={1} bg={MTD_TOKENS.background} showsVerticalScrollIndicator={false}>
      {content}
    </ScrollView>
  )
}

function SettingsIndexGate() {
  const pathname = usePathname()

  if (shouldBlockNativeSettingsLanding(pathname)) {
    return <Redirect href={MTD_ROUTES.overview} />
  }

  return <ProfileSettingsPage />
}

export default SettingsIndexGate
