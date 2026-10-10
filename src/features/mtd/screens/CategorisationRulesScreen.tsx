import { useState, useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { Input } from '~/interface/forms/Input'
import { useCategorisationRules } from '~/features/categorisation/client/useCategorisationRules'
import { sortRulesAlphabetically } from '~/features/categorisation/sortRules'
import { HMRC_PICKER_CATEGORIES } from '~/features/mtd/categories/hmrcCategories'

import { MtdDetailHeader } from '../components/MtdDetailHeader'
import { MtdAccentMutedBg } from '../components/MtdAccentMutedBg'
import { MtdActionButton } from '../components/MtdActionButton'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'
import { useMtdSelectionColors } from '../useMtdSelectionColors'
import { mtdInputProps } from '../mtdFormStyles'

function HmrcCategoryChip({
  category,
  selected,
  onSelect,
}: {
  category: (typeof HMRC_PICKER_CATEGORIES)[number]
  selected: boolean
  onSelect: () => void
}) {
  const { borderColor } = useMtdSelectionColors(selected)

  return (
    <MtdAccentMutedBg
      accent={selected}
      fallbackBg={MTD_TOKENS.cardInset}
      row
      px="$3"
      py="$2"
      rounded="$10"
      borderWidth={1}
      borderColor={borderColor}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={onSelect}
    >
      <SizableText
        fontSize={11}
        fontWeight={selected ? '600' : '400'}
        color={selected ? MTD_TOKENS.text : MTD_TOKENS.textMuted}
      >
        {category.label}
      </SizableText>
    </MtdAccentMutedBg>
  )
}

export function CategorisationRulesScreen() {
  const insets = useSafeAreaInsets()
  const { rules, isLoading, error, createRule, deleteRule } = useCategorisationRules()
  const sortedRules = useMemo(() => sortRulesAlphabetically(rules), [rules])
  const [matchValue, setMatchValue] = useState('')
  const [hmrcCategory, setHmrcCategory] = useState(HMRC_PICKER_CATEGORIES[0]?.id ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!matchValue.trim()) {
      setFormError('Enter a merchant name to match')
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      await createRule({ matchValue: matchValue.trim(), hmrcCategory })
      setMatchValue('')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to create rule')
    } finally {
      setIsSaving(false)
    }
  }

  const content = (
    <YStack
      gap="$5"
      px="$4"
      pt="$4"
      pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={720}
      width="100%"
      mx="auto"
      $lg={{ px: '$6', pt: '$6' }}
    >
      <YStack gap="$2">
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
          When a merchant name contains your match text, transactions are auto-categorised
          with high confidence.
        </SizableText>
      </YStack>

      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$5"
        p="$4"
        gap="$3"
      >
        <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
          Add rule
        </SizableText>

        <YStack gap="$2">
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
            Merchant contains
          </SizableText>
          <Input
            value={matchValue}
            onChangeText={setMatchValue}
            placeholder="e.g. Shell"
            {...mtdInputProps}
          />
        </YStack>

        <YStack gap="$2">
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
            HMRC category
          </SizableText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <XStack gap="$2" py="$1">
              {HMRC_PICKER_CATEGORIES.map((category) => (
                <HmrcCategoryChip
                  key={category.id}
                  category={category}
                  selected={hmrcCategory === category.id}
                  onSelect={() => setHmrcCategory(category.id)}
                />
              ))}
            </XStack>
          </ScrollView>
        </YStack>

        {formError && (
          <SizableText fontSize={12} color={MTD_TOKENS.orange}>
            {formError}
          </SizableText>
        )}

        <MtdActionButton
          width="100%"
          loading={isSaving}
          disabled={isSaving}
          onPress={() => void handleCreate()}
        >
          {isSaving ? 'Saving...' : 'Save rule'}
        </MtdActionButton>
      </YStack>

      <YStack gap="$3">
        <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
          Your rules
        </SizableText>

        <YStack
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$5"
          px="$3"
        >
          {isLoading ? (
            <YStack py="$8" items="center">
              <Spinner size="small" color={MTD_TOKENS.orange} />
            </YStack>
          ) : error ? (
            <YStack py="$6" items="center">
              <SizableText fontSize={13} color={MTD_TOKENS.orange}>
                {error}
              </SizableText>
            </YStack>
          ) : sortedRules.length === 0 ? (
            <YStack py="$6" items="center">
              <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                No rules yet
              </SizableText>
            </YStack>
          ) : (
            sortedRules.map((rule) => (
              <XStack
                key={rule.id}
                py="$3"
                gap="$3"
                items="center"
                borderBottomWidth={1}
                borderColor={MTD_TOKENS.cardBorder}
              >
                <YStack flex={1} gap="$0.5">
                  <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.text}>
                    {rule.friendlyName
                      ? rule.friendlyName
                      : `Merchant contains "${rule.matchValue}"`}
                  </SizableText>
                  <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
                    {rule.friendlyName
                      ? `Match "${rule.matchValue}" → ${rule.hmrcCategoryLabel}`
                      : `→ ${rule.hmrcCategoryLabel}`}
                  </SizableText>
                </YStack>
                <SizableText
                  fontSize={12}
                  color={MTD_TOKENS.orange}
                  cursor="pointer"
                  pressStyle={{ opacity: 0.8 }}
                  onPress={() => void deleteRule(rule.id)}
                >
                  Remove
                </SizableText>
              </XStack>
            ))
          )}
        </YStack>
      </YStack>
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} bg={MTD_TOKENS.background}>
        <MtdDetailHeader backHref={MTD_ROUTES.bankAccounts} title="Rules" />
        <YStack flex={1} overflow="scroll" py="$4">
          {content}
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>
        <MtdDetailHeader backHref={MTD_ROUTES.bankAccounts} title="Rules" />
      </YStack>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
    </YStack>
  )
}
