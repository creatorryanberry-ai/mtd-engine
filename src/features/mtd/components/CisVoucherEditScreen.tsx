import { useMemo, useState, type ReactNode } from 'react'
import { ScrollView as RNScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { useManualTransaction } from '~/features/categorisation/client/useManualTransaction'
import { useUpdateTransactionCategory } from '~/features/categorisation/client/useUpdateTransactionCategory'
import { getHmrcCategoryForEditCategory } from '~/features/mtd/categories/transactionEditCategories'
import { useMerchantFingerprints } from '~/features/mtd/receipt/client/useMerchantFingerprints'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { mtdFieldChrome, mtdInputProps } from '~/features/mtd/mtdFormStyles'
import {
  collectCisCustomers,
  formatCisVoucherDetails,
  getDefaultCisVoucherDate,
  parseCisVoucherAmounts,
  parseCisVoucherTransaction,
} from '~/features/bankAccounts/utils/cisVoucher'
import { formatAmountInputValue } from '~/features/bankAccounts/utils/manualTransaction'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { Input } from '~/interface/forms/Input'
import { CisCustomerField } from './CisCustomerField'
import { CisVoucherDatePicker } from './CisVoucherDatePicker'
import { MtdActionButton } from './MtdActionButton'
import { SlideFromRightPanel } from './SlideFromRightPanel'

import type { CisVoucherDraft } from '~/features/mtd/receipt/scanCisVoucher'
import type { MtdTransactionDto } from '~/features/bankAccounts/types'

type CisVoucherEditScreenProps = {
  bankAccountId: string
  transaction?: MtdTransactionDto | null
  voucherDraft?: CisVoucherDraft | null
  accountTransactions?: MtdTransactionDto[]
  onClose: () => void
  onSaved?: (entry: { id: string; customer: string; gross: number; tax: number }) => void
  embedded?: boolean
  footer?: ReactNode
  aboveForm?: ReactNode
}

function CisVoucherEditContent({
  bankAccountId,
  transaction,
  voucherDraft = null,
  accountTransactions = [],
  onClose,
  onSaved,
  footer = null,
  aboveForm = null,
}: CisVoucherEditScreenProps) {
  const insets = useSafeAreaInsets()
  const { createManualTransaction, updateManualTransaction, deleteManualTransaction } =
    useManualTransaction()
  const { updateCategory, approveTransactions } = useUpdateTransactionCategory()
  const { learnFromSave } = useMerchantFingerprints()

  const customerSuggestions = useMemo(
    () => collectCisCustomers(accountTransactions),
    [accountTransactions],
  )

  const initial = useMemo(() => {
    if (!transaction) {
      return {
        date: voucherDraft?.date?.trim() || getDefaultCisVoucherDate(),
        customer: voucherDraft?.customer ?? '',
        gross: voucherDraft?.gross ?? '',
        tax: voucherDraft?.tax ?? '',
      }
    }

    const parsed = parseCisVoucherTransaction(transaction)
    return {
      date: transaction.dateIso,
      customer: parsed?.customer ?? '',
      gross: parsed ? formatAmountInputValue(parsed.gross) : '',
      tax: parsed ? formatAmountInputValue(parsed.tax) : '',
    }
  }, [transaction, voucherDraft])

  const [date, setDate] = useState(initial.date)
  const [customer, setCustomer] = useState(initial.customer)
  const [gross, setGross] = useState(initial.gross)
  const [tax, setTax] = useState(initial.tax)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amounts = useMemo(() => parseCisVoucherAmounts(gross, tax), [gross, tax])
  const canSave =
    customer.trim().length > 0 &&
    date.trim().length > 0 &&
    amounts != null &&
    !isSaving &&
    !isDeleting

  const handleSave = async () => {
    if (!amounts || !canSave) return

    setIsSaving(true)
    setError(null)

    try {
      const payload = {
        name: customer.trim(),
        details: formatCisVoucherDetails(amounts.gross, amounts.tax),
        date: date.trim(),
        amount: amounts.gross,
      }

      const saved = transaction
        ? await updateManualTransaction({ id: transaction.id, ...payload })
        : await createManualTransaction({ bankAccountId, ...payload })

      const hmrcCategory = getHmrcCategoryForEditCategory('income')
      await updateCategory(saved.id, hmrcCategory, { notify: false })
      if (!transaction || transaction.needsReview) {
        await approveTransactions([saved.id])
      }

      const savedCustomer = customer.trim()
      if (voucherDraft?.ocrText?.trim() && savedCustomer) {
        try {
          await learnFromSave({
            canonicalName: savedCustomer,
            processKind: 'cis',
            sourceSuggestedName: voucherDraft.customer || null,
            ocrText: voucherDraft.ocrText,
          })
        } catch (learnError) {
          console.info('[merchant-fingerprint] cis learn failed', learnError)
        }
      }

      onSaved?.({
        id: saved.id,
        customer: savedCustomer,
        gross: amounts.gross,
        tax: amounts.tax,
      })
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save CIS voucher',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!transaction || isDeleting || isSaving) return

    const confirmed = await dialogConfirm({
      title: 'Delete CIS voucher?',
      description: 'This permanently removes the voucher. This cannot be undone.',
    })
    if (!confirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      await deleteManualTransaction(transaction.id)
      onClose()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete CIS voucher',
      )
    } finally {
      setIsDeleting(false)
    }
  }

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
          disabled={!canSave}
          loading={isSaving}
          onPress={() => void handleSave()}
        >
          Save
        </MtdActionButton>
      </XStack>

      <RNScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: isWeb ? 32 : insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <YStack px="$4" pt="$4" gap="$5" maxW={720} width="100%" self="center">
          {aboveForm}
          <YStack gap="$2.5">
            <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.textMuted}>
              CIS voucher
            </SizableText>
            <YStack gap="$3">
              <YStack gap="$1.5">
                <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                  Date
                </SizableText>
                <CisVoucherDatePicker value={date} onChange={setDate} />
              </YStack>

              <CisCustomerField
                value={customer}
                onChange={setCustomer}
                suggestions={customerSuggestions}
                autoFocus={!transaction && !voucherDraft?.customer}
              />

              <XStack gap="$3" flexWrap="wrap">
                <YStack gap="$1.5" flex={1} minW={140}>
                  <SizableText
                    fontSize={13}
                    fontWeight="500"
                    color={MTD_TOKENS.textMuted}
                  >
                    Gross
                  </SizableText>
                  <Input
                    value={gross}
                    onChangeText={setGross}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    {...mtdInputProps}
                  />
                </YStack>

                <YStack gap="$1.5" flex={1} minW={140}>
                  <SizableText
                    fontSize={13}
                    fontWeight="500"
                    color={MTD_TOKENS.textMuted}
                  >
                    Tax
                  </SizableText>
                  <Input
                    value={tax}
                    onChangeText={setTax}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    {...mtdInputProps}
                  />
                </YStack>
              </XStack>

              <YStack gap="$1.5">
                <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                  Net
                </SizableText>
                <XStack width="100%" items="center" opacity={0.85} {...mtdFieldChrome}>
                  <SizableText
                    fontSize={15}
                    color={amounts ? MTD_TOKENS.text : MTD_TOKENS.textMuted}
                    lineHeight={20}
                  >
                    {amounts ? formatAmountInputValue(amounts.net) : '0.00'}
                  </SizableText>
                </XStack>
              </YStack>
            </YStack>
          </YStack>

          {error ? (
            <SizableText fontSize={13} color={MTD_TOKENS.orange}>
              {error}
            </SizableText>
          ) : null}

          {transaction ? (
            <MtdActionButton
              size="large"
              variant="secondary"
              disabled={isSaving || isDeleting}
              loading={isDeleting}
              onPress={() => void handleDelete()}
            >
              Delete voucher
            </MtdActionButton>
          ) : null}

          {footer}
        </YStack>
      </RNScrollView>
    </YStack>
  )
}

export function CisVoucherEditScreen({
  bankAccountId,
  transaction,
  voucherDraft,
  accountTransactions,
  onClose,
  onSaved,
  embedded = false,
  footer = null,
  aboveForm = null,
}: CisVoucherEditScreenProps) {
  if (embedded) {
    return (
      <CisVoucherEditContent
        bankAccountId={bankAccountId}
        transaction={transaction}
        voucherDraft={voucherDraft}
        accountTransactions={accountTransactions}
        onClose={onClose}
        onSaved={onSaved}
        footer={footer}
        aboveForm={aboveForm}
      />
    )
  }

  return (
    <SlideFromRightPanel onClose={onClose}>
      {(requestClose) => (
        <CisVoucherEditContent
          bankAccountId={bankAccountId}
          transaction={transaction}
          voucherDraft={voucherDraft}
          accountTransactions={accountTransactions}
          onClose={requestClose}
          onSaved={onSaved}
          footer={footer}
          aboveForm={aboveForm}
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
