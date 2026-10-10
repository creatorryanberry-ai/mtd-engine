import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { ScrollView as RNScrollView, StyleSheet, type View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { useCategorisationRules } from '~/features/categorisation/client/useCategorisationRules'
import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import {
  TRANSACTION_EDIT_CATEGORIES,
  getEditCategoryIdForHmrc,
  getPrivateUseStateFromRulePercent,
  resolveBusinessExpenseHmrcCategory,
  type TransactionEditCategoryId,
} from '~/features/mtd/categories/transactionEditCategories'
import { suggestPrivateUse } from '~/features/mtd/categories/privateUseSuggestions'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdSelectionColors } from '~/features/mtd/useMtdSelectionColors'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'
import {
  buildInitialRuleDrafts,
  getPrimaryFriendlyName,
  getPrimaryRuleDraft,
  type TransactionRuleDraft,
} from '~/features/mtd/utils/transactionEditRules'
import { sortTransactionsByNewest } from '~/features/mtd/utils/formatTransactionDisplay'
import {
  buildTransactionAcceptIds,
  type TransactionEditAcceptInput,
} from '~/features/mtd/utils/persistTransactionRuleDrafts'
import { ArrowUpRightIcon } from '~/interface/icons/phosphor/ArrowUpRightIcon'
import { BriefcaseIcon } from '~/interface/icons/phosphor/BriefcaseIcon'
import { CheckCircleIcon } from '~/interface/icons/phosphor/CheckCircleIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'
import { SquareIcon } from '~/interface/icons/phosphor/SquareIcon'
import { UserIcon } from '~/interface/icons/phosphor/UserIcon'
import { MtdActionButton } from './MtdActionButton'
import { PrivateUseRow } from './PrivateUseRow'
import { PrivateUseNameHint } from './PrivateUseNameHint'
import { PrivateUseHintArrow } from './PrivateUseHintArrow'
import { SlideFromRightPanel } from './SlideFromRightPanel'
import { MtdMerchantAvatar } from './MtdMerchantAvatar'
import {
  MtdGroupedTransactionRow,
  MtdTransactionRowDetails,
} from './MtdTransactionRowDetails'
import {
  TransactionEditTitlePanel,
  usePersistTransactionRuleDrafts,
} from './TransactionEditTitlePanel'
import { persistTransactionRuleDrafts } from '~/features/mtd/utils/persistTransactionRuleDrafts'

import type { MtdTransactionDto } from '~/features/bankAccounts/types'
import type { IconProps } from '~/interface/icons/types'

const CATEGORY_ICONS: Record<TransactionEditCategoryId, ComponentType<IconProps>> = {
  business_expense: BriefcaseIcon,
  income: ArrowUpRightIcon,
  mortgage: HouseIcon,
  personal: UserIcon,
}

export type { TransactionEditAcceptInput } from '~/features/mtd/utils/persistTransactionRuleDrafts'

type TransactionEditScreenProps = {
  transactions: MtdTransactionDto[]
  bankAccountId?: string
  onClose: () => void
  onAccept: (input: TransactionEditAcceptInput) => void | Promise<void>
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

function MatchedRecordRow({
  transaction,
  selected,
  onToggle,
  preferOriginalMerchantName = false,
  privateUsePercent,
}: {
  transaction: MtdTransactionDto
  selected: boolean
  onToggle: () => void
  preferOriginalMerchantName?: boolean
  privateUsePercent?: number | null
}) {
  return (
    <XStack
      py="$3"
      gap="$3"
      items="flex-start"
      borderTopWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
    >
      <YStack cursor="pointer" pressStyle={{ opacity: 0.8 }} onPress={onToggle} pt="$0.5">
        {selected ? (
          <CheckCircleIcon size={20} color={MTD_TOKENS.orange} />
        ) : (
          <SquareIcon size={20} color={MTD_TOKENS.textSubtle} />
        )}
      </YStack>

      <MtdMerchantAvatar
        initials={transaction.initials}
        color={transaction.color}
        size={36}
        fontSize={11}
      />

      <MtdTransactionRowDetails
        transaction={transaction}
        privateUsePercent={privateUsePercent}
        preferOriginalMerchantName={preferOriginalMerchantName}
      />
    </XStack>
  )
}

function RememberForFutureRow({
  checked,
  onToggle,
}: {
  checked: boolean
  onToggle: () => void
}) {
  return (
    <XStack
      gap="$3"
      items="center"
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      px="$3.5"
      py="$3.5"
      cursor="pointer"
      pressStyle={{ opacity: 0.9 }}
      onPress={onToggle}
    >
      {checked ? (
        <CheckCircleIcon size={20} color={MTD_TOKENS.orange} />
      ) : (
        <SquareIcon size={20} color={MTD_TOKENS.textSubtle} />
      )}
      <SizableText flex={1} fontSize={14} fontWeight="500" color={MTD_TOKENS.text}>
        Remember this categorisation for future matching transactions
      </SizableText>
    </XStack>
  )
}

function TransactionEditContent({
  transactions,
  bankAccountId,
  onClose,
  onAccept,
}: TransactionEditScreenProps) {
  const insets = useSafeAreaInsets()
  const {
    rules,
    isLoading: rulesLoading,
    refresh: refreshRules,
  } = useCategorisationRules()
  const { settings } = useBusinessSettings()
  const includeVehiclePrivateUse = settings?.vehicleClaimMethod !== 'mileage'
  const persistRuleDrafts = usePersistTransactionRuleDrafts(bankAccountId)
  const orderedTransactions = useMemo(
    () => sortTransactionsByNewest(transactions),
    [transactions],
  )
  const lead = orderedTransactions[0]
  const [selectedCategory, setSelectedCategory] =
    useState<TransactionEditCategoryId | null>(() => {
      const hmrcCategory = lead?.hmrcCategory
      return hmrcCategory ? getEditCategoryIdForHmrc(hmrcCategory) : null
    })
  const matchedRecordIds = useMemo(
    () =>
      orderedTransactions.length > 1
        ? orderedTransactions.slice(1).map((transaction) => transaction.id)
        : [],
    [orderedTransactions],
  )
  const [selectedMatchedIds, setSelectedMatchedIds] = useState<Set<string>>(() => {
    const ordered = sortTransactionsByNewest(transactions)
    const ids =
      ordered.length > 1 ? ordered.slice(1).map((transaction) => transaction.id) : []
    return new Set(ids)
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rememberForFuture, setRememberForFuture] = useState(true)
  const [hasPrivateUse, setHasPrivateUse] = useState(false)
  const [privateUsePercent, setPrivateUsePercent] = useState('')
  const [showTitlePanel, setShowTitlePanel] = useState(false)
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const [titleSaveError, setTitleSaveError] = useState<string | null>(null)
  const [friendlyName, setFriendlyName] = useState('')
  const [ruleDrafts, setRuleDrafts] = useState<TransactionRuleDraft[]>([])
  const [draftsInitialized, setDraftsInitialized] = useState(false)
  const formContainerRef = useRef<View | null>(null)
  const hintOriginRef = useRef<View | null>(null)
  const hintBoxRef = useRef<View | null>(null)
  const yesButtonRef = useRef<View | null>(null)

  const privateUseSuggestion = useMemo(() => {
    if (selectedCategory !== 'business_expense' || !lead) return null
    return suggestPrivateUse(friendlyName.trim() || lead.merchant, {
      includeVehicle: includeVehiclePrivateUse,
    })
  }, [friendlyName, includeVehiclePrivateUse, lead, selectedCategory])
  const showPrivateUseHint =
    privateUseSuggestion != null &&
    !hasPrivateUse &&
    selectedCategory === 'business_expense'

  const selectedHmrcCategory = selectedCategory
    ? resolveBusinessExpenseHmrcCategory({
        selectedCategory,
        existingHmrcCategory: lead?.hmrcCategory,
        preferredHmrcCategory:
          selectedCategory === 'business_expense' && hasPrivateUse
            ? privateUseSuggestion?.preferredHmrcCategory
            : null,
      })
    : null

  useEffect(() => {
    if (!lead || draftsInitialized || rulesLoading) return

    const initialDrafts = buildInitialRuleDrafts(
      lead.merchant,
      rules,
      selectedHmrcCategory ?? lead.hmrcCategory,
      bankAccountId,
    )
    setRuleDrafts(initialDrafts)
    setFriendlyName(getPrimaryFriendlyName(initialDrafts))

    const primaryDraft = getPrimaryRuleDraft(initialDrafts)
    const editCategoryId = getEditCategoryIdForHmrc(
      selectedHmrcCategory ?? lead.hmrcCategory,
    )
    if (editCategoryId === 'business_expense' && primaryDraft) {
      const privateUseState = getPrivateUseStateFromRulePercent(
        primaryDraft.privateUsePercent ?? lead.privateUsePercent,
      )
      setHasPrivateUse(privateUseState.hasPrivateUse)
      setPrivateUsePercent(privateUseState.privateUsePercent)
    }

    setDraftsInitialized(true)
  }, [bankAccountId, draftsInitialized, lead, rules, rulesLoading, selectedHmrcCategory])

  const privateUsePercentValue = Number.parseInt(privateUsePercent, 10)
  const privateUseIsValid =
    selectedCategory !== 'business_expense' ||
    !hasPrivateUse ||
    (privateUsePercentValue >= 1 && privateUsePercentValue <= 99)
  const activePrivateUsePercent =
    selectedCategory === 'business_expense' &&
    hasPrivateUse &&
    privateUsePercentValue >= 1 &&
    privateUsePercentValue <= 99
      ? privateUsePercentValue
      : null

  useEffect(() => {
    if (!draftsInitialized) return

    setRuleDrafts((drafts) => {
      const primary = getPrimaryRuleDraft(drafts)
      if (!primary || primary.privateUsePercent === activePrivateUsePercent) {
        return drafts
      }

      return drafts.map((draft) =>
        draft.clientId === primary.clientId
          ? { ...draft, privateUsePercent: activePrivateUsePercent }
          : draft,
      )
    })
  }, [activePrivateUsePercent, draftsInitialized])

  const isGroup = orderedTransactions.length > 1
  const matchedRecords = isGroup ? orderedTransactions.slice(1) : []
  const acceptTransactionIds = useMemo(() => {
    if (!lead) return []
    return buildTransactionAcceptIds(lead.id, matchedRecordIds, selectedMatchedIds)
  }, [lead, matchedRecordIds, selectedMatchedIds])
  const canAccept =
    selectedCategory != null && lead != null && !isSubmitting && privateUseIsValid

  const previewTransactions = useMemo(() => {
    const trimmedFriendlyName = friendlyName.trim()
    if (!trimmedFriendlyName || !lead) return orderedTransactions

    return orderedTransactions.map((transaction) =>
      transaction.id === lead.id
        ? { ...transaction, displayName: trimmedFriendlyName }
        : transaction,
    )
  }, [friendlyName, lead, orderedTransactions])

  const toggleMatchedRecord = (transactionId: string) => {
    setSelectedMatchedIds((prev) => {
      const next = new Set(prev)
      if (next.has(transactionId)) {
        next.delete(transactionId)
      } else {
        next.add(transactionId)
      }
      return next
    })
  }

  const handleTitlePanelSave = async () => {
    if (!lead) return

    setIsSavingTitle(true)
    setTitleSaveError(null)

    try {
      await persistTransactionRuleDrafts(persistRuleDrafts, {
        ruleDrafts,
        friendlyName: friendlyName.trim(),
        hmrcCategory: selectedHmrcCategory ?? lead.hmrcCategory,
        privateUsePercent: activePrivateUsePercent,
      })

      const refreshedRules = await refreshRules()
      const updatedDrafts = buildInitialRuleDrafts(
        lead.merchant,
        refreshedRules,
        selectedHmrcCategory ?? lead.hmrcCategory,
        bankAccountId,
      )
      setRuleDrafts(updatedDrafts)
      setFriendlyName(getPrimaryFriendlyName(updatedDrafts))
      setShowTitlePanel(false)
    } catch (error) {
      setTitleSaveError(
        error instanceof Error ? error.message : 'Failed to save title and rules',
      )
    } finally {
      setIsSavingTitle(false)
    }
  }

  const handleAccept = async () => {
    if (!selectedCategory || !lead || acceptTransactionIds.length === 0) return

    setIsSubmitting(true)
    try {
      await onAccept({
        hmrcCategory:
          selectedHmrcCategory ??
          resolveBusinessExpenseHmrcCategory({
            selectedCategory,
            existingHmrcCategory: lead.hmrcCategory,
            preferredHmrcCategory:
              activePrivateUsePercent != null
                ? privateUseSuggestion?.preferredHmrcCategory
                : null,
          }),
        transactionIds: acceptTransactionIds,
        rememberForFuture,
        friendlyName: friendlyName.trim(),
        ruleDrafts,
        privateUsePercent: activePrivateUsePercent,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  const businessExpenseCategory = TRANSACTION_EDIT_CATEGORIES.find(
    (category) => category.id === 'business_expense',
  )
  const categoriesAfterBusinessExpense = TRANSACTION_EDIT_CATEGORIES.filter(
    (category) => category.id !== 'business_expense',
  )

  if (!lead) return null

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <XStack
        px="$4"
        pt={isWeb ? '$3' : insets.top + 12}
        pb="$3"
        items="center"
        justify="space-between"
        borderBottomWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        bg={MTD_TOKENS.background}
      >
        <YStack
          cursor="pointer"
          pressStyle={{ opacity: 0.8 }}
          onPress={onClose}
          py="$1"
          pr="$2"
        >
          <SizableText fontSize={15} fontWeight="500" color={MTD_TOKENS.textMuted}>
            Cancel
          </SizableText>
        </YStack>

        <MtdActionButton
          size="compact"
          disabled={!canAccept}
          loading={isSubmitting}
          onPress={() => void handleAccept()}
        >
          Accept
        </MtdActionButton>
      </XStack>

      <RNScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: isWeb ? 32 + 160 : insets.bottom + 24 + 160 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <YStack
          ref={formContainerRef}
          px="$4"
          pt="$4"
          gap="$5"
          maxW={720}
          width="100%"
          self="center"
          position="relative"
        >
          <PrivateUseHintArrow
            visible={showPrivateUseHint}
            containerRef={formContainerRef}
            originRef={hintOriginRef}
            boxRef={hintBoxRef}
            targetRef={yesButtonRef}
          />

          <YStack gap="$2">
            <XStack items="center" justify="space-between">
              <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.textMuted}>
                Transaction
              </SizableText>
              <SizableText
                fontSize={13}
                fontWeight="600"
                color={MTD_TOKENS.orange}
                cursor="pointer"
                pressStyle={{ opacity: 0.8 }}
                onPress={() => setShowTitlePanel(true)}
              >
                Edit friendly name
              </SizableText>
            </XStack>

            <MtdGroupedTransactionRow
              transactions={isGroup ? orderedTransactions : previewTransactions}
              contentInsetX="$3.5"
              showStack={false}
              showGroupTotal={false}
              preferOriginalMerchantName={isGroup}
              privateUsePercent={activePrivateUsePercent}
            />
            {showPrivateUseHint && privateUseSuggestion ? (
              <PrivateUseNameHint
                originRef={hintOriginRef}
                boxRef={hintBoxRef}
                suggestion={privateUseSuggestion}
              />
            ) : null}
          </YStack>

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
                    onPress={() => setSelectedCategory(businessExpenseCategory.id)}
                  />
                ) : null}

                {selectedCategory === 'business_expense' ? (
                  <PrivateUseRow
                    hasPrivateUse={hasPrivateUse}
                    onHasPrivateUseChange={setHasPrivateUse}
                    privateUsePercent={privateUsePercent}
                    onPrivateUsePercentChange={setPrivateUsePercent}
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
                  onPress={() => setSelectedCategory(category.id)}
                />
              ))}
            </YStack>
          </YStack>
          <RememberForFutureRow
            checked={rememberForFuture}
            onToggle={() => setRememberForFuture((value) => !value)}
          />

          {isGroup ? (
            <YStack
              bg={MTD_TOKENS.card}
              borderWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              rounded="$4"
              overflow="hidden"
              px="$3.5"
            >
              <SizableText
                fontSize={13}
                fontWeight="600"
                color={MTD_TOKENS.textMuted}
                py="$3"
              >
                Matched records
              </SizableText>
              {matchedRecords.map((transaction) => (
                <MatchedRecordRow
                  key={transaction.id}
                  transaction={transaction}
                  selected={selectedMatchedIds.has(transaction.id)}
                  onToggle={() => toggleMatchedRecord(transaction.id)}
                  preferOriginalMerchantName
                  privateUsePercent={activePrivateUsePercent}
                />
              ))}
            </YStack>
          ) : null}
        </YStack>
      </RNScrollView>

      {showTitlePanel ? (
        <TransactionEditTitlePanel
          merchant={lead.merchant}
          friendlyName={friendlyName}
          ruleDrafts={ruleDrafts}
          selectedHmrcCategory={selectedHmrcCategory}
          onFriendlyNameChange={setFriendlyName}
          onRuleDraftsChange={setRuleDrafts}
          onDone={() => handleTitlePanelSave()}
          onClose={() => {
            setTitleSaveError(null)
            setShowTitlePanel(false)
          }}
          isSaving={isSavingTitle}
          saveError={titleSaveError}
        />
      ) : null}
    </YStack>
  )
}

export function TransactionEditScreen({
  transactions,
  bankAccountId,
  onClose,
  onAccept,
}: TransactionEditScreenProps) {
  if (transactions.length === 0) return null

  return (
    <SlideFromRightPanel onClose={onClose}>
      {(requestClose) => (
        <TransactionEditContent
          transactions={transactions}
          bankAccountId={bankAccountId}
          onClose={requestClose}
          onAccept={onAccept}
        />
      )}
    </SlideFromRightPanel>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
})
