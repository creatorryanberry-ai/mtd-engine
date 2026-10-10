import { SizableText, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '../mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'

export type TransactionListTab = 'for-review' | 'categorised'

const TABS: { id: TransactionListTab; label: string }[] = [
  { id: 'for-review', label: 'For review' },
  { id: 'categorised', label: 'Categorised' },
]

type TransactionListTabsProps = {
  activeTab: TransactionListTab
  forReviewCount: number
  categorisedCount: number
  onTabChange: (tab: TransactionListTab) => void
  onAddManual?: () => void
}

export function TransactionListTabs({
  activeTab,
  forReviewCount,
  categorisedCount,
  onTabChange,
  onAddManual,
}: TransactionListTabsProps) {
  const { brand } = useBrandTheme()
  const counts: Record<TransactionListTab, number> = {
    'for-review': forReviewCount,
    categorised: categorisedCount,
  }

  return (
    <XStack gap="$2" items="center">
      <XStack gap="$2" flex={1}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id
          const count = counts[tab.id]

          return (
            <MtdAccentMutedBg
              key={tab.id}
              accent={active}
              row
              flex={1}
              borderWidth={1}
              borderColor={active ? brand.colors.accentIcon : MTD_TOKENS.cardBorder}
              rounded="$4"
              px="$3"
              py="$2.5"
              gap="$2"
              items="center"
              justify="center"
              cursor="pointer"
              pressStyle={{ opacity: 0.85 }}
              onPress={() => onTabChange(tab.id)}
            >
              <SizableText
                fontSize={13}
                fontWeight={active ? '600' : '500'}
                color={active ? MTD_TOKENS.text : MTD_TOKENS.textMuted}
              >
                {tab.label}
              </SizableText>
              <SizableText
                fontSize={12}
                fontWeight="600"
                color={active ? brand.colors.accentIcon : MTD_TOKENS.textSubtle}
              >
                {count}
              </SizableText>
            </MtdAccentMutedBg>
          )
        })}
      </XStack>

      {onAddManual ? (
        <YStack
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
          onPress={onAddManual}
          shrink={0}
        >
          <PlusIcon size={18} color={MTD_TOKENS.text} />
        </YStack>
      ) : null}
    </XStack>
  )
}
