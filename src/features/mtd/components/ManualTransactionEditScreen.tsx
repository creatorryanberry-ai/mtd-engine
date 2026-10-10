import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  StyleSheet,
  type View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { useManualTransaction } from '~/features/categorisation/client/useManualTransaction'
import { useCategorisationRules } from '~/features/categorisation/client/useCategorisationRules'
import { useUpdateTransactionCategory } from '~/features/categorisation/client/useUpdateTransactionCategory'
import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import { notifyMtdTransactionsChanged } from '~/features/bankAccounts/client/mtdTransactionsEmitter'
import { useSubmissionPeriod } from '~/features/mtd/context/TaxYearProvider'
import {
  getEditCategoryIdForHmrc,
  getPrivateUseStateFromRulePercent,
  resolveBusinessExpenseHmrcCategory,
  type TransactionEditCategoryId,
} from '~/features/mtd/categories/transactionEditCategories'
import { suggestPrivateUse } from '~/features/mtd/categories/privateUseSuggestions'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { mtdInputProps } from '~/features/mtd/mtdFormStyles'
import { getQuarterInfo } from '~/features/mtd/utils/quarterPeriods'
import {
  resolveManualEntryDate,
  type ResolveManualEntryDatePresenter,
} from '~/features/mtd/utils/resolveManualEntryDate'
import {
  getActivePrivateUsePercent,
  isPrivateUseValid,
  PrivateUseRow,
} from './PrivateUseRow'
import { PrivateUseNameHint } from './PrivateUseNameHint'
import { PrivateUseHintArrow } from './PrivateUseHintArrow'
import {
  formatAmountInputValue,
  getSignedAmountForCategory,
  joinMerchantName,
  parseAmountInput,
  parseManualTransactionFields,
} from '~/features/bankAccounts/utils/manualTransaction'
import { type ManualReceiptDraft } from '~/features/mtd/receipt/scanReceipt'
import { useMerchantFingerprints } from '~/features/mtd/receipt/client/useMerchantFingerprints'
import { prepareReceiptImageForUpload } from '~/features/mtd/receipt/prepareReceiptImage'
import { uploadReceiptFileData } from '~/interface/upload/uploadFile'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { Input, type Input as InputElement } from '~/interface/forms/Input'
import { WarningIcon } from '~/interface/icons/phosphor/WarningIcon'
import { MtdDatePicker } from '~/interface/forms/MtdDatePicker'
import { showToast } from '~/interface/toast/helpers'
import { MtdActionButton } from './MtdActionButton'
import { ReceiptPhotoPreview } from './ReceiptPhotoPreview'
import { SlideFromRightPanel } from './SlideFromRightPanel'
import { TransactionCategoryPicker } from './TransactionCategoryPicker'

import type { MtdTransactionDto } from '~/features/bankAccounts/types'

function getTodayIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type DatePromptState = {
  title: string
  description: string
  confirmText: string
  cancelText: string | null
}

function DatePromptDialog({
  state,
  onResolve,
}: {
  state: DatePromptState | null
  onResolve: (accepted: boolean) => void
}) {
  if (!state) return null

  return (
    <YStack
      position="absolute"
      t={0}
      r={0}
      b={0}
      l={0}
      z={1000}
      items="center"
      justify="center"
      pointerEvents="box-none"
    >
      <RNPressable
        style={StyleSheet.absoluteFillObject}
        onPress={() => onResolve(false)}
      />
      <YStack
        pointerEvents="auto"
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$5"
        px="$4"
        py="$4"
        mx="$4"
        maxW={420}
        width="100%"
        gap="$3"
        items="center"
      >
        <SizableText fontSize={18} fontWeight="600" color={MTD_TOKENS.text} text="center">
          {state.title}
        </SizableText>
        <SizableText
          fontSize={14}
          color={MTD_TOKENS.textMuted}
          lineHeight={24}
          text="center"
        >
          {state.description}
        </SizableText>
        <YStack mt={14} mb={20} items="center">
          <WarningIcon size={88} color={MTD_TOKENS.orange} />
        </YStack>
        <XStack gap="$3" width="100%">
          {state.cancelText ? (
            <MtdActionButton
              variant="secondary"
              flex={1}
              onPress={() => onResolve(false)}
            >
              {state.cancelText}
            </MtdActionButton>
          ) : null}
          <MtdActionButton variant="primary" flex={1} onPress={() => onResolve(true)}>
            {state.confirmText}
          </MtdActionButton>
        </XStack>
      </YStack>
    </YStack>
  )
}

type ManualTransactionEditScreenProps = {
  bankAccountId: string
  transaction?: MtdTransactionDto | null
  initialCategory?: TransactionEditCategoryId | null
  allowedCategoryIds?: TransactionEditCategoryId[]
  receiptDraft?: ManualReceiptDraft | null
  onClose: () => void
  onSaved?: (entry: { id: string; label: string; amount: number }) => void
  onDeleted?: (transactionId: string) => void
  embedded?: boolean
  hideReceiptPreview?: boolean
  hideCategoryPicker?: boolean
  footer?: ReactNode
  aboveForm?: ReactNode
}

function ManualTransactionEditContent({
  bankAccountId,
  transaction,
  initialCategory = null,
  allowedCategoryIds,
  receiptDraft = null,
  onClose,
  onSaved,
  onDeleted,
  embedded = false,
  hideReceiptPreview = false,
  hideCategoryPicker = false,
  footer = null,
  aboveForm = null,
}: ManualTransactionEditScreenProps) {
  const insets = useSafeAreaInsets()
  const { taxYearStart, quarterId } = useSubmissionPeriod()
  const currentQuarter = useMemo(
    () => getQuarterInfo(quarterId, taxYearStart),
    [quarterId, taxYearStart],
  )
  const { createManualTransaction, updateManualTransaction, deleteManualTransaction } =
    useManualTransaction()
  const { createRule } = useCategorisationRules()
  const { learnFromSave } = useMerchantFingerprints()
  const { updateCategory, approveTransactions } = useUpdateTransactionCategory()
  const { settings } = useBusinessSettings()
  const includeVehiclePrivateUse = settings?.vehicleClaimMethod !== 'mileage'

  const initialFields = useMemo(() => {
    if (receiptDraft) {
      return {
        name: receiptDraft.name,
        details: receiptDraft.details || '',
        date: receiptDraft.date || getTodayIsoDate(),
        amount: receiptDraft.amount || '',
        attachmentUrl: receiptDraft.attachmentUrl,
        localImageUri: receiptDraft.localImageUri,
        fileName: receiptDraft.fileName ?? null,
        mimeType: receiptDraft.mimeType ?? null,
        category: (initialCategory ?? 'business_expense') as TransactionEditCategoryId,
      }
    }

    if (!transaction) {
      return {
        name: '',
        details: '',
        date: getTodayIsoDate(),
        amount: '',
        attachmentUrl: null as string | null,
        localImageUri: null as string | null,
        fileName: null as string | null,
        mimeType: null as string | null,
        category: initialCategory,
      }
    }

    const { name, memo } = parseManualTransactionFields(transaction.merchant)
    return {
      name,
      details: memo ?? '',
      date: transaction.dateIso,
      amount: formatAmountInputValue(transaction.amount),
      attachmentUrl: transaction.attachmentUrl ?? null,
      localImageUri: null as string | null,
      fileName: null as string | null,
      mimeType: null as string | null,
      category: getEditCategoryIdForHmrc(transaction.hmrcCategory),
    }
  }, [transaction, receiptDraft, initialCategory])

  const [name, setName] = useState(initialFields.name)
  const [details, setDetails] = useState(initialFields.details)
  const [date, setDate] = useState(initialFields.date)
  const [amount, setAmount] = useState(initialFields.amount)
  const [selectedCategory, setSelectedCategory] =
    useState<TransactionEditCategoryId | null>(initialFields.category)
  const [hasPrivateUse, setHasPrivateUse] = useState(() => {
    if (transaction) {
      if (getEditCategoryIdForHmrc(transaction.hmrcCategory) !== 'business_expense') {
        return false
      }
      return getPrivateUseStateFromRulePercent(transaction.privateUsePercent)
        .hasPrivateUse
    }
    if (
      initialFields.category === 'business_expense' &&
      receiptDraft?.privateUsePercent != null
    ) {
      return getPrivateUseStateFromRulePercent(receiptDraft.privateUsePercent)
        .hasPrivateUse
    }
    return false
  })
  const [privateUsePercent, setPrivateUsePercent] = useState(() => {
    if (transaction) {
      if (getEditCategoryIdForHmrc(transaction.hmrcCategory) !== 'business_expense') {
        return ''
      }
      return getPrivateUseStateFromRulePercent(transaction.privateUsePercent)
        .privateUsePercent
    }
    if (
      initialFields.category === 'business_expense' &&
      receiptDraft?.privateUsePercent != null
    ) {
      return getPrivateUseStateFromRulePercent(receiptDraft.privateUsePercent)
        .privateUsePercent
    }
    return ''
  })
  const [transactionId, setTransactionId] = useState(transaction?.id ?? null)
  const [attachmentUrl, setAttachmentUrl] = useState(initialFields.attachmentUrl)
  const [localImageUri, setLocalImageUri] = useState(initialFields.localImageUri)
  const [attachmentFileName, setAttachmentFileName] = useState(initialFields.fileName)
  const [attachmentMimeType, setAttachmentMimeType] = useState(initialFields.mimeType)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suppressPrivateUseHint, setSuppressPrivateUseHint] = useState(false)
  const hintSuppressCountRef = useRef(0)

  const beginHintSuppress = () => {
    hintSuppressCountRef.current += 1
    setSuppressPrivateUseHint(true)
  }

  const endHintSuppress = () => {
    hintSuppressCountRef.current = Math.max(0, hintSuppressCountRef.current - 1)
    if (hintSuppressCountRef.current === 0) {
      setSuppressPrivateUseHint(false)
    }
  }
  const nameInputRef = useRef<InputElement | null>(null)
  const formContainerRef = useRef<View | null>(null)
  const hintOriginRef = useRef<View | null>(null)
  const hintBoxRef = useRef<View | null>(null)
  const yesButtonRef = useRef<View | null>(null)
  const datePromptResolverRef = useRef<((accepted: boolean) => void) | null>(null)
  const [datePrompt, setDatePrompt] = useState<DatePromptState | null>(null)
  const isCreate = !transaction

  const datePromptPresenter = useMemo<ResolveManualEntryDatePresenter>(
    () => ({
      alert: (title, description) =>
        new Promise<void>((resolve) => {
          datePromptResolverRef.current = () => resolve()
          setDatePrompt({
            title,
            description,
            confirmText: 'OK',
            cancelText: null,
          })
        }),
      confirm: (title, description, confirmText) =>
        new Promise<boolean>((resolve) => {
          datePromptResolverRef.current = (accepted) => resolve(accepted)
          setDatePrompt({
            title,
            description,
            confirmText,
            cancelText: 'Cancel',
          })
        }),
    }),
    [],
  )

  useEffect(() => {
    if (!isCreate || receiptDraft) return

    const timer = setTimeout(() => {
      nameInputRef.current?.focus()
    }, 50)

    return () => clearTimeout(timer)
  }, [isCreate, receiptDraft])

  const parsedAmount = parseAmountInput(amount)
  const privateUseIsValid = isPrivateUseValid(
    selectedCategory,
    hasPrivateUse,
    privateUsePercent,
  )
  const activePrivateUsePercent = getActivePrivateUsePercent(
    selectedCategory,
    hasPrivateUse,
    privateUsePercent,
  )
  const privateUseSuggestion = useMemo(() => {
    if (selectedCategory !== 'business_expense') return null
    return suggestPrivateUse(joinMerchantName(name, details.trim() || null), {
      includeVehicle: includeVehiclePrivateUse,
    })
  }, [details, includeVehiclePrivateUse, name, selectedCategory])
  const showPrivateUseHint =
    privateUseSuggestion != null &&
    !hasPrivateUse &&
    selectedCategory === 'business_expense' &&
    !suppressPrivateUseHint
  // don't block save on photo upload — attachment is best-effort
  const canSave =
    name.trim().length > 0 &&
    date.trim().length > 0 &&
    parsedAmount != null &&
    selectedCategory != null &&
    !isSaving &&
    !isDeleting &&
    privateUseIsValid

  const handleCategoryChange = (categoryId: TransactionEditCategoryId) => {
    setSelectedCategory(categoryId)
    if (categoryId !== 'business_expense') {
      setHasPrivateUse(false)
      setPrivateUsePercent('')
    }
  }

  const handleRemoveReceipt = () => {
    setLocalImageUri(null)
    setAttachmentUrl(null)
    setAttachmentFileName(null)
    setAttachmentMimeType(null)
  }

  const handleDelete = async () => {
    if (!transaction || isDeleting || isSaving) return

    const confirmed = await dialogConfirm({
      title: 'Delete transaction?',
      description: 'This permanently removes the transaction. This cannot be undone.',
    })
    if (!confirmed) return

    setIsDeleting(true)
    setError(null)

    try {
      await deleteManualTransaction(transaction.id)
      onDeleted?.(transaction.id)
      onClose()
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : 'Failed to delete transaction',
      )
    } finally {
      setIsDeleting(false)
    }
  }

  const persistTransaction = async (
    resolvedAttachmentUrl: string | null,
    dateIso = date.trim(),
  ) => {
    if (parsedAmount == null || !selectedCategory) {
      throw new Error('Name, date, amount, and category are required')
    }

    const signedAmount = getSignedAmountForCategory(parsedAmount, selectedCategory)
    const hmrcCategory = resolveBusinessExpenseHmrcCategory({
      selectedCategory,
      existingHmrcCategory: transaction?.hmrcCategory,
      preferredHmrcCategory:
        activePrivateUsePercent != null
          ? privateUseSuggestion?.preferredHmrcCategory
          : null,
    })
    const payload = {
      name: name.trim(),
      details: details.trim() || null,
      date: dateIso,
      amount: signedAmount,
      attachmentUrl: resolvedAttachmentUrl,
    }
    // defer list refresh until private-use rule is written
    const mutationOptions = { notify: false as const }

    if (transactionId) {
      return updateManualTransaction(
        {
          id: transactionId,
          ...payload,
        },
        mutationOptions,
      )
    }

    const created = await createManualTransaction(
      {
        bankAccountId,
        ...payload,
        hmrcCategory,
      },
      mutationOptions,
    )
    setTransactionId(created.id)
    return created
  }

  const attachReceiptInBackground = (
    saved: MtdTransactionDto,
    imageUri: string,
    savedName: string,
    savedDetails: string | null,
  ) => {
    void (async () => {
      try {
        console.info('[receipt-scan] background upload start', {
          id: saved.id,
          uriPrefix: imageUri.slice(0, 48),
        })
        const file = await prepareReceiptImageForUpload({
          uri: imageUri,
          fileName: attachmentFileName,
          mimeType: attachmentMimeType ?? undefined,
        })
        const response = await uploadReceiptFileData(file, () => {}, {
          source: 'save_background',
        })
        const ref = response.attachmentRef ?? response.url ?? null
        if (!ref) {
          console.info('[receipt-scan] background upload empty response', response)
          return
        }
        await updateManualTransaction({
          id: saved.id,
          name: savedName,
          details: savedDetails,
          date: saved.dateIso,
          amount: saved.amount,
          attachmentUrl: ref,
        })
        console.info('[receipt-scan] background upload attached', { id: saved.id })
      } catch (uploadError) {
        // already reported inside uploadReceiptFileData
        console.info('[receipt-scan] attachment upload failed', uploadError)
        showToast('Receipt photo not saved', {
          type: 'error',
          message:
            uploadError instanceof Error
              ? uploadError.message
              : 'Try editing the transaction and attaching again.',
        })
      }
    })()
  }

  const handleSave = async () => {
    if (!selectedCategory || !canSave) {
      console.info('[manual-tx] save blocked', {
        hasCategory: selectedCategory != null,
        name: name.trim().length,
        date: date.trim(),
        amount,
        parsedAmount,
        privateUseIsValid,
      })
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const dateCheck = await resolveManualEntryDate(
        date.trim(),
        currentQuarter,
        datePromptPresenter,
        {
          skipOutsideQuarterPromptIfUnchangedFrom: transaction?.dateIso ?? null,
        },
      )
      if (!dateCheck.ok) {
        return
      }
      if (dateCheck.date !== date.trim()) {
        setDate(dateCheck.date)
      }

      console.info('[manual-tx] saving', {
        bankAccountId,
        name: name.trim(),
        date: dateCheck.date,
        amount: parsedAmount,
        category: selectedCategory,
        hasAttachment: Boolean(attachmentUrl),
        hasLocalImage: Boolean(localImageUri),
      })

      // never wait on photo upload — it often hangs on device and blocked save
      const saved = await persistTransaction(attachmentUrl, dateCheck.date)
      console.info('[manual-tx] saved', saved.id)

      const hmrcCategory = resolveBusinessExpenseHmrcCategory({
        selectedCategory,
        existingHmrcCategory: transaction?.hmrcCategory ?? saved.hmrcCategory,
        preferredHmrcCategory:
          activePrivateUsePercent != null
            ? privateUseSuggestion?.preferredHmrcCategory
            : null,
      })
      const savedName = name.trim()
      const savedDetails = details.trim() || null
      const shouldPersistPrivateUse =
        selectedCategory === 'business_expense' &&
        (activePrivateUsePercent != null || transaction?.privateUsePercent != null)

      if (saved.hmrcCategory !== hmrcCategory) {
        await updateCategory(saved.id, hmrcCategory, { notify: false })
      }

      // private use lives on the categorisation rule — must succeed before list refresh
      if (shouldPersistPrivateUse) {
        await createRule({
          matchValue: joinMerchantName(savedName, savedDetails),
          hmrcCategory,
          upsert: true,
          bankAccountIds: [bankAccountId],
          privateUsePercent: activePrivateUsePercent,
        })
      }

      if (saved.needsReview) {
        await approveTransactions([saved.id])
      } else if (!shouldPersistPrivateUse) {
        // createRule already notifies when private use was saved
        notifyMtdTransactionsChanged()
      }

      if (!attachmentUrl && localImageUri) {
        attachReceiptInBackground(saved, localImageUri, savedName, savedDetails)
      }

      // learn merchant fingerprints only when the user corrected the suggestion
      const suggestedName = (
        receiptDraft?.suggestedName ??
        receiptDraft?.name ??
        ''
      ).trim()
      const processKind = receiptDraft?.documentKind
      const shouldLearnMerchant =
        Boolean(receiptDraft?.ocrText?.trim()) &&
        savedName.length > 0 &&
        savedName.toLowerCase() !== suggestedName.toLowerCase()

      if (shouldLearnMerchant && receiptDraft?.ocrText && processKind) {
        try {
          const learnedPrivateUse =
            selectedCategory === 'business_expense' ? activePrivateUsePercent : null
          const learned = await learnFromSave({
            canonicalName: savedName,
            processKind,
            sourceSuggestedName: suggestedName || null,
            privateUsePercent: learnedPrivateUse,
            ocrText: receiptDraft.ocrText,
          })
          console.info('[merchant-fingerprint] learned', {
            canonicalName: savedName,
            processKind,
            privateUsePercent: learnedPrivateUse,
            suggestedName,
            signals: learned.length,
          })
        } catch (learnError) {
          console.info('[merchant-fingerprint] learn failed', learnError)
        }
      } else {
        console.info('[merchant-fingerprint] skip learn', {
          hasOcr: Boolean(receiptDraft?.ocrText?.trim()),
          processKind: processKind ?? null,
          suggestedName,
          savedName,
        })
      }

      onSaved?.({
        id: saved.id,
        label: savedName || 'Manual entry',
        amount: Math.abs(saved.amount),
      })
    } catch (saveError) {
      console.info('[manual-tx] save failed', saveError)
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save transaction',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const receiptPreviewUri =
    localImageUri ||
    (attachmentUrl && !attachmentUrl.startsWith('mtd-receipt:') ? attachmentUrl : null)

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

          {aboveForm}

          <YStack gap="$2.5">
            <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.textMuted}>
              Transaction
            </SizableText>
            <YStack gap="$3">
              <YStack gap="$1.5">
                <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                  Name
                </SizableText>
                <Input
                  ref={nameInputRef}
                  value={name}
                  onChangeText={setName}
                  placeholder="Transaction name"
                  autoCapitalize="words"
                  {...mtdInputProps}
                />
                {receiptDraft?.nameNeedsConfirm ? (
                  <SizableText fontSize={12} color={MTD_TOKENS.orange}>
                    Check this is the Bill To customer on the invoice.
                  </SizableText>
                ) : null}
                {showPrivateUseHint && privateUseSuggestion ? (
                  <PrivateUseNameHint
                    originRef={hintOriginRef}
                    boxRef={hintBoxRef}
                    suggestion={privateUseSuggestion}
                  />
                ) : null}
              </YStack>

              <YStack gap="$1.5">
                <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
                  Details
                </SizableText>
                <Input
                  value={details}
                  onChangeText={setDetails}
                  placeholder="Optional details"
                  onFocus={beginHintSuppress}
                  onBlur={endHintSuppress}
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
                    Date
                  </SizableText>
                  <MtdDatePicker
                    value={date}
                    onChange={setDate}
                    placeholder="DD/MM/YYYY"
                    onOpen={beginHintSuppress}
                    onClose={endHintSuppress}
                  />
                </YStack>

                <YStack gap="$1.5" flex={1} minW={140}>
                  <SizableText
                    fontSize={13}
                    fontWeight="500"
                    color={MTD_TOKENS.textMuted}
                  >
                    Amount
                  </SizableText>
                  <Input
                    value={amount}
                    onChangeText={setAmount}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    onFocus={beginHintSuppress}
                    onBlur={endHintSuppress}
                    {...mtdInputProps}
                  />
                </YStack>
              </XStack>
            </YStack>
          </YStack>

          {hideCategoryPicker ? (
            selectedCategory === 'business_expense' ? (
              <PrivateUseRow
                hasPrivateUse={hasPrivateUse}
                onHasPrivateUseChange={setHasPrivateUse}
                privateUsePercent={privateUsePercent}
                onPrivateUsePercentChange={setPrivateUsePercent}
                suggestion={privateUseSuggestion}
                yesButtonRef={yesButtonRef}
                inset={false}
              />
            ) : null
          ) : (
            <TransactionCategoryPicker
              selectedCategory={selectedCategory}
              onSelectCategory={handleCategoryChange}
              allowedCategoryIds={allowedCategoryIds}
              hasPrivateUse={hasPrivateUse}
              onHasPrivateUseChange={setHasPrivateUse}
              privateUsePercent={privateUsePercent}
              onPrivateUsePercentChange={setPrivateUsePercent}
              privateUseSuggestion={privateUseSuggestion}
              yesButtonRef={yesButtonRef}
            />
          )}

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
              Delete transaction
            </MtdActionButton>
          ) : null}

          {hideReceiptPreview ? null : (
            <ReceiptPhotoPreview
              imageUri={receiptPreviewUri}
              fileName={attachmentFileName}
              mimeType={attachmentMimeType}
              photoLabel={selectedCategory === 'income' ? 'Invoice' : 'Receipt'}
              onRemove={handleRemoveReceipt}
            />
          )}

          {footer}
        </YStack>
      </RNScrollView>

      <DatePromptDialog
        state={datePrompt}
        onResolve={(accepted) => {
          const resolve = datePromptResolverRef.current
          datePromptResolverRef.current = null
          setDatePrompt(null)
          resolve?.(accepted)
        }}
      />
    </YStack>
  )
}

export function ManualTransactionEditScreen({
  bankAccountId,
  transaction,
  initialCategory = null,
  allowedCategoryIds,
  receiptDraft = null,
  onClose,
  onSaved,
  onDeleted,
  embedded = false,
  hideReceiptPreview = false,
  hideCategoryPicker = false,
  footer = null,
  aboveForm = null,
}: ManualTransactionEditScreenProps) {
  const content = (
    <ManualTransactionEditContent
      bankAccountId={bankAccountId}
      transaction={transaction}
      initialCategory={initialCategory}
      allowedCategoryIds={allowedCategoryIds}
      receiptDraft={receiptDraft}
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
      embedded={embedded}
      hideReceiptPreview={hideReceiptPreview}
      hideCategoryPicker={hideCategoryPicker}
      footer={footer}
      aboveForm={aboveForm}
    />
  )

  if (embedded) return content

  return (
    <SlideFromRightPanel onClose={onClose}>
      {(requestClose) => (
        <ManualTransactionEditContent
          bankAccountId={bankAccountId}
          transaction={transaction}
          initialCategory={initialCategory}
          allowedCategoryIds={allowedCategoryIds}
          receiptDraft={receiptDraft}
          embedded={embedded}
          hideReceiptPreview={hideReceiptPreview}
          hideCategoryPicker={hideCategoryPicker}
          footer={footer}
          aboveForm={aboveForm}
          onClose={requestClose}
          onSaved={(entry) => {
            onSaved?.(entry)
            // unmount immediately — don't wait on slide animation (can hang on device)
            onClose()
          }}
          onDeleted={(id) => {
            onDeleted?.(id)
            onClose()
          }}
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
