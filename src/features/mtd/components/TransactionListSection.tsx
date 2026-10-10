import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { ScrollView as GHScrollView } from 'react-native-gesture-handler'
import { isWeb, SizableText, Spinner, XStack, YStack } from 'tamagui'

import { useUpdateTransactionCategory } from '~/features/categorisation/client/useUpdateTransactionCategory'
import { useSubmissionPeriod } from '~/features/mtd/context/TaxYearProvider'
import { getQuarterInfo } from '~/features/mtd/utils/quarterPeriods'
import { resolveManualEntryDate } from '~/features/mtd/utils/resolveManualEntryDate'
import {
  getTransactionDisplayName,
  groupTransactionsByDisplayName,
} from '../utils/formatTransactionDisplay'
import { persistTransactionRuleDrafts } from '../utils/persistTransactionRuleDrafts'
import { mtdInputProps } from '../mtdFormStyles'
import { MTD_TOKENS } from '../mtdTokens'
import { MtdSwipeableTransactionGroupRow } from './MtdSwipeableTransactionGroupRow'
import { CisVoucherEditScreen } from './CisVoucherEditScreen'
import { LandlordStatementEditScreen } from './LandlordStatementEditScreen'
import { ManualTransactionEditScreen } from './ManualTransactionEditScreen'
import { ReceiptScanningPopup } from './ReceiptScanningPopup'
import { TransactionEditScreen } from './TransactionEditScreen'
import {
  AddTransactionRulePanel,
  TransactionRulesListPanel,
} from './TransactionRulesPanels'
import { TransactionListTabs, type TransactionListTab } from './TransactionListTabs'
import { SystemAccountListActions } from './SystemAccountListActions'
import type { TransactionEditAcceptInput } from '~/features/mtd/utils/persistTransactionRuleDrafts'
import { usePersistTransactionRuleDrafts } from './TransactionEditTitlePanel'
import { Input } from '~/interface/forms/Input'
import { CaretDownIcon } from '~/interface/icons/phosphor/CaretDownIcon'
import { ListChecksIcon } from '~/interface/icons/phosphor/ListChecksIcon'
import { MagnifyingGlassIcon } from '~/interface/icons/phosphor/MagnifyingGlassIcon'
import { XIcon } from '~/interface/icons/phosphor/XIcon'

import { isCisVoucherMerchant } from '~/features/bankAccounts/utils/cisVoucher'
import { isLandlordStatementMerchant } from '~/features/bankAccounts/utils/landlordStatement'
import {
  isCisVoucherScanUiAvailable,
  scanCisVoucherWithPicker,
  type CisVoucherDraft,
} from '~/features/mtd/receipt/scanCisVoucher'
import {
  isLandlordStatementScanUiAvailable,
  scanLandlordStatementWithPicker,
  type LandlordStatementDraft,
} from '~/features/mtd/receipt/scanLandlordStatement'
import {
  isReceiptScanUiAvailable,
  scanReceiptWithPicker,
  type ReceiptPickSource,
  type ManualReceiptDraft,
} from '~/features/mtd/receipt/scanReceipt'
import { useMerchantFingerprints } from '~/features/mtd/receipt/client/useMerchantFingerprints'
import type { SystemBankAccountKind } from '~/features/bankAccounts/defaultBankAccounts'
import type { ManualEntryListMode } from '~/features/mtd/manualEntryListMode'
import type { MtdTransactionDto } from '~/features/bankAccounts/types'
import type { MtdTransactionGroup } from '../utils/formatTransactionDisplay'
import type { TransactionEditCategoryId } from '~/features/mtd/categories/transactionEditCategories'

type TransactionListSectionProps = {
  activeTab: TransactionListTab
  forReviewCount: number
  categorisedCount: number
  onTabChange: (tab: TransactionListTab) => void
  transactions: MtdTransactionDto[]
  total: number
  showingCount: number
  bankAccountId?: string
  isLoading?: boolean
  error?: string | null
  topContent?: ReactNode
  systemAccountKind?: SystemBankAccountKind | null
  manualListMode?: ManualEntryListMode | null
  hideTabs?: boolean
  showRulesButton?: boolean
  contentInsetBottom?: number
  title?: string
  subtitle?: string
}

function TransactionGroupList({
  transactions,
  contentInsetX,
  onEditGroup,
  onAcceptGroup,
  onAddRuleGroup,
  groupByName = true,
}: {
  transactions: MtdTransactionDto[]
  contentInsetX: string | number
  onEditGroup: (group: MtdTransactionGroup) => void
  onAcceptGroup?: (group: MtdTransactionGroup) => void | Promise<void>
  onAddRuleGroup?: (group: MtdTransactionGroup) => void
  groupByName?: boolean
}) {
  const groups = groupByName
    ? groupTransactionsByDisplayName(transactions)
    : transactions.map((transaction) => ({
        key: transaction.id,
        transactions: [transaction],
      }))

  return (
    <YStack>
      {groups.map((group) => (
        <MtdSwipeableTransactionGroupRow
          key={group.key}
          transactions={group.transactions}
          contentInsetX={contentInsetX}
          onPress={() => onEditGroup(group)}
          onAccept={onAcceptGroup ? () => onAcceptGroup(group) : undefined}
          onAddRule={onAddRuleGroup ? () => onAddRuleGroup(group) : undefined}
        />
      ))}
    </YStack>
  )
}

function transactionMatchesSearch(transaction: MtdTransactionDto, query: string) {
  const displayName =
    transaction.displayName ?? getTransactionDisplayName(transaction.merchant)
  const haystack = [
    displayName,
    transaction.merchant,
    transaction.category,
    transaction.hmrcCategory,
    transaction.date,
    String(Math.abs(transaction.amount)),
    transaction.amount.toFixed(2),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function TransactionListTitleRow({
  title = 'Transactions',
  subtitle,
  total,
  onRulesPress,
  showRulesButton = true,
  showSearchToggle = false,
  searchOpen = false,
  onToggleSearch,
}: {
  title?: string
  subtitle?: string
  total: number
  onRulesPress: () => void
  showRulesButton?: boolean
  showSearchToggle?: boolean
  searchOpen?: boolean
  onToggleSearch?: () => void
}) {
  return (
    <XStack items="flex-start" justify="space-between" gap="$3" flexWrap="wrap">
      <YStack gap="$0.5" flex={1} minW={0}>
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          {title}
        </SizableText>
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
          {subtitle ?? `${total} transactions`}
        </SizableText>
      </YStack>

      <XStack items="center" gap="$2" shrink={0}>
        {showSearchToggle && onToggleSearch ? (
          <YStack
            width={40}
            height={40}
            items="center"
            justify="center"
            rounded="$10"
            bg={searchOpen ? MTD_TOKENS.cardInset : MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            cursor="pointer"
            pressStyle={{ opacity: 0.85 }}
            onPress={onToggleSearch}
            aria-label={searchOpen ? 'Hide search' : 'Show search'}
          >
            <MagnifyingGlassIcon
              size={18}
              color={searchOpen ? MTD_TOKENS.orange : MTD_TOKENS.text}
            />
          </YStack>
        ) : null}

        {showRulesButton ? (
          <XStack
            bg={MTD_TOKENS.card}
            borderWidth={1}
            borderColor={MTD_TOKENS.cardBorder}
            rounded="$10"
            px="$3"
            py="$2"
            gap="$2"
            items="center"
            cursor="pointer"
            pressStyle={{ opacity: 0.85 }}
            onPress={onRulesPress}
          >
            <ListChecksIcon size={16} color={MTD_TOKENS.text} />
            <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.text}>
              Rules
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
    </XStack>
  )
}

function TransactionSearchField({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  return (
    <XStack
      items="center"
      gap="$2"
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      px="$3"
      height={44}
    >
      <MagnifyingGlassIcon size={18} color={MTD_TOKENS.textMuted} />
      <Input
        flex={1}
        unstyled
        value={value}
        onChangeText={onChange}
        placeholder="Search transactions"
        {...mtdInputProps}
        height={42}
        fontSize={15}
        borderWidth={0}
        px={0}
        bg="transparent"
      />
      {value ? (
        <YStack
          width={28}
          height={28}
          items="center"
          justify="center"
          cursor="pointer"
          pressStyle={{ opacity: 0.75 }}
          onPress={() => onChange('')}
          aria-label="Clear search"
        >
          <XIcon size={16} color={MTD_TOKENS.textMuted} />
        </YStack>
      ) : null}
    </XStack>
  )
}

function TransactionListTitleHeader({
  total,
  title,
  subtitle,
  onRulesPress,
  showRulesButton = true,
  searchQuery,
  onSearchQueryChange,
  searchToggleable = false,
  searchOpen = true,
  onToggleSearch,
}: {
  total: number
  title?: string
  subtitle?: string
  onRulesPress: () => void
  showRulesButton?: boolean
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  searchToggleable?: boolean
  searchOpen?: boolean
  onToggleSearch?: () => void
}) {
  const showSearchField = searchToggleable ? searchOpen : true

  return (
    <YStack bg={MTD_TOKENS.background} px="$4" pt="$3" pb="$2" gap="$3">
      <TransactionListTitleRow
        title={title}
        subtitle={subtitle}
        total={total}
        onRulesPress={onRulesPress}
        showRulesButton={showRulesButton}
        showSearchToggle={searchToggleable}
        searchOpen={searchOpen}
        onToggleSearch={onToggleSearch}
      />
      {showSearchField ? (
        <TransactionSearchField value={searchQuery} onChange={onSearchQueryChange} />
      ) : null}
    </YStack>
  )
}

function TransactionListActionsHeader({
  activeTab,
  forReviewCount,
  categorisedCount,
  onTabChange,
  systemAccountKind,
  hideTabs = false,
  onAddManual,
  addManualLabel,
  scanPhotoLabel,
  choosePhotoLabel,
  chooseFileLabel,
  onAddVoucher,
  onAddStatement,
  onTakeReceiptPhoto,
  onChooseReceiptPhoto,
  onChooseReceiptFile,
  receiptScanBusy,
}: Pick<
  TransactionListSectionProps,
  | 'activeTab'
  | 'forReviewCount'
  | 'categorisedCount'
  | 'onTabChange'
  | 'systemAccountKind'
  | 'hideTabs'
> & {
  onAddManual?: () => void
  addManualLabel?: string
  scanPhotoLabel?: string
  choosePhotoLabel?: string
  chooseFileLabel?: string
  onAddVoucher?: () => void
  onAddStatement?: () => void
  onTakeReceiptPhoto?: () => void
  onChooseReceiptPhoto?: () => void
  onChooseReceiptFile?: () => void
  receiptScanBusy?: boolean
}) {
  const showActions = Boolean(systemAccountKind)
  const showTabs = !hideTabs

  if (!showActions && !showTabs) return null

  return (
    <YStack
      bg={MTD_TOKENS.background}
      px="$4"
      pt="$2"
      pb="$3"
      gap="$3"
      {...(isWeb
        ? {
            position: 'sticky' as const,
            top: 0,
            zIndex: 10,
          }
        : {})}
    >
      {systemAccountKind ? (
        <SystemAccountListActions
          kind={systemAccountKind}
          addTransactionLabel={addManualLabel}
          scanPhotoLabel={scanPhotoLabel}
          choosePhotoLabel={choosePhotoLabel}
          chooseFileLabel={chooseFileLabel}
          onAddTransaction={onAddManual}
          onAddVoucher={onAddVoucher}
          onAddStatement={onAddStatement}
          onTakeReceiptPhoto={onTakeReceiptPhoto}
          onChooseReceiptPhoto={onChooseReceiptPhoto}
          onChooseReceiptFile={onChooseReceiptFile}
          receiptScanBusy={receiptScanBusy}
        />
      ) : null}
      {showTabs ? (
        <TransactionListTabs
          activeTab={activeTab}
          forReviewCount={forReviewCount}
          categorisedCount={categorisedCount}
          onTabChange={onTabChange}
          onAddManual={onAddManual}
        />
      ) : null}
    </YStack>
  )
}

export function TransactionListSection({
  activeTab,
  forReviewCount,
  categorisedCount,
  onTabChange,
  transactions,
  total,
  showingCount,
  bankAccountId,
  isLoading = false,
  error,
  topContent,
  systemAccountKind,
  manualListMode = null,
  hideTabs = false,
  showRulesButton = true,
  contentInsetBottom = 24,
  title,
  subtitle,
}: TransactionListSectionProps) {
  const { updateCategory, approveTransactions } = useUpdateTransactionCategory()
  const { taxYearStart, quarterId } = useSubmissionPeriod()
  const currentQuarter = useMemo(
    () => getQuarterInfo(quarterId, taxYearStart),
    [quarterId, taxYearStart],
  )
  const persistRuleDrafts = usePersistTransactionRuleDrafts(bankAccountId)
  const [editingGroup, setEditingGroup] = useState<MtdTransactionGroup | null>(null)
  const [manualEditTransaction, setManualEditTransaction] = useState<
    MtdTransactionDto | null | 'create'
  >(null)
  const [receiptDraft, setReceiptDraft] = useState<ManualReceiptDraft | null>(null)
  const [receiptScanBusy, setReceiptScanBusy] = useState(false)
  const [isScanningReceipt, setIsScanningReceipt] = useState(false)
  const { asResolverInput } = useMerchantFingerprints()
  const [cisVoucherTransaction, setCisVoucherTransaction] = useState<
    MtdTransactionDto | null | 'create'
  >(null)
  const [cisVoucherDraft, setCisVoucherDraft] = useState<CisVoucherDraft | null>(null)
  const [landlordStatementTransaction, setLandlordStatementTransaction] = useState<
    MtdTransactionDto | null | 'create'
  >(null)
  const [landlordStatementDraft, setLandlordStatementDraft] =
    useState<LandlordStatementDraft | null>(null)
  const [addRuleGroup, setAddRuleGroup] = useState<MtdTransactionGroup | null>(null)
  const [showRulesPanel, setShowRulesPanel] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const isIncomeOrExpenseList = systemAccountKind === 'manual-entry'
  const [searchOpen, setSearchOpen] = useState(false)

  const createCategory: TransactionEditCategoryId | null =
    systemAccountKind === 'manual-entry'
      ? manualListMode === 'income'
        ? 'income'
        : 'business_expense'
      : null
  const createAllowedCategoryIds: TransactionEditCategoryId[] | undefined =
    systemAccountKind === 'manual-entry'
      ? manualListMode === 'income'
        ? ['income']
        : ['business_expense', 'mortgage', 'personal']
      : undefined
  const addManualLabel =
    manualListMode === 'income'
      ? 'Add income'
      : manualListMode === 'expenses'
        ? 'Add expense'
        : 'Transaction'
  const scanPhotoLabel = 'Take pic'
  const choosePhotoLabel = 'Select pic'
  const chooseFileLabel = 'Choose file'

  const normalizedSearch = searchQuery.trim().toLowerCase()
  const filteredTransactions = useMemo(() => {
    if (!normalizedSearch) return transactions
    return transactions.filter((transaction) =>
      transactionMatchesSearch(transaction, normalizedSearch),
    )
  }, [normalizedSearch, transactions])
  const filteredShowingCount = filteredTransactions.length
  const filteredTotal = normalizedSearch ? filteredTransactions.length : total

  const openManualCreate = useCallback(() => {
    setReceiptDraft(null)
    setManualEditTransaction('create')
  }, [])

  const openReceiptScan = useCallback(
    async (source: ReceiptPickSource) => {
      if (receiptScanBusy) return
      setReceiptScanBusy(true)
      try {
        const draft = await scanReceiptWithPicker(source, {
          onScanning: () => setIsScanningReceipt(true),
          onScanningDone: () => setIsScanningReceipt(false),
          kind: manualListMode === 'income' ? 'invoice' : 'receipt',
          userFingerprints: asResolverInput(),
        })
        if (!draft) return

        if (draft.date) {
          const dateCheck = await resolveManualEntryDate(draft.date, currentQuarter)
          if (!dateCheck.ok) return
          draft.date = dateCheck.date
        }

        setReceiptDraft(draft)
        setManualEditTransaction('create')
      } catch (error) {
        console.info('[receipt-scan] capture failed', error)
      } finally {
        setIsScanningReceipt(false)
        setReceiptScanBusy(false)
      }
    },
    [asResolverInput, currentQuarter, manualListMode, receiptScanBusy],
  )

  const closeManualEdit = useCallback(() => {
    setManualEditTransaction(null)
    setReceiptDraft(null)
  }, [])

  const openCisVoucher = useCallback(() => {
    setCisVoucherDraft(null)
    setCisVoucherTransaction('create')
  }, [])

  const openCisVoucherScan = useCallback(
    async (source: ReceiptPickSource) => {
      if (receiptScanBusy) return
      setReceiptScanBusy(true)
      try {
        const draft = await scanCisVoucherWithPicker(source, {
          onScanning: () => setIsScanningReceipt(true),
          onScanningDone: () => setIsScanningReceipt(false),
        })
        if (!draft) return

        setCisVoucherDraft(draft)
        setCisVoucherTransaction('create')
      } catch (error) {
        console.info('[cis-voucher-scan] capture failed', error)
      } finally {
        setIsScanningReceipt(false)
        setReceiptScanBusy(false)
      }
    },
    [receiptScanBusy],
  )

  const closeCisVoucher = useCallback(() => {
    setCisVoucherTransaction(null)
    setCisVoucherDraft(null)
  }, [])

  const openLandlordStatement = useCallback(() => {
    setLandlordStatementDraft(null)
    setLandlordStatementTransaction('create')
  }, [])

  const openLandlordStatementScan = useCallback(
    async (source: ReceiptPickSource) => {
      if (receiptScanBusy) return
      setReceiptScanBusy(true)
      try {
        const draft = await scanLandlordStatementWithPicker(source, {
          onScanning: () => setIsScanningReceipt(true),
          onScanningDone: () => setIsScanningReceipt(false),
        })
        if (!draft) return

        setLandlordStatementDraft(draft)
        setLandlordStatementTransaction('create')
      } catch (error) {
        console.info('[landlord-statement-scan] capture failed', error)
      } finally {
        setIsScanningReceipt(false)
        setReceiptScanBusy(false)
      }
    },
    [receiptScanBusy],
  )

  const closeLandlordStatement = useCallback(() => {
    setLandlordStatementTransaction(null)
    setLandlordStatementDraft(null)
  }, [])

  const handleEditGroup = useCallback((group: MtdTransactionGroup) => {
    const lead = group.transactions[0]
    if (lead?.isManual && isCisVoucherMerchant(lead.merchant)) {
      setCisVoucherDraft(null)
      setCisVoucherTransaction(lead)
      return
    }
    if (lead?.isManual && isLandlordStatementMerchant(lead.merchant)) {
      setLandlordStatementDraft(null)
      setLandlordStatementTransaction(lead)
      return
    }
    if (lead?.isManual) {
      setReceiptDraft(null)
      setManualEditTransaction(lead)
      return
    }
    setEditingGroup(group)
  }, [])

  const handleQuickAccept = useCallback(
    async (group: MtdTransactionGroup) => {
      if (group.transactions.length === 0) return

      await Promise.all(
        group.transactions.map((transaction) =>
          updateCategory(transaction.id, transaction.hmrcCategory, { notify: false }),
        ),
      )
      await approveTransactions(group.transactions.map((transaction) => transaction.id))
    },
    [approveTransactions, updateCategory],
  )

  const handleAccept = async ({
    hmrcCategory,
    transactionIds,
    rememberForFuture,
    friendlyName,
    ruleDrafts,
    privateUsePercent,
  }: TransactionEditAcceptInput) => {
    if (transactionIds.length === 0) return

    // private use is stored on rules — save before approve so the card label appears
    if (rememberForFuture || privateUsePercent != null) {
      await persistTransactionRuleDrafts(persistRuleDrafts, {
        ruleDrafts,
        friendlyName,
        hmrcCategory,
        privateUsePercent,
      })
    }

    await Promise.all(
      transactionIds.map((transactionId) =>
        updateCategory(transactionId, hmrcCategory, { notify: false }),
      ),
    )
    await approveTransactions(transactionIds)
  }

  const emptyTitle =
    systemAccountKind === 'cis'
      ? 'No vouchers yet'
      : systemAccountKind === 'landlord'
        ? 'No statements yet'
        : manualListMode === 'income'
          ? 'No income yet'
          : manualListMode === 'expenses'
            ? 'No expenses yet'
            : hideTabs
              ? 'No transactions yet'
              : activeTab === 'for-review'
                ? 'No transactions to review'
                : 'No categorised transactions yet'
  const emptyMessage =
    systemAccountKind === 'cis'
      ? 'Tap Add voucher or scan a voucher to get started.'
      : systemAccountKind === 'landlord'
        ? 'Tap Add statement or scan a statement to get started.'
        : manualListMode === 'income'
          ? 'Tap Add income or scan an invoice to get started.'
          : manualListMode === 'expenses'
            ? 'Tap Add expense to record spending or upload a receipt.'
            : hideTabs
              ? 'Add a transaction to get started.'
              : activeTab === 'for-review'
                ? 'Import transactions or accept categorised items from your other tab.'
                : 'Accepted transactions will appear here once you review them.'
  const searchEmpty = Boolean(normalizedSearch) && filteredTransactions.length === 0

  const listBody = (
    <YStack gap="$3" px="$4" pb={contentInsetBottom}>
      {error ? (
        <YStack
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$5"
          p="$4"
        >
          <SizableText fontSize={14} color={MTD_TOKENS.orange}>
            {error}
          </SizableText>
        </YStack>
      ) : null}

      {isLoading ? (
        <YStack py="$8" items="center">
          <Spinner size="large" color={MTD_TOKENS.orange} />
        </YStack>
      ) : searchEmpty ? (
        <YStack
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$5"
          p="$6"
          items="center"
          gap="$2"
        >
          <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
            No matching transactions
          </SizableText>
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted} text="center">
            Try a different name, category, date, or amount.
          </SizableText>
        </YStack>
      ) : transactions.length === 0 ? (
        <YStack
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$5"
          p="$6"
          items="center"
          gap="$2"
        >
          <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
            {emptyTitle}
          </SizableText>
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted} text="center">
            {emptyMessage}
          </SizableText>
        </YStack>
      ) : (
        <TransactionGroupList
          transactions={filteredTransactions}
          contentInsetX="$3.5"
          onEditGroup={handleEditGroup}
          onAcceptGroup={systemAccountKind ? undefined : handleQuickAccept}
          onAddRuleGroup={systemAccountKind ? undefined : setAddRuleGroup}
          groupByName={
            systemAccountKind !== 'manual-entry' && systemAccountKind !== 'cis'
          }
        />
      )}

      {!searchEmpty && filteredTransactions.length > 0 ? (
        <YStack items="center" gap="$2" pt="$2">
          <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
            {normalizedSearch
              ? `${filteredShowingCount} match${filteredShowingCount === 1 ? '' : 'es'}`
              : `Showing 1–${showingCount} of ${total} transactions`}
          </SizableText>
          {!normalizedSearch && showingCount < total ? (
            <XStack
              items="center"
              gap="$1"
              cursor="pointer"
              pressStyle={{ opacity: 0.8 }}
            >
              <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.orange}>
                Load more
              </SizableText>
              <CaretDownIcon size={16} color={MTD_TOKENS.orange} />
            </XStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  )

  const titleHeader = (
    <TransactionListTitleHeader
      total={filteredTotal}
      title={title}
      subtitle={subtitle}
      onRulesPress={() => setShowRulesPanel(true)}
      showRulesButton={showRulesButton}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      searchToggleable={isIncomeOrExpenseList}
      searchOpen={searchOpen}
      onToggleSearch={() => {
        setSearchOpen((open) => {
          if (open) setSearchQuery('')
          return !open
        })
      }}
    />
  )

  const actionsHeader = (
    <TransactionListActionsHeader
      activeTab={activeTab}
      forReviewCount={forReviewCount}
      categorisedCount={categorisedCount}
      onTabChange={onTabChange}
      systemAccountKind={systemAccountKind}
      hideTabs={hideTabs}
      onAddManual={
        bankAccountId && systemAccountKind === 'manual-entry'
          ? openManualCreate
          : undefined
      }
      addManualLabel={addManualLabel}
      scanPhotoLabel={scanPhotoLabel}
      choosePhotoLabel={choosePhotoLabel}
      chooseFileLabel={chooseFileLabel}
      onAddVoucher={
        bankAccountId && systemAccountKind === 'cis' ? openCisVoucher : undefined
      }
      onAddStatement={
        bankAccountId && systemAccountKind === 'landlord'
          ? openLandlordStatement
          : undefined
      }
      onTakeReceiptPhoto={
        bankAccountId &&
        ((systemAccountKind === 'manual-entry' && isReceiptScanUiAvailable()) ||
          (systemAccountKind === 'cis' && isCisVoucherScanUiAvailable()) ||
          (systemAccountKind === 'landlord' && isLandlordStatementScanUiAvailable()))
          ? () => {
              if (systemAccountKind === 'cis') {
                void openCisVoucherScan('camera')
                return
              }
              if (systemAccountKind === 'landlord') {
                void openLandlordStatementScan('camera')
                return
              }
              void openReceiptScan('camera')
            }
          : undefined
      }
      onChooseReceiptPhoto={
        bankAccountId &&
        ((systemAccountKind === 'manual-entry' && isReceiptScanUiAvailable()) ||
          (systemAccountKind === 'cis' && isCisVoucherScanUiAvailable()) ||
          (systemAccountKind === 'landlord' && isLandlordStatementScanUiAvailable()))
          ? () => {
              if (systemAccountKind === 'cis') {
                void openCisVoucherScan('library')
                return
              }
              if (systemAccountKind === 'landlord') {
                void openLandlordStatementScan('library')
                return
              }
              void openReceiptScan('library')
            }
          : undefined
      }
      onChooseReceiptFile={
        bankAccountId &&
        (systemAccountKind === 'manual-entry' ||
          systemAccountKind === 'cis' ||
          systemAccountKind === 'landlord')
          ? () => {
              if (systemAccountKind === 'cis') {
                void openCisVoucherScan('file')
                return
              }
              if (systemAccountKind === 'landlord') {
                void openLandlordStatementScan('file')
                return
              }
              void openReceiptScan('file')
            }
          : undefined
      }
      receiptScanBusy={receiptScanBusy}
    />
  )

  const hasStickyActions = Boolean(systemAccountKind) || !hideTabs
  const listContent = (
    <YStack maxW={1200} width="100%" mx="auto" $lg={{ px: '$2' }}>
      {listBody}
    </YStack>
  )

  const panels = (
    <>
      <ReceiptScanningPopup visible={isScanningReceipt} />

      {manualEditTransaction && bankAccountId ? (
        <ManualTransactionEditScreen
          key={
            manualEditTransaction === 'create'
              ? receiptDraft
                ? `manual-create-receipt-${receiptDraft.localImageUri}`
                : `manual-create-${createCategory ?? 'any'}`
              : manualEditTransaction.id
          }
          bankAccountId={bankAccountId}
          transaction={manualEditTransaction === 'create' ? null : manualEditTransaction}
          receiptDraft={manualEditTransaction === 'create' ? receiptDraft : null}
          initialCategory={manualEditTransaction === 'create' ? createCategory : null}
          allowedCategoryIds={
            manualEditTransaction === 'create' ? createAllowedCategoryIds : undefined
          }
          onClose={closeManualEdit}
        />
      ) : null}

      {cisVoucherTransaction && bankAccountId ? (
        <CisVoucherEditScreen
          key={
            cisVoucherTransaction === 'create'
              ? cisVoucherDraft
                ? `cis-voucher-create-scan-${cisVoucherDraft.customer}-${cisVoucherDraft.gross}-${cisVoucherDraft.tax}`
                : 'cis-voucher-create'
              : cisVoucherTransaction.id
          }
          bankAccountId={bankAccountId}
          transaction={cisVoucherTransaction === 'create' ? null : cisVoucherTransaction}
          voucherDraft={cisVoucherTransaction === 'create' ? cisVoucherDraft : null}
          accountTransactions={transactions}
          onClose={closeCisVoucher}
        />
      ) : null}

      {landlordStatementTransaction && bankAccountId ? (
        <LandlordStatementEditScreen
          key={
            landlordStatementTransaction === 'create'
              ? landlordStatementDraft
                ? `landlord-statement-create-scan-${landlordStatementDraft.localImageUri}`
                : 'landlord-statement-create'
              : landlordStatementTransaction.id
          }
          bankAccountId={bankAccountId}
          transaction={
            landlordStatementTransaction === 'create'
              ? null
              : landlordStatementTransaction
          }
          statementDraft={
            landlordStatementTransaction === 'create' ? landlordStatementDraft : null
          }
          accountTransactions={transactions}
          onClose={closeLandlordStatement}
        />
      ) : null}

      {editingGroup ? (
        <TransactionEditScreen
          key={editingGroup.key}
          transactions={editingGroup.transactions}
          bankAccountId={bankAccountId}
          onClose={() => setEditingGroup(null)}
          onAccept={handleAccept}
        />
      ) : null}

      {addRuleGroup ? (
        <AddTransactionRulePanel
          key={addRuleGroup.key}
          group={addRuleGroup}
          bankAccountId={bankAccountId}
          onClose={() => setAddRuleGroup(null)}
          onSaved={() => setAddRuleGroup(null)}
        />
      ) : null}

      {showRulesPanel ? (
        <TransactionRulesListPanel
          bankAccountId={bankAccountId}
          onClose={() => setShowRulesPanel(false)}
        />
      ) : null}
    </>
  )

  if (topContent) {
    const ScrollView = isWeb ? YStack : GHScrollView
    // 0: topContent, 1: title, 2: actions (sticky), 3: list
    const stickyIndex = hasStickyActions ? 2 : undefined

    return (
      <>
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          {...(isWeb
            ? { overflow: 'scroll' as const }
            : {
                ...(stickyIndex != null ? { stickyHeaderIndices: [stickyIndex] } : {}),
                contentContainerStyle: { flexGrow: 1 },
              })}
        >
          <YStack
            gap="$5"
            px="$4"
            pt="$4"
            pb="$3"
            maxW={1200}
            width="100%"
            mx="auto"
            $lg={{ px: '$6', pt: '$6', gap: '$6' }}
          >
            {topContent}
          </YStack>
          {titleHeader}
          {actionsHeader}
          {listContent}
        </ScrollView>

        {panels}
      </>
    )
  }

  const ScrollView = isWeb ? YStack : GHScrollView
  // 0: title (scrolls away), 1: actions (+ transaction / tabs) sticky
  const stickyIndex = hasStickyActions ? 1 : undefined

  return (
    <>
      <ScrollView
        flex={1}
        showsVerticalScrollIndicator={false}
        {...(isWeb
          ? { overflow: 'scroll' as const }
          : {
              ...(stickyIndex != null ? { stickyHeaderIndices: [stickyIndex] } : {}),
              contentContainerStyle: { flexGrow: 1 },
            })}
      >
        {titleHeader}
        {actionsHeader}
        {listContent}
      </ScrollView>

      {panels}
    </>
  )
}
