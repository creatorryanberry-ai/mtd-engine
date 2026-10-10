import type { ComponentType, Ref } from 'react'
import { type View } from 'react-native'
import { SizableText, YStack } from 'tamagui'

import {
  TRANSACTION_EDIT_CATEGORIES,
  type TransactionEditCategoryId,
} from '~/features/mtd/categories/transactionEditCategories'
import type { PrivateUseSuggestion } from '~/features/mtd/categories/privateUseSuggestions'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdSelectionColors } from '~/features/mtd/useMtdSelectionColors'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'
import { ArrowUpRightIcon } from '~/interface/icons/phosphor/ArrowUpRightIcon'
import { BriefcaseIcon } from '~/interface/icons/phosphor/BriefcaseIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'
import { UserIcon } from '~/interface/icons/phosphor/UserIcon'
import { PrivateUseRow } from './PrivateUseRow'

import type { IconProps } from '~/interface/icons/types'

const CATEGORY_ICONS: Record<TransactionEditCategoryId, ComponentType<IconProps>> = {
  business_expense: BriefcaseIcon,
  income: ArrowUpRightIcon,
  mortgage: HouseIcon,
  personal: UserIcon,
}

function CategoryRadioButton({
  label,
  icon: Icon,
  selected,
  onPress,
}: {
  label: string
  icon: ComponentType<IconProps>
  selected: boolean
  onPress: () => void
}) {
  const { borderColor, iconColor, textColor } = useMtdSelectionColors(selected)

  return (
    <MtdAccentMutedBg
      accent={selected}
      row
      width="100%"
      px="$3.5"
      py="$3.5"
      gap="$3"
      rounded="$4"
      borderWidth={1}
      borderColor={borderColor}
      items="center"
      cursor="pointer"
      pressStyle={{ opacity: 0.9 }}
      onPress={onPress}
    >
      <Icon size={22} color={iconColor} />
      <SizableText
        flex={1}
        fontSize={16}
        fontWeight={selected ? '600' : '500'}
        color={textColor}
      >
        {label}
      </SizableText>
    </MtdAccentMutedBg>
  )
}

type TransactionCategoryPickerProps = {
  selectedCategory: TransactionEditCategoryId | null
  onSelectCategory: (categoryId: TransactionEditCategoryId) => void
  allowedCategoryIds?: TransactionEditCategoryId[]
  hasPrivateUse?: boolean
  onHasPrivateUseChange?: (value: boolean) => void
  privateUsePercent?: string
  onPrivateUsePercentChange?: (value: string) => void
  privateUseSuggestion?: PrivateUseSuggestion | null
  yesButtonRef?: Ref<View>
}

export function TransactionCategoryPicker({
  selectedCategory,
  onSelectCategory,
  allowedCategoryIds,
  hasPrivateUse = false,
  onHasPrivateUseChange,
  privateUsePercent = '',
  onPrivateUsePercentChange,
  privateUseSuggestion = null,
  yesButtonRef,
}: TransactionCategoryPickerProps) {
  const visibleCategories = TRANSACTION_EDIT_CATEGORIES.filter((category) =>
    allowedCategoryIds ? allowedCategoryIds.includes(category.id) : true,
  )
  const businessExpenseCategory = visibleCategories.find(
    (category) => category.id === 'business_expense',
  )
  const categoriesAfterBusinessExpense = visibleCategories.filter(
    (category) => category.id !== 'business_expense',
  )
  const showPrivateUse =
    selectedCategory === 'business_expense' &&
    onHasPrivateUseChange != null &&
    onPrivateUsePercentChange != null

  return (
    <YStack gap="$2.5">
      <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.textMuted}>
        Category
      </SizableText>
      <YStack gap="$2">
        <YStack gap="$2">
          {businessExpenseCategory ? (
            <CategoryRadioButton
              key={businessExpenseCategory.id}
              label={businessExpenseCategory.label}
              icon={CATEGORY_ICONS[businessExpenseCategory.id]}
              selected={selectedCategory === businessExpenseCategory.id}
              onPress={() => onSelectCategory(businessExpenseCategory.id)}
            />
          ) : null}

          {showPrivateUse ? (
            <PrivateUseRow
              hasPrivateUse={hasPrivateUse}
              onHasPrivateUseChange={onHasPrivateUseChange}
              privateUsePercent={privateUsePercent}
              onPrivateUsePercentChange={onPrivateUsePercentChange}
              suggestion={privateUseSuggestion}
              yesButtonRef={yesButtonRef}
            />
          ) : null}
        </YStack>

        {categoriesAfterBusinessExpense.map((category) => (
          <CategoryRadioButton
            key={category.id}
            label={category.label}
            icon={CATEGORY_ICONS[category.id]}
            selected={selectedCategory === category.id}
            onPress={() => onSelectCategory(category.id)}
          />
        ))}
      </YStack>
    </YStack>
  )
}
