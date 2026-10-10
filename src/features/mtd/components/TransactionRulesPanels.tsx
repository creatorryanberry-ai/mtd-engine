import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import { ScrollView as RNScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useCategorisationRules } from '~/features/categorisation/client/useCategorisationRules'
import { sortRulesAlphabetically } from '~/features/categorisation/sortRules'
import { useMtdBankAccounts } from '~/features/bankAccounts/client/useMtdBankAccounts'
import { isSystemBankAccount } from '~/features/bankAccounts/defaultBankAccounts'
import { getHmrcCategoryLabel } from '~/features/mtd/categories/hmrcCategories'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdSelectionColors } from '~/features/mtd/useMtdSelectionColors'
import { mtdInputProps } from '~/features/mtd/mtdFormStyles'
import {
  formatBankAccountLabel,
  formatRuleBankAccountsLabel,
  isRuleForBankAccount,
  resolveInitialRuleBankAccountIds,
} from '~/features/mtd/utils/formatBankAccountLabel'
import { toTitleCase } from '~/features/mtd/utils/formatTransactionDisplay'
import { getDefaultMatchValue } from '~/features/mtd/utils/transactionEditRules'
import { Input, type Input as InputElement } from '~/interface/forms/Input'
import { CheckCircleIcon } from '~/interface/icons/phosphor/CheckCircleIcon'
import { SquareIcon } from '~/interface/icons/phosphor/SquareIcon'
import { TrashIcon } from '~/interface/icons/phosphor/TrashIcon'
import { XIcon } from '~/interface/icons/phosphor/XIcon'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/helpers'

import { MtdAccentMutedBg } from './MtdAccentMutedBg'
import { MtdActionButton } from './MtdActionButton'
import { MtdSlideFromRightPanel } from './MtdSlideFromRightPanel'

import type { CategorisationRuleDto } from '~/features/categorisation/client/useCategorisationRules'
import type { BankAccountDto } from '~/features/bankAccounts/client/useMtdBankAccounts'
import type { MtdTransactionGroup } from '~/features/mtd/utils/formatTransactionDisplay'

function formatRuleMatchLabel(
  rule: Pick<CategorisationRuleDto, 'matchType' | 'matchValue'>,
) {
  if (rule.matchType === 'starts_with') {
    return `Starts with "${rule.matchValue}"`
  }
  if (rule.matchType === 'exact') {
    return `Exactly matches "${rule.matchValue}"`
  }
  return `Contains "${rule.matchValue}"`
}

function getRuleCategoryLabel(
  rule: Pick<CategorisationRuleDto, 'hmrcCategory' | 'hmrcCategoryLabel'>,
) {
  return rule.hmrcCategoryLabel || getHmrcCategoryLabel(rule.hmrcCategory)
}

function RuleAccountOption({
  account,
  selected,
  onToggle,
}: {
  account: BankAccountDto
  selected: boolean
  onToggle: () => void
}) {
  const { borderColor, iconColor } = useMtdSelectionColors(selected)

  return (
    <MtdAccentMutedBg
      accent={selected}
      fallbackBg={MTD_TOKENS.cardInset}
      row
      gap="$3"
      items="center"
      px="$3"
      py="$2.5"
      rounded="$4"
      borderWidth={1}
      borderColor={borderColor}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={onToggle}
    >
      {selected ? (
        <CheckCircleIcon size={18} color={iconColor} />
      ) : (
        <SquareIcon size={18} color={MTD_TOKENS.textSubtle} />
      )}
      <SizableText flex={1} fontSize={13} color={MTD_TOKENS.text} numberOfLines={2}>
        {formatBankAccountLabel(account)}
      </SizableText>
    </MtdAccentMutedBg>
  )
}

function RuleAccountPicker({
  accounts,
  selectedIds,
  onChange,
}: {
  accounts: BankAccountDto[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const toggleAccount = (accountId: string) => {
    const isSelected = selectedIds.includes(accountId)
    if (isSelected) {
      const next = selectedIds.filter((id) => id !== accountId)
      if (next.length === 0) return
      onChange(next)
      return
    }

    onChange([...selectedIds, accountId])
  }

  return (
    <YStack gap="$2">
      {accounts.map((account) => (
        <RuleAccountOption
          key={account.id}
          account={account}
          selected={selectedIds.includes(account.id)}
          onToggle={() => toggleAccount(account.id)}
        />
      ))}
    </YStack>
  )
}

function FilterRulesForBankToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <XStack
      gap="$3"
      items="center"
      px="$3"
      py="$2.5"
      rounded="$4"
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      cursor="pointer"
      pressStyle={{ opacity: 0.85 }}
      onPress={() => onChange(!checked)}
    >
      {checked ? (
        <CheckCircleIcon size={18} color={MTD_TOKENS.orange} />
      ) : (
        <SquareIcon size={18} color={MTD_TOKENS.textSubtle} />
      )}
      <SizableText fontSize={14} fontWeight="500" color={MTD_TOKENS.text}>
        Only show rules for this bank
      </SizableText>
    </XStack>
  )
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  const insets = useSafeAreaInsets()

  return (
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
      <SizableText
        fontSize={18}
        fontWeight="600"
        color={MTD_TOKENS.text}
        flex={1}
        pr="$3"
      >
        {title}
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
        onPress={onClose}
        aria-label="Close"
        shrink={0}
      >
        <XIcon size={18} color={MTD_TOKENS.text} />
      </XStack>
    </XStack>
  )
}

type GroupingRuleFormProps = {
  title: string
  subtitle?: string
  initialMatchValue?: string
  initialFriendlyName?: string
  initialBankAccountIds?: string[]
  contextBankAccountId?: string
  hmrcCategory: string
  onClose: () => void
  onSaved: () => void
  ruleId?: string
}

function GroupingRuleForm({
  title,
  subtitle,
  initialMatchValue = '',
  initialFriendlyName = '',
  initialBankAccountIds,
  contextBankAccountId,
  hmrcCategory,
  onClose,
  onSaved,
  ruleId,
}: GroupingRuleFormProps) {
  const insets = useSafeAreaInsets()
  const { createRule, updateRule } = useCategorisationRules()
  const { accounts, isLoading: accountsLoading } = useMtdBankAccounts()
  const [matchValue, setMatchValue] = useState(initialMatchValue)
  const [friendlyName, setFriendlyName] = useState(initialFriendlyName)
  const [selectedBankAccountIds, setSelectedBankAccountIds] = useState<string[] | null>(
    null,
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nameInputRef = useRef<InputElement | null>(null)

  useEffect(() => {
    if (!ruleId) return

    const timer = setTimeout(() => {
      nameInputRef.current?.focus()
    }, 50)

    return () => clearTimeout(timer)
  }, [ruleId])

  const bankAccounts = useMemo(
    () => accounts.filter((account) => !isSystemBankAccount(account.externalAccountId)),
    [accounts],
  )
  const allAccountIds = useMemo(
    () => bankAccounts.map((account) => account.id),
    [bankAccounts],
  )

  const resolvedBankAccountIds = useMemo(() => {
    const resolved =
      selectedBankAccountIds ??
      resolveInitialRuleBankAccountIds(
        initialBankAccountIds,
        contextBankAccountId && allAccountIds.includes(contextBankAccountId)
          ? contextBankAccountId
          : undefined,
        allAccountIds,
      )

    return resolved.filter((id) => allAccountIds.includes(id))
  }, [allAccountIds, contextBankAccountId, initialBankAccountIds, selectedBankAccountIds])

  const handleSave = async () => {
    const trimmed = matchValue.trim()
    if (!trimmed) {
      setError('Enter the text to match')
      return
    }

    if (resolvedBankAccountIds.length === 0) {
      setError('Select at least one bank account')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const trimmedFriendlyName = ruleId ? friendlyName.trim() || null : trimmed
      if (ruleId) {
        await updateRule(ruleId, {
          matchValue: trimmed,
          matchType: 'contains',
          friendlyName: trimmedFriendlyName,
          hmrcCategory,
          bankAccountIds: resolvedBankAccountIds,
        })
        showToast('Rule updated', { type: 'success' })
      } else {
        await createRule({
          matchValue: trimmed,
          matchType: 'contains',
          friendlyName: trimmedFriendlyName,
          hmrcCategory,
          bankAccountIds: resolvedBankAccountIds,
          upsert: true,
        })
        showToast('Rule created', { type: 'success' })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule')
    } finally {
      setIsSaving(false)
    }
  }

  const content = (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <PanelHeader title={title} onClose={onClose} />
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        <YStack
          gap="$4"
          px="$4"
          pt="$4"
          pb={isWeb ? '$8' : insets.bottom + 24}
          maxW={480}
          width="100%"
          mx="auto"
        >
          {subtitle ? (
            <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
              {subtitle}
            </SizableText>
          ) : null}

          <YStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$5"
            p="$4"
            gap="$4"
          >
            {!ruleId ? null : (
              <YStack gap="$2">
                <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.textMuted}>
                  Name
                </SizableText>
                <Input
                  ref={nameInputRef}
                  value={friendlyName}
                  onChangeText={setFriendlyName}
                  placeholder="Display name for matching transactions"
                  autoCorrect={false}
                  {...mtdInputProps}
                />
              </YStack>
            )}

            {!ruleId ? null : (
              <YStack gap="$2">
                <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.textMuted}>
                  Auto category
                </SizableText>
                <SizableText fontSize={14} fontWeight="500" color={MTD_TOKENS.text}>
                  {getHmrcCategoryLabel(hmrcCategory)}
                </SizableText>
              </YStack>
            )}

            <YStack gap="$2">
              <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.textMuted}>
                Text
              </SizableText>
              <Input
                value={matchValue}
                onChangeText={setMatchValue}
                placeholder="Merchant name text"
                autoCapitalize="characters"
                autoCorrect={false}
                {...mtdInputProps}
              />
            </YStack>

            <YStack gap="$2">
              <SizableText fontSize={14} fontWeight="600" color={MTD_TOKENS.textMuted}>
                Select the accounts to apply the rule to
              </SizableText>
              {accountsLoading ? (
                <YStack py="$3" items="center">
                  <Spinner size="small" color={MTD_TOKENS.orange} />
                </YStack>
              ) : bankAccounts.length === 0 ? (
                <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                  No bank accounts available
                </SizableText>
              ) : (
                <RuleAccountPicker
                  accounts={bankAccounts}
                  selectedIds={resolvedBankAccountIds}
                  onChange={setSelectedBankAccountIds}
                />
              )}
            </YStack>

            {error ? (
              <SizableText fontSize={12} color={MTD_TOKENS.orange}>
                {error}
              </SizableText>
            ) : null}

            <MtdActionButton
              width="100%"
              size="large"
              loading={isSaving}
              disabled={isSaving}
              onPress={() => void handleSave()}
            >
              {isSaving ? 'Saving…' : ruleId ? 'Save changes' : 'Create rule'}
            </MtdActionButton>
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  )

  return content
}

type AddTransactionRulePanelProps = {
  group: MtdTransactionGroup
  bankAccountId?: string
  onClose: () => void
  onSaved: () => void
}

export function AddTransactionRulePanel({
  group,
  bankAccountId,
  onClose,
  onSaved,
}: AddTransactionRulePanelProps) {
  const lead = group.transactions[0]
  if (!lead) return null

  const defaultText = getDefaultMatchValue(lead.merchant)

  return (
    <MtdSlideFromRightPanel onClose={onClose}>
      {(requestClose) => (
        <GroupingRuleForm
          title="Add rule"
          subtitle={`Group transactions that match this text under "${toTitleCase(defaultText)}".`}
          initialMatchValue={defaultText}
          initialFriendlyName={toTitleCase(defaultText)}
          contextBankAccountId={bankAccountId}
          hmrcCategory={lead.hmrcCategory}
          onClose={requestClose}
          onSaved={onSaved}
        />
      )}
    </MtdSlideFromRightPanel>
  )
}

type TransactionRulesListPanelProps = {
  bankAccountId?: string
  onClose: () => void
}

export function TransactionRulesListPanel({
  bankAccountId,
  onClose,
}: TransactionRulesListPanelProps) {
  const insets = useSafeAreaInsets()
  const { rules, isLoading, error, deleteRule, refresh } = useCategorisationRules()
  const { accounts } = useMtdBankAccounts()
  const bankAccounts = useMemo(
    () => accounts.filter((account) => !isSystemBankAccount(account.externalAccountId)),
    [accounts],
  )
  const [editingRule, setEditingRule] = useState<CategorisationRuleDto | null>(null)
  const [filterForThisBank, setFilterForThisBank] = useState(true)
  const sortedRules = useMemo(() => sortRulesAlphabetically(rules), [rules])
  const visibleRules = useMemo(() => {
    if (!filterForThisBank || !bankAccountId) return sortedRules

    return sortedRules.filter((rule) => isRuleForBankAccount(rule, bankAccountId))
  }, [bankAccountId, filterForThisBank, sortedRules])
  const scrollRef = useRef<RNScrollView | null>(null)
  const scrollOffsetRef = useRef(0)
  const shouldRestoreScrollRef = useRef(false)

  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollOffsetRef.current = event.nativeEvent.contentOffset.y
    },
    [],
  )

  const openEditRule = useCallback((rule: CategorisationRuleDto) => {
    shouldRestoreScrollRef.current = true
    setEditingRule(rule)
  }, [])

  const closeEditRule = useCallback(() => {
    shouldRestoreScrollRef.current = true
    setEditingRule(null)
  }, [])

  const restoreListScroll = useCallback(() => {
    if (!shouldRestoreScrollRef.current || isLoading || visibleRules.length === 0) return

    const y = scrollOffsetRef.current
    if (y <= 0) {
      shouldRestoreScrollRef.current = false
      return
    }

    scrollRef.current?.scrollTo({ y, animated: false })
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false })
      shouldRestoreScrollRef.current = false
    })
  }, [isLoading, visibleRules.length])

  useEffect(() => {
    if (!editingRule) {
      restoreListScroll()
    }
  }, [editingRule, restoreListScroll])

  const handleDelete = useCallback(
    async (rule: CategorisationRuleDto) => {
      const confirmed = await dialogConfirm({
        title: 'Delete rule?',
        description: `Remove the rule for ${formatRuleMatchLabel(rule)}?`,
      })
      if (!confirmed) return

      try {
        await deleteRule(rule.id)
        showToast('Rule deleted', { type: 'success' })
        if (editingRule?.id === rule.id) {
          closeEditRule()
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Failed to delete rule', {
          type: 'error',
        })
      }
    },
    [deleteRule, editingRule?.id, closeEditRule],
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <MtdSlideFromRightPanel onClose={onClose}>
      {(requestClose) =>
        editingRule ? (
          <GroupingRuleForm
            title="Edit rule"
            initialMatchValue={editingRule.matchValue}
            initialFriendlyName={
              editingRule.friendlyName ?? toTitleCase(editingRule.matchValue)
            }
            initialBankAccountIds={editingRule.bankAccountIds}
            contextBankAccountId={bankAccountId}
            hmrcCategory={editingRule.hmrcCategory}
            ruleId={editingRule.id}
            onClose={closeEditRule}
            onSaved={() => {
              closeEditRule()
              void refresh()
            }}
          />
        ) : (
          <YStack flex={1} bg={MTD_TOKENS.background}>
            <PanelHeader title="Rules" onClose={requestClose} />
            <RNScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              onScroll={handleListScroll}
              scrollEventThrottle={16}
              onContentSizeChange={restoreListScroll}
            >
              <YStack gap="$3" px="$4" pt="$4" pb={isWeb ? '$8' : insets.bottom + 24}>
                {bankAccountId ? (
                  <FilterRulesForBankToggle
                    checked={filterForThisBank}
                    onChange={setFilterForThisBank}
                  />
                ) : null}

                {isLoading ? (
                  <YStack py="$8" items="center">
                    <Spinner size="large" color={MTD_TOKENS.orange} />
                  </YStack>
                ) : error ? (
                  <SizableText fontSize={14} color={MTD_TOKENS.orange}>
                    {error}
                  </SizableText>
                ) : sortedRules.length === 0 ? (
                  <YStack
                    bg={MTD_TOKENS.card}
                    borderWidth={1}
                    borderColor={MTD_TOKENS.cardBorder}
                    rounded="$5"
                    p="$5"
                    items="center"
                  >
                    <SizableText fontSize={14} color={MTD_TOKENS.textMuted} text="center">
                      No grouping rules yet. Swipe a transaction left and choose Add rule.
                    </SizableText>
                  </YStack>
                ) : visibleRules.length === 0 ? (
                  <YStack
                    bg={MTD_TOKENS.card}
                    borderWidth={1}
                    borderColor={MTD_TOKENS.cardBorder}
                    rounded="$5"
                    p="$5"
                    items="center"
                  >
                    <SizableText fontSize={14} color={MTD_TOKENS.textMuted} text="center">
                      No rules apply to this bank.
                    </SizableText>
                  </YStack>
                ) : (
                  <YStack
                    bg={MTD_TOKENS.card}
                    borderWidth={1}
                    borderColor={MTD_TOKENS.cardBorder}
                    rounded="$5"
                    overflow="hidden"
                  >
                    {visibleRules.map((rule, index) => (
                      <XStack
                        key={rule.id}
                        px="$3.5"
                        py="$3.5"
                        gap="$3"
                        items="center"
                        borderBottomWidth={index === visibleRules.length - 1 ? 0 : 1}
                        borderColor={MTD_TOKENS.cardBorder}
                        cursor="pointer"
                        pressStyle={{ opacity: 0.9 }}
                        onPress={() => openEditRule(rule)}
                      >
                        <YStack flex={1} gap="$0.5" minW={0}>
                          <SizableText
                            fontSize={15}
                            fontWeight="600"
                            color={MTD_TOKENS.text}
                            numberOfLines={1}
                          >
                            {rule.friendlyName || toTitleCase(rule.matchValue)}
                          </SizableText>
                          <SizableText
                            fontSize={12}
                            color={MTD_TOKENS.textMuted}
                            numberOfLines={2}
                          >
                            {formatRuleMatchLabel(rule)} → {getRuleCategoryLabel(rule)}
                          </SizableText>
                          <SizableText
                            fontSize={11}
                            color={MTD_TOKENS.textSubtle}
                            numberOfLines={2}
                          >
                            {formatRuleBankAccountsLabel(
                              rule.bankAccountIds,
                              bankAccounts,
                            )}
                          </SizableText>
                        </YStack>
                        <XStack
                          width={34}
                          height={34}
                          rounded="$10"
                          bg={MTD_TOKENS.cardInset}
                          items="center"
                          justify="center"
                          cursor="pointer"
                          pressStyle={{ opacity: 0.85 }}
                          onPress={(event) => {
                            event?.stopPropagation?.()
                            void handleDelete(rule)
                          }}
                          aria-label="Delete rule"
                        >
                          <TrashIcon size={16} color={MTD_TOKENS.orange} />
                        </XStack>
                      </XStack>
                    ))}
                  </YStack>
                )}
              </YStack>
            </RNScrollView>
          </YStack>
        )
      }
    </MtdSlideFromRightPanel>
  )
}
