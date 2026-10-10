import { useMemo, useState, type ReactNode } from 'react'
import { ScrollView as RNScrollView, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { useManualTransaction } from '~/features/categorisation/client/useManualTransaction'
import { useUpdateTransactionCategory } from '~/features/categorisation/client/useUpdateTransactionCategory'
import { getHmrcCategoryForEditCategory } from '~/features/mtd/categories/transactionEditCategories'
import { prepareReceiptImageForUpload } from '~/features/mtd/receipt/prepareReceiptImage'
import { useMerchantFingerprints } from '~/features/mtd/receipt/client/useMerchantFingerprints'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { mtdFieldChrome, mtdInputProps } from '~/features/mtd/mtdFormStyles'
import {
  collectLettingAgents,
  formatLandlordStatementDetails,
  getDefaultMonthEndDate,
  parseLandlordStatementAmounts,
  parseLandlordStatementTransaction,
} from '~/features/bankAccounts/utils/landlordStatement'
import { formatAmountInputValue } from '~/features/bankAccounts/utils/manualTransaction'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { Input } from '~/interface/forms/Input'
import { MtdDatePicker } from '~/interface/forms/MtdDatePicker'
import { uploadReceiptFileData } from '~/interface/upload/uploadFile'
import { LettingAgentField } from './LettingAgentField'
import { MtdActionButton } from './MtdActionButton'
import { SlideFromRightPanel } from './SlideFromRightPanel'
import { StatementPhotoAttachment } from './StatementPhotoAttachment'

import type { LandlordStatementDraft } from '~/features/mtd/receipt/scanLandlordStatement'
import type { MtdTransactionDto } from '~/features/bankAccounts/types'

type LandlordStatementEditScreenProps = {
  bankAccountId: string
  transaction?: MtdTransactionDto | null
  statementDraft?: LandlordStatementDraft | null
  accountTransactions?: MtdTransactionDto[]
  onClose: () => void
  onSaved?: (entry: { id: string }) => void
  embedded?: boolean
  hideAttachment?: boolean
  footer?: ReactNode
  aboveForm?: ReactNode
}

function LandlordStatementEditContent({
  bankAccountId,
  transaction,
  statementDraft = null,
  accountTransactions = [],
  onClose,
  onSaved,
  hideAttachment = false,
  footer = null,
  aboveForm = null,
}: LandlordStatementEditScreenProps) {
  const insets = useSafeAreaInsets()
  const { createManualTransaction, updateManualTransaction, deleteManualTransaction } =
    useManualTransaction()
  const { updateCategory, approveTransactions } = useUpdateTransactionCategory()
  const { learnFromSave } = useMerchantFingerprints()

  const agentSuggestions = useMemo(
    () => collectLettingAgents(accountTransactions),
    [accountTransactions],
  )

  const initial = useMemo(() => {
    if (!transaction) {
      return {
        date: statementDraft?.date?.trim() || getDefaultMonthEndDate(),
        lettingAgent: statementDraft?.lettingAgent ?? '',
        grossRents: statementDraft?.grossRents ?? '',
        expenses: statementDraft?.expenses ?? '',
        vatOnExpenses: statementDraft?.vatOnExpenses ?? '',
        attachmentUrl: statementDraft?.attachmentUrl ?? null,
        localPreview: statementDraft?.localImageUri ?? null,
        fileName: statementDraft?.fileName ?? null,
        mimeType: statementDraft?.mimeType ?? null,
      }
    }

    const parsed = parseLandlordStatementTransaction(transaction)
    return {
      date: transaction.dateIso,
      lettingAgent: parsed?.lettingAgent ?? '',
      grossRents: parsed ? formatAmountInputValue(parsed.grossRents) : '',
      expenses: parsed ? formatAmountInputValue(parsed.expenses) : '',
      vatOnExpenses: parsed ? formatAmountInputValue(parsed.vatOnExpenses) : '',
      attachmentUrl: transaction.attachmentUrl ?? null,
      localPreview: null as string | null,
      fileName: null as string | null,
      mimeType: null as string | null,
    }
  }, [statementDraft, transaction])

  const [date, setDate] = useState(initial.date)
  const [lettingAgent, setLettingAgent] = useState(initial.lettingAgent)
  const [grossRents, setGrossRents] = useState(initial.grossRents)
  const [expenses, setExpenses] = useState(initial.expenses)
  const [vatOnExpenses, setVatOnExpenses] = useState(initial.vatOnExpenses)
  const [attachmentUrl, setAttachmentUrl] = useState(initial.attachmentUrl)
  const [localPreview, setLocalPreview] = useState(initial.localPreview)
  const [attachmentFileName, setAttachmentFileName] = useState(initial.fileName)
  const [attachmentMimeType, setAttachmentMimeType] = useState(initial.mimeType)
  const [isAttachmentBusy, setIsAttachmentBusy] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const amounts = useMemo(
    () => parseLandlordStatementAmounts(grossRents, expenses, vatOnExpenses),
    [expenses, grossRents, vatOnExpenses],
  )
  const canSave =
    lettingAgent.trim().length > 0 &&
    date.trim().length > 0 &&
    amounts != null &&
    !isSaving &&
    !isDeleting &&
    !isAttachmentBusy

  const resolveAttachmentUrl = async () => {
    if (attachmentUrl) return attachmentUrl
    if (!localPreview) return null

    const file = await prepareReceiptImageForUpload({
      uri: localPreview,
      fileName: attachmentFileName,
      mimeType: attachmentMimeType ?? undefined,
    })
    const response = await uploadReceiptFileData(file, () => {}, {
      source: 'save_background',
    })
    return response.attachmentRef ?? response.url ?? null
  }

  const handleSave = async () => {
    if (!amounts || !canSave) return

    setIsSaving(true)
    setError(null)

    try {
      const resolvedAttachmentUrl = await resolveAttachmentUrl()
      if (localPreview && !resolvedAttachmentUrl) {
        throw new Error('Could not save statement photo. Try again.')
      }
      if (resolvedAttachmentUrl) {
        setAttachmentUrl(resolvedAttachmentUrl)
      }

      const payload = {
        name: lettingAgent.trim(),
        details: formatLandlordStatementDetails(
          amounts.grossRents,
          amounts.expenses,
          amounts.vatOnExpenses,
        ),
        date: date.trim(),
        amount: amounts.grossRents,
        attachmentUrl: resolvedAttachmentUrl,
      }

      const saved = transaction
        ? await updateManualTransaction({ id: transaction.id, ...payload })
        : await createManualTransaction({ bankAccountId, ...payload })

      const hmrcCategory = getHmrcCategoryForEditCategory('income')
      await updateCategory(saved.id, hmrcCategory, { notify: false })
      if (!transaction || transaction.needsReview) {
        await approveTransactions([saved.id])
      }

      const savedAgent = lettingAgent.trim()
      if (statementDraft?.ocrText?.trim() && savedAgent) {
        try {
          await learnFromSave({
            canonicalName: savedAgent,
            processKind: 'landlord',
            sourceSuggestedName: statementDraft.lettingAgent || null,
            ocrText: statementDraft.ocrText,
          })
        } catch (learnError) {
          console.info('[merchant-fingerprint] landlord learn failed', learnError)
        }
      }

      onSaved?.({ id: saved.id })
      onClose()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Failed to save landlord statement',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!transaction || isDeleting || isSaving) return

    const confirmed = await dialogConfirm({
      title: 'Delete landlord statement?',
      description: 'This permanently removes the statement. This cannot be undone.',
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
          : 'Failed to delete landlord statement',
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
              Landlord statement
            </SizableText>
            <YStack gap="$3">
              <YStack gap="$1.5">
                <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                  Month End Date
                </SizableText>
                <MtdDatePicker value={date} onChange={setDate} />
              </YStack>

              <LettingAgentField
                value={lettingAgent}
                onChange={setLettingAgent}
                suggestions={agentSuggestions}
                autoFocus={!transaction && !statementDraft?.lettingAgent}
              />

              <YStack gap="$1.5">
                <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                  Gross Rents
                </SizableText>
                <Input
                  value={grossRents}
                  onChangeText={setGrossRents}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  {...mtdInputProps}
                />
              </YStack>

              <XStack gap="$3" flexWrap="wrap">
                <YStack gap="$1.5" flex={1} minW={140}>
                  <SizableText
                    fontSize={13}
                    fontWeight="500"
                    color={MTD_TOKENS.textMuted}
                  >
                    Expenses
                  </SizableText>
                  <Input
                    value={expenses}
                    onChangeText={setExpenses}
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
                    VAT on expenses
                  </SizableText>
                  <Input
                    value={vatOnExpenses}
                    onChangeText={setVatOnExpenses}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    {...mtdInputProps}
                  />
                </YStack>
              </XStack>

              <YStack gap="$1.5">
                <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                  Net Received
                </SizableText>
                <XStack width="100%" items="center" opacity={0.85} {...mtdFieldChrome}>
                  <SizableText
                    fontSize={15}
                    color={amounts ? MTD_TOKENS.text : MTD_TOKENS.textMuted}
                    lineHeight={20}
                  >
                    {amounts ? formatAmountInputValue(amounts.netReceived) : '0.00'}
                  </SizableText>
                </XStack>
              </YStack>

              {hideAttachment ? null : (
                <StatementPhotoAttachment
                  attachmentUrl={attachmentUrl}
                  initialLocalPreview={localPreview}
                  initialFileName={attachmentFileName}
                  initialMimeType={attachmentMimeType}
                  onChange={setAttachmentUrl}
                  onLocalPreviewChange={(uri) => {
                    setLocalPreview(uri)
                    if (!uri) {
                      setAttachmentFileName(null)
                      setAttachmentMimeType(null)
                    }
                  }}
                  onBusyChange={setIsAttachmentBusy}
                />
              )}
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
              disabled={isSaving || isDeleting || isAttachmentBusy}
              loading={isDeleting}
              onPress={() => void handleDelete()}
            >
              Delete statement
            </MtdActionButton>
          ) : null}

          {footer}
        </YStack>
      </RNScrollView>
    </YStack>
  )
}

export function LandlordStatementEditScreen({
  bankAccountId,
  transaction,
  statementDraft,
  accountTransactions,
  onClose,
  onSaved,
  embedded = false,
  hideAttachment = false,
  footer = null,
  aboveForm = null,
}: LandlordStatementEditScreenProps) {
  if (embedded) {
    return (
      <LandlordStatementEditContent
        bankAccountId={bankAccountId}
        transaction={transaction}
        statementDraft={statementDraft}
        accountTransactions={accountTransactions}
        onClose={onClose}
        onSaved={onSaved}
        hideAttachment={hideAttachment}
        footer={footer}
        aboveForm={aboveForm}
      />
    )
  }

  return (
    <SlideFromRightPanel onClose={onClose}>
      {(requestClose) => (
        <LandlordStatementEditContent
          bankAccountId={bankAccountId}
          transaction={transaction}
          statementDraft={statementDraft}
          accountTransactions={accountTransactions}
          onClose={requestClose}
          onSaved={onSaved}
          hideAttachment={hideAttachment}
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
