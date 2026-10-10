import { memo, useEffect, useMemo, useState } from 'react'
import { router, useSearchParams, type Href } from 'one'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, YStack } from 'tamagui'

import { useAuth } from '~/features/auth/client/authClient'
import { authFetch } from '~/features/auth/client/authFetch'
import { getReviewWizardManualEntryIds } from '~/features/mtd/components/review-wizard/reviewWizardEntriesStorage'
import {
  useSelectedTaxYear,
  useSubmissionPeriod,
} from '~/features/mtd/context/TaxYearProvider'
import {
  getManualEntryListMode,
  parseManualEntryListMode,
  setManualEntryListMode,
  type ManualEntryListMode,
} from '~/features/mtd/manualEntryListMode'
import { isDateInTaxYear } from '~/features/mtd/utils/quarterPeriods'
import { useMtdAccountTransactions } from '~/features/bankAccounts/client/useMtdAccountTransactions'
import { getSystemBankAccountKind } from '~/features/bankAccounts/defaultBankAccounts'

import { MtdDetailHeader } from '../components/MtdDetailHeader'
import { TransactionListSection } from '../components/TransactionListSection'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'

import type { BankAccountDto } from '~/features/bankAccounts/client/useMtdBankAccounts'

type BankAccountTransactionsScreenProps = {
  bankAccountId: string
}

function formatAccountSubtitle(account: BankAccountDto) {
  const parts: string[] = []
  if (account.sortCode) parts.push(account.sortCode)
  if (account.accountNumber) parts.push(account.accountNumber)
  return parts.length > 0 ? parts.join(' · ') : undefined
}

export const BankAccountTransactionsScreen = memo(
  ({ bankAccountId }: BankAccountTransactionsScreenProps) => {
    const insets = useSafeAreaInsets()
    const auth = useAuth()
    const userId = auth?.user?.id
    const searchParams = useSearchParams()
    const { taxYearStart, quarterId } = useSubmissionPeriod()
    const { taxYearStart: selectedTaxYearStart } = useSelectedTaxYear()
    const [account, setAccount] = useState<BankAccountDto | null>(null)
    const [accountLoading, setAccountLoading] = useState(true)
    const systemAccountKind = account
      ? getSystemBankAccountKind(account.externalAccountId)
      : null
    const isSystemAccountList = systemAccountKind != null
    const isManualEntry = systemAccountKind === 'manual-entry'

    const listFromUrl = parseManualEntryListMode(searchParams.get('list'))
    const manualListMode: ManualEntryListMode = listFromUrl ?? getManualEntryListMode()

    useEffect(() => {
      if (listFromUrl) {
        setManualEntryListMode(listFromUrl)
      }
    }, [listFromUrl])

    const {
      activeTab,
      setActiveTab,
      forReviewCount,
      categorisedCount,
      transactions,
      total,
      showingCount,
      isLoading,
      error,
    } = useMtdAccountTransactions(bankAccountId, {
      mode: isSystemAccountList ? 'single' : 'tabbed',
      enabled: !accountLoading,
    })

    const wizardManualIds = useMemo(() => {
      if (!userId) return new Set<string>()
      return getReviewWizardManualEntryIds(userId, taxYearStart, quarterId)
    }, [quarterId, userId, taxYearStart, transactions])

    const visibleTransactions = useMemo(() => {
      const withoutWizard = transactions.filter(
        (transaction) => !wizardManualIds.has(transaction.id),
      )
      if (!isManualEntry) return withoutWizard

      const inSelectedYear = withoutWizard.filter((transaction) =>
        isDateInTaxYear(transaction.dateIso, selectedTaxYearStart),
      )

      if (manualListMode === 'income') {
        return inSelectedYear.filter(
          (transaction) => transaction.categoryType === 'income',
        )
      }
      return inSelectedYear.filter((transaction) => transaction.categoryType !== 'income')
    }, [
      isManualEntry,
      manualListMode,
      selectedTaxYearStart,
      transactions,
      wizardManualIds,
    ])

    const hiddenCount = transactions.length - visibleTransactions.length
    const visibleTotal = isManualEntry
      ? visibleTransactions.length
      : Math.max(0, total - hiddenCount)
    const visibleShowingCount = isManualEntry
      ? visibleTransactions.length
      : Math.max(0, showingCount - hiddenCount)

    useEffect(() => {
      setAccountLoading(true)
      void authFetch<{ accounts: BankAccountDto[] }>('/api/bank-accounts')
        .then((response) => {
          if (response.data) {
            const match = response.data.accounts.find((row) => row.id === bankAccountId)
            setAccount(match ?? null)
          }
        })
        .finally(() => {
          setAccountLoading(false)
        })
    }, [bankAccountId])

    const headerTitle = isManualEntry
      ? manualListMode === 'income'
        ? 'Income'
        : 'Expenses'
      : account?.institutionName || account?.accountName || 'Bank account'
    const backHref = isSystemAccountList ? MTD_ROUTES.records : MTD_ROUTES.bankAccounts
    const handleBack = isSystemAccountList
      ? () => {
          router.replace(backHref as Href)
        }
      : undefined
    const listTitle = isManualEntry
      ? manualListMode === 'income'
        ? 'Record income here'
        : 'Record expenses here'
      : account?.accountName || account?.institutionName || 'Transactions'
    const listSubtitle = useMemo(() => {
      if (isManualEntry) {
        return `${visibleTotal} ${manualListMode === 'income' ? 'income' : 'expense'}${visibleTotal === 1 ? '' : 's'}`
      }
      const accountDetails = account ? formatAccountSubtitle(account) : undefined
      if (accountDetails) return accountDetails
      return `${visibleTotal} transactions`
    }, [account, isManualEntry, manualListMode, visibleTotal])

    const listSection = (
      <TransactionListSection
        activeTab={activeTab}
        forReviewCount={forReviewCount}
        categorisedCount={categorisedCount}
        onTabChange={setActiveTab}
        transactions={visibleTransactions}
        total={visibleTotal}
        showingCount={visibleShowingCount}
        isLoading={accountLoading || isLoading}
        error={error}
        bankAccountId={bankAccountId}
        title={listTitle}
        subtitle={listSubtitle}
        hideTabs={isSystemAccountList}
        showRulesButton={!isSystemAccountList}
        systemAccountKind={systemAccountKind}
        manualListMode={isManualEntry ? manualListMode : null}
        contentInsetBottom={isWeb ? 24 : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      />
    )

    if (isWeb) {
      return (
        <YStack flex={1} bg={MTD_TOKENS.background}>
          <MtdDetailHeader backHref={backHref} onBack={handleBack} title={headerTitle} />
          <YStack flex={1} py="$4">
            {listSection}
          </YStack>
        </YStack>
      )
    }

    return (
      <YStack flex={1} bg={MTD_TOKENS.background}>
        <YStack pt={insets.top}>
          <MtdDetailHeader backHref={backHref} onBack={handleBack} title={headerTitle} />
        </YStack>
        <YStack flex={1}>{listSection}</YStack>
      </YStack>
    )
  },
)
