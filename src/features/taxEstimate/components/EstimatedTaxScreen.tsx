import type { Href } from 'one'
import { router } from 'one'
import { ScrollView as RNScrollView, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, Spinner, Switch, XStack, YStack } from 'tamagui'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { SecurityFooterCard } from '~/features/mtd/components/SecurityFooterCard'
import { TaxYearSelector } from '~/features/mtd/components/TaxYearSelector'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { ESTIMATE_CATEGORIES } from '~/features/taxEstimate/categories'
import { useTaxEstimate } from '~/features/taxEstimate/client/useTaxEstimate'
import { EstimateAnimatedAmount } from '~/features/taxEstimate/components/EstimateAnimatedAmount'
import { EstimateCategoryCard } from '~/features/taxEstimate/components/EstimateCategoryCard'
import { EstimateConfidenceCard } from '~/features/taxEstimate/components/EstimateConfidenceCard'
import { useEstimatedTaxScrollRestoration } from '~/features/taxEstimate/hooks/useEstimatedTaxScrollRestoration'
import { BankIcon } from '~/interface/icons/phosphor/BankIcon'
import { BriefcaseIcon } from '~/interface/icons/phosphor/BriefcaseIcon'
import { ChairIcon } from '~/interface/icons/phosphor/ChairIcon'
import { ChartLineUpIcon } from '~/interface/icons/phosphor/ChartLineUpIcon'
import { DotsThreeIcon } from '~/interface/icons/phosphor/DotsThreeIcon'
import { GiftIcon } from '~/interface/icons/phosphor/GiftIcon'
import { GlobeIcon } from '~/interface/icons/phosphor/GlobeIcon'
import { GraduationCapIcon } from '~/interface/icons/phosphor/GraduationCapIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'
import { TagIcon } from '~/interface/icons/phosphor/TagIcon'
import { UsersThreeIcon } from '~/interface/icons/phosphor/UsersThreeIcon'
import { showToast } from '~/interface/toast/helpers'

const ICONS = {
  briefcase: BriefcaseIcon,
  bank: BankIcon,
  chart: ChartLineUpIcon,
  house: HouseIcon,
  chair: ChairIcon,
  family: UsersThreeIcon,
  graduation: GraduationCapIcon,
  gift: GiftIcon,
  tag: TagIcon,
  globe: GlobeIcon,
  ellipsis: DotsThreeIcon,
} as const

function CategoryIcon({
  name,
  color,
}: {
  name: (typeof ESTIMATE_CATEGORIES)[number]['icon']
  color: string
}) {
  const Icon = ICONS[name]
  return <Icon size={18} color={color} />
}

function EstimateStillToPayCard({ pounds }: { pounds: number }) {
  return (
    <XStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$5"
      p="$4"
      items="center"
      justify="space-between"
      cursor="pointer"
      pressStyle={{ opacity: 0.92 }}
      onPress={() => router.push(MTD_ROUTES.estimatedTaxSummary)}
    >
      <YStack gap="$1">
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
          Estimated amount still to pay
        </SizableText>
        <EstimateAnimatedAmount pounds={pounds} />
      </YStack>
      <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.orange}>
        View summary
      </SizableText>
    </XStack>
  )
}

function EstimateStillToPaySticky({ pounds }: { pounds: number }) {
  const inner = (
    <YStack px="$4" pt="$2" pb="$3" maxW={720} width="100%" mx="auto" $lg={{ px: '$6' }}>
      <EstimateStillToPayCard pounds={pounds} />
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack bg={MTD_TOKENS.background} width="100%" z={10} position="sticky" t={0}>
        {inner}
      </YStack>
    )
  }

  return (
    <View collapsable={false}>
      <YStack bg={MTD_TOKENS.background} width="100%" z={10}>
        {inner}
      </YStack>
    </View>
  )
}

export function EstimatedTaxScreen() {
  const insets = useSafeAreaInsets()
  const { data, isLoading, error, refetch, save } = useTaxEstimate()
  const calculation = data?.calculation
  const statuses = calculation?.categoryStatuses
  const { scrollRef, handleScroll, handleContentSizeChange, initialContentOffset } =
    useEstimatedTaxScrollRestoration({ ready: Boolean(data) || Boolean(error) })

  const left = ESTIMATE_CATEGORIES.filter((_, index) => index % 2 === 0)
  const right = ESTIMATE_CATEGORIES.filter((_, index) => index % 2 === 1)

  const showBody = Boolean(data)
  const columnStyle = {
    px: '$4',
    maxW: 720,
    width: '100%',
    mx: 'auto',
    $lg: { px: '$6' },
  } as const

  const intro = (
    <YStack {...columnStyle} gap="$4" pt="$2" pb="$2" $lg={{ px: '$6', pt: '$4' }}>
      <TaxYearSelector />

      <XStack gap="$1.5" width="100%">
        {(
          [
            ['england', 'England'],
            ['wales', 'Wales'],
            ['northern_ireland', 'N. Ireland'],
            ['scotland', 'Scotland'],
          ] as const
        ).map(([id, label]) => {
          const selected = (data?.jurisdiction ?? 'england') === id
          return (
            <YStack
              key={id}
              flex={1}
              minW={0}
              px="$2"
              py="$2"
              items="center"
              rounded="$10"
              borderWidth={1}
              borderColor={selected ? MTD_TOKENS.orange : MTD_TOKENS.cardBorder}
              bg={selected ? MTD_TOKENS.orangeMuted : MTD_TOKENS.card}
              cursor="pointer"
              onPress={() => {
                void save({ jurisdiction: id }).catch((saveError) => {
                  showToast(
                    saveError instanceof Error
                      ? saveError.message
                      : 'Could not save that answer',
                    { type: 'error' },
                  )
                })
              }}
            >
              <SizableText
                fontSize={12}
                fontWeight="600"
                color={selected ? MTD_TOKENS.orange : MTD_TOKENS.textMuted}
                numberOfLines={1}
                text="center"
              >
                {label}
              </SizableText>
            </YStack>
          )
        })}
      </XStack>

      <XStack items="flex-start" justify="space-between" gap="$3">
        <YStack flex={1} gap="$2" minW={0}>
          <SizableText
            fontSize={26}
            fontWeight="700"
            color={MTD_TOKENS.text}
            lineHeight={32}
          >
            Let's build a more accurate tax estimate 🎯
          </SizableText>
          <SizableText fontSize={15} color={MTD_TOKENS.textMuted} lineHeight={22}>
            Answer a few quick questions about your other income and deductions. The more
            we know, the more accurate your estimate will be.
          </SizableText>
        </YStack>
      </XStack>

      {data?.business.usingProjection && calculation?.breakdown.projectionNote ? (
        <YStack
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$4"
          p="$3.5"
          gap="$3"
        >
          <SizableText fontSize={14} color={MTD_TOKENS.text} lineHeight={20}>
            {calculation.breakdown.projectionNote}
          </SizableText>
          <XStack items="center" justify="space-between" gap="$3">
            <SizableText fontSize={13} color={MTD_TOKENS.textMuted} flex={1}>
              Use this full-year projection
            </SizableText>
            <Switch
              checked={data.useProjection}
              onCheckedChange={(checked) => {
                void save({ useProjection: Boolean(checked) }).catch((saveError) => {
                  showToast(
                    saveError instanceof Error
                      ? saveError.message
                      : 'Could not save that answer',
                    { type: 'error' },
                  )
                })
              }}
            />
          </XStack>
        </YStack>
      ) : null}

      {error && !data ? (
        <YStack py="$8" items="center" gap="$3">
          <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
            Could not load this estimate
          </SizableText>
          <SizableText fontSize={14} color={MTD_TOKENS.textMuted} text="center">
            {error instanceof Error ? error.message : 'Please try again.'}
          </SizableText>
          <MtdActionButton onPress={() => void refetch()}>Try again</MtdActionButton>
        </YStack>
      ) : isLoading && !data ? (
        <YStack py="$8" items="center">
          <Spinner size="large" color={MTD_TOKENS.orange} />
        </YStack>
      ) : null}
    </YStack>
  )

  const estimateCard =
    calculation && showBody ? (
      <EstimateStillToPaySticky pounds={calculation.stillToPay} />
    ) : null

  const categories = showBody ? (
    <YStack
      {...columnStyle}
      gap="$4"
      pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
    >
      <XStack gap="$3" items="stretch">
        <YStack flex={1} gap="$3">
          {left.map((category) => (
            <EstimateCategoryCard
              key={category.id}
              title={category.title}
              question={category.question}
              iconBg={category.iconBg}
              iconColor={category.iconColor}
              status={statuses?.[category.id] ?? 'not_answered'}
              icon={<CategoryIcon name={category.icon} color={category.iconColor} />}
              onPress={() =>
                router.push(`${MTD_ROUTES.estimatedTax}/${category.id}` as Href)
              }
            />
          ))}
        </YStack>
        <YStack flex={1} gap="$3">
          {right.map((category) => (
            <EstimateCategoryCard
              key={category.id}
              title={category.title}
              question={category.question}
              iconBg={category.iconBg}
              iconColor={category.iconColor}
              status={statuses?.[category.id] ?? 'not_answered'}
              icon={<CategoryIcon name={category.icon} color={category.iconColor} />}
              onPress={() =>
                router.push(`${MTD_ROUTES.estimatedTax}/${category.id}` as Href)
              }
            />
          ))}
        </YStack>
      </XStack>

      {calculation ? (
        <EstimateConfidenceCard
          level={calculation.confidence.level}
          message={calculation.confidence.message}
          completionPercent={calculation.confidence.completionPercent}
        />
      ) : null}

      <SizableText fontSize={12} color={MTD_TOKENS.textSubtle} lineHeight={18}>
        {calculation?.disclaimer ??
          "This is an estimate based on the information you've given us. Your final tax bill may change when your full tax return is completed."}
      </SizableText>

      <SecurityFooterCard />
    </YStack>
  ) : null

  const header = <MtdDetailHeader backHref={MTD_ROUTES.overview} title="Estimated tax" />

  const scroller = (
    <RNScrollView
      ref={scrollRef}
      style={{ flex: 1 }}
      showsVerticalScrollIndicator={false}
      onScroll={handleScroll}
      scrollEventThrottle={16}
      onContentSizeChange={handleContentSizeChange}
      contentOffset={initialContentOffset}
      stickyHeaderIndices={!isWeb && estimateCard ? [1] : undefined}
      removeClippedSubviews={false}
    >
      {intro}
      {estimateCard}
      {categories}
    </RNScrollView>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} bg={MTD_TOKENS.background}>
        {header}
        {scroller}
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>{header}</YStack>
      {scroller}
    </YStack>
  )
}
