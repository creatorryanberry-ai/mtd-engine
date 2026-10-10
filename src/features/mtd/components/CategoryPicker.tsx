import { useState } from 'react'
import { Modal, Pressable, ScrollView as RNScrollView, StyleSheet } from 'react-native'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import {
  HMRC_EXPENSE_CATEGORIES,
  HMRC_INCOME_CATEGORIES,
  HMRC_PICKER_CATEGORIES,
  getHmrcCategoryLabel,
} from '~/features/mtd/categories/hmrcCategories'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdSelectionColors } from '~/features/mtd/useMtdSelectionColors'
import { MtdAccentMutedBg } from '~/features/mtd/components/MtdAccentMutedBg'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'

type CategoryPickerProps = {
  value: string
  onSelect: (hmrcCategory: string) => void
  onClose: () => void
}

function CategoryOption({
  category,
  selected,
  onSelect,
}: {
  category: (typeof HMRC_PICKER_CATEGORIES)[number]
  selected: boolean
  onSelect: (hmrcCategory: string) => void
}) {
  const { borderColor } = useMtdSelectionColors(selected)

  return (
    <MtdAccentMutedBg
      accent={selected}
      fallbackBg={MTD_TOKENS.cardInset}
      row
      px="$3"
      py="$2.5"
      rounded="$3"
      borderWidth={1}
      borderColor={borderColor}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={() => onSelect(category.id)}
    >
      <SizableText fontSize={13} color={MTD_TOKENS.text}>
        {category.label}
      </SizableText>
    </MtdAccentMutedBg>
  )
}

function CategoryGroup({
  title,
  categories,
  value,
  onSelect,
}: {
  title: string
  categories: typeof HMRC_PICKER_CATEGORIES
  value: string
  onSelect: (hmrcCategory: string) => void
}) {
  return (
    <YStack gap="$2">
      <SizableText fontSize={12} fontWeight="600" color={MTD_TOKENS.textMuted}>
        {title}
      </SizableText>
      {categories.map((category) => (
        <CategoryOption
          key={category.id}
          category={category}
          selected={value === category.id}
          onSelect={onSelect}
        />
      ))}
    </YStack>
  )
}

function CategoryPickerContent({ value, onSelect, onClose }: CategoryPickerProps) {
  const [selected, setSelected] = useState(value)

  const otherCategories = HMRC_PICKER_CATEGORIES.filter(
    (category) => category.type !== 'income' && category.type !== 'expense',
  )

  return (
    <YStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$5"
      p="$4"
      gap="$3"
      width="100%"
      maxW={480}
      maxH="85%"
    >
      <XStack items="center" justify="space-between">
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          Choose category
        </SizableText>
        <SizableText
          fontSize={13}
          color={MTD_TOKENS.textMuted}
          cursor="pointer"
          onPress={onClose}
        >
          Cancel
        </SizableText>
      </XStack>

      <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
        Current: {getHmrcCategoryLabel(selected)}
      </SizableText>

      <RNScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
        nestedScrollEnabled
      >
        <YStack gap="$4" pb="$2">
          <CategoryGroup
            title="Income"
            categories={HMRC_INCOME_CATEGORIES}
            value={selected}
            onSelect={setSelected}
          />
          <CategoryGroup
            title="Expenses"
            categories={HMRC_EXPENSE_CATEGORIES}
            value={selected}
            onSelect={setSelected}
          />
          <CategoryGroup
            title="Other"
            categories={otherCategories}
            value={selected}
            onSelect={setSelected}
          />
        </YStack>
      </RNScrollView>

      <MtdActionButton width="100%" onPress={() => onSelect(selected)}>
        Apply category
      </MtdActionButton>
    </YStack>
  )
}

export function CategoryPicker({ value, onSelect, onClose }: CategoryPickerProps) {
  if (isWeb) {
    return (
      <YStack
        position="fixed"
        t={0}
        l={0}
        r={0}
        b={0}
        bg="rgba(0,0,0,0.6)"
        z={1000}
        items="center"
        justify="center"
        px="$4"
        onPress={onClose}
      >
        <YStack width="100%" maxW={480} onPress={(event) => event.stopPropagation()}>
          <CategoryPickerContent value={value} onSelect={onSelect} onClose={onClose} />
        </YStack>
      </YStack>
    )
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <CategoryPickerContent value={value} onSelect={onSelect} onClose={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
  },
  scroll: {
    maxHeight: 360,
  },
  scrollContent: {
    paddingBottom: 8,
  },
})
