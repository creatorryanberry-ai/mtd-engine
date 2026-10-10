import { useMemo } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import { useMileageEntries } from '~/features/mileage/client/useMileageEntries'
import { formatMileageClaimPounds } from '~/features/mileage/utils/mileageClaim'
import { useInboxDocuments } from '~/features/inbox/client/useInboxDocuments'
import { TaxYearSelector } from '~/features/mtd/components/TaxYearSelector'
import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { RecordsRow } from '~/features/mtd/components/RecordsRow'
import { useSelectedTaxYear } from '~/features/mtd/context/TaxYearProvider'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { formatSubmissionAmount } from '~/features/mtd/utils/formatAmount'
import { isDateInTaxYear } from '~/features/mtd/utils/quarterPeriods'
import { useMtdAccountTransactions } from '~/features/bankAccounts/client/useMtdAccountTransactions'
import { useMtdBankAccounts } from '~/features/bankAccounts/client/useMtdBankAccounts'
import type { BankAccountDto } from '~/features/bankAccounts/client/useMtdBankAccounts'
import { useVisibleBankAccounts } from '~/features/bankAccounts/client/useVisibleBankAccounts'
import { SYSTEM_ACCOUNT_IDS } from '~/features/bankAccounts/defaultBankAccounts'
import { setManualEntryListMode } from '~/features/mtd/manualEntryListMode'
import { ArrowUpIcon } from '~/interface/icons/phosphor/ArrowUpIcon'
import { BankIcon } from '~/interface/icons/phosphor/BankIcon'
import { CarIcon } from '~/interface/icons/phosphor/CarIcon'
import { EnvelopeIcon } from '~/interface/icons/phosphor/EnvelopeIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'
import { ReceiptIcon } from '~/interface/icons/phosphor/ReceiptIcon'

function findSystemAccount(accounts: BankAccountDto[], externalAccountId: string) {
  return (
    accounts.find((account) => account.externalAccountId === externalAccountId) ?? null
  )
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100
}

export function RecordsScreen() {
  const insets = useSafeAreaInsets()
  const { waitingCount } = useInboxDocuments()
  const { taxYearStart } = useSelectedTaxYear()
  const { settings } = useBusinessSettings()
  const { accounts, isLoading } = useMtdBankAccounts()
  const { systemAccounts, connectedAccounts } = useVisibleBankAccounts(accounts)
  const showMileage = settings?.vehicleClaimMethod === 'mileage'
  const { entries: mileageEntries } = useMileageEntries()

  const manualAccount = useMemo(
    () => findSystemAccount(systemAccounts, SYSTEM_ACCOUNT_IDS.manualEntry),
    [systemAccounts],
  )
  const cisAccount = useMemo(
    () => findSystemAccount(systemAccounts, SYSTEM_ACCOUNT_IDS.cis),
    [systemAccounts],
  )
  const landlordAccount = useMemo(
    () => findSystemAccount(systemAccounts, SYSTEM_ACCOUNT_IDS.landlord),
    [systemAccounts],
  )

  const { transactions: manualTransactions } = useMtdAccountTransactions(
    manualAccount?.id ?? '',
    {
      mode: 'single',
      limit: 500,
      enabled: Boolean(manualAccount?.id),
    },
  )

  const { incomeTotal, expenseTotal } = useMemo(() => {
    let income = 0
    let expense = 0
    for (const transaction of manualTransactions) {
      if (!isDateInTaxYear(transaction.dateIso, taxYearStart)) continue
      if (transaction.amount > 0) income += transaction.amount
      else expense += Math.abs(transaction.amount)
    }
    return {
      incomeTotal: roundMoney(income),
      expenseTotal: roundMoney(expense),
    }
  }, [manualTransactions, taxYearStart])

  const mileageMiles = useMemo(
    () => mileageEntries.reduce((sum, entry) => sum + entry.miles, 0),
    [mileageEntries],
  )
  const mileageClaim = useMemo(
    () => mileageEntries.reduce((sum, entry) => sum + entry.claimPounds, 0),
    [mileageEntries],
  )

  const connectedLabel =
    connectedAccounts.length === 0
      ? 'None connected'
      : `${connectedAccounts.length} connected`

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
      <YStack gap="$3">
        <TaxYearSelector />
      </YStack>

      {isLoading ? (
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
          Loading records…
        </SizableText>
      ) : (
        <YStack gap="$2.5">
          <RecordsRow
            title="Inbox"
            subtitle={
              waitingCount === 1
                ? '1 document waiting'
                : `${waitingCount} documents waiting`
            }
            icon={<EnvelopeIcon size={22} color="#38BDF8" />}
            iconBg="rgba(56, 189, 248, 0.15)"
            href={MTD_ROUTES.inbox}
          />

          {manualAccount ? (
            <>
              <RecordsRow
                title="Income"
                subtitle="Add income and scan invoices"
                value={formatSubmissionAmount(incomeTotal)}
                icon={<ArrowUpIcon size={22} color="#22C55E" />}
                iconBg="rgba(34, 197, 94, 0.15)"
                href={`${MTD_ROUTES.bankAccounts}/${manualAccount.id}/categorise?list=income`}
                onPress={() => setManualEntryListMode('income')}
              />
              <RecordsRow
                title="Expenses"
                subtitle="Add expenses and receipts"
                value={formatSubmissionAmount(expenseTotal)}
                icon={<ReceiptIcon size={22} color="#F97316" />}
                iconBg="rgba(249, 115, 22, 0.15)"
                href={`${MTD_ROUTES.bankAccounts}/${manualAccount.id}/categorise?list=expenses`}
                onPress={() => setManualEntryListMode('expenses')}
              />
            </>
          ) : null}

          {cisAccount ? (
            <RecordsRow
              title="CIS vouchers"
              subtitle={`${cisAccount.transactionCount} voucher${cisAccount.transactionCount === 1 ? '' : 's'}`}
              value={
                cisAccount.balance != null
                  ? formatSubmissionAmount(cisAccount.balance)
                  : undefined
              }
              icon={<ReceiptIcon size={22} color="#EF4444" />}
              iconBg="rgba(239, 68, 68, 0.15)"
              href={`${MTD_ROUTES.bankAccounts}/${cisAccount.id}/categorise`}
            />
          ) : null}

          {landlordAccount ? (
            <RecordsRow
              title="Landlord"
              subtitle={`${landlordAccount.transactionCount} statement${landlordAccount.transactionCount === 1 ? '' : 's'}`}
              value={
                landlordAccount.balance != null
                  ? formatSubmissionAmount(landlordAccount.balance)
                  : undefined
              }
              icon={<HouseIcon size={22} color="#A78BFA" />}
              iconBg="rgba(167, 139, 250, 0.15)"
              href={`${MTD_ROUTES.bankAccounts}/${landlordAccount.id}/categorise`}
            />
          ) : null}

          {showMileage ? (
            <RecordsRow
              title="Mileage"
              subtitle={`${mileageMiles.toLocaleString('en-GB')} miles`}
              value={formatMileageClaimPounds(mileageClaim)}
              icon={<CarIcon size={22} color="#3B82F6" />}
              iconBg="rgba(59, 130, 246, 0.15)"
              href={MTD_ROUTES.mileage}
            />
          ) : null}

          <RecordsRow
            title="Bank accounts"
            subtitle={connectedLabel}
            icon={<BankIcon size={22} color={MTD_TOKENS.textMuted} />}
            iconBg="rgba(156, 163, 175, 0.18)"
            href={MTD_ROUTES.bankAccounts}
          />

          {manualAccount ? (
            <YStack
              mt="$2"
              bg={MTD_TOKENS.card}
              borderWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              rounded="$5"
              px="$4"
              py="$3.5"
              gap="$2.5"
            >
              <XStack justify="space-between" items="center">
                <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                  Total income
                </SizableText>
                <SizableText fontSize={15} fontWeight="600" color="#22C55E">
                  {formatSubmissionAmount(incomeTotal)}
                </SizableText>
              </XStack>
              <XStack justify="space-between" items="center">
                <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                  Total expenses
                </SizableText>
                <SizableText fontSize={15} fontWeight="600" color="#F97316">
                  {formatSubmissionAmount(expenseTotal)}
                </SizableText>
              </XStack>
            </YStack>
          ) : null}
        </YStack>
      )}
    </YStack>
  )

  if (isWeb) {
    return (
      <YStack flex={1} minH={0} bg={MTD_TOKENS.background}>
        <MtdDetailHeader backHref={MTD_ROUTES.overview} title="Records" />
        <YStack flex={1} minH={0} overflow="scroll" py="$4">
          {content}
        </YStack>
      </YStack>
    )
  }

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      <YStack pt={insets.top}>
        <MtdDetailHeader backHref={MTD_ROUTES.overview} title="Records" />
      </YStack>
      <ScrollView flex={1} showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
    </YStack>
  )
}
