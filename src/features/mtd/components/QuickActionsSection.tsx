import { useCallback, useMemo, useState } from 'react'
import { router, type Href } from 'one'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { useMtdBankAccounts } from '~/features/bankAccounts/client/useMtdBankAccounts'
import { SYSTEM_ACCOUNT_IDS } from '~/features/bankAccounts/defaultBankAccounts'
import { useSubmissionPeriod } from '~/features/mtd/context/TaxYearProvider'
import {
  scanReceiptWithPicker,
  type ManualReceiptDraft,
} from '~/features/mtd/receipt/scanReceipt'
import { useMerchantFingerprints } from '~/features/mtd/receipt/client/useMerchantFingerprints'
import { MTD_ROUTES } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { getQuarterInfo } from '~/features/mtd/utils/quarterPeriods'
import { resolveManualEntryDate } from '~/features/mtd/utils/resolveManualEntryDate'
import { openQuickAdd } from '~/features/mtd/quickAddEmitter'
import { CameraIcon } from '~/interface/icons/phosphor/CameraIcon'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'
import { ManualTransactionEditScreen } from './ManualTransactionEditScreen'
import { MtdActionButton } from './MtdActionButton'
import { ReceiptScanningPopup } from './ReceiptScanningPopup'

function findManualEntryAccountId(accounts: { id: string; externalAccountId: string }[]) {
  return (
    accounts.find(
      (account) => account.externalAccountId === SYSTEM_ACCOUNT_IDS.manualEntry,
    )?.id ?? null
  )
}

export function QuickActionsSection() {
  const { accounts } = useMtdBankAccounts()
  const manualAccountId = useMemo(() => findManualEntryAccountId(accounts), [accounts])
  const { taxYearStart, quarterId } = useSubmissionPeriod()
  const currentQuarter = useMemo(
    () => getQuarterInfo(quarterId, taxYearStart),
    [quarterId, taxYearStart],
  )

  const [receiptDraft, setReceiptDraft] = useState<ManualReceiptDraft | null>(null)
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [manualMode, setManualMode] = useState<'receipt' | 'income'>('receipt')
  const [receiptScanBusy, setReceiptScanBusy] = useState(false)
  const [isScanningReceipt, setIsScanningReceipt] = useState(false)
  const { asResolverInput } = useMerchantFingerprints()

  const openReceiptScan = useCallback(async () => {
    if (!manualAccountId || receiptScanBusy) return
    setReceiptScanBusy(true)
    try {
      const draft = await scanReceiptWithPicker(isWeb ? 'library' : 'camera', {
        onScanning: () => setIsScanningReceipt(true),
        onScanningDone: () => setIsScanningReceipt(false),
        userFingerprints: asResolverInput(),
      })
      if (!draft) return

      if (draft.date) {
        const dateCheck = await resolveManualEntryDate(draft.date, currentQuarter)
        if (!dateCheck.ok) return
        draft.date = dateCheck.date
      }

      setReceiptDraft(draft)
      setManualMode('receipt')
      setShowManualEntry(true)
    } catch (error) {
      console.info('[quick-actions] receipt scan failed', error)
    } finally {
      setIsScanningReceipt(false)
      setReceiptScanBusy(false)
    }
  }, [asResolverInput, currentQuarter, manualAccountId, receiptScanBusy])

  const openIncome = useCallback(() => {
    if (!manualAccountId) {
      openQuickAdd()
      return
    }
    setReceiptDraft(null)
    setManualMode('income')
    setShowManualEntry(true)
  }, [manualAccountId])

  const closeManualEntry = useCallback(() => {
    setShowManualEntry(false)
    setReceiptDraft(null)
  }, [])

  const handleSaved = useCallback(() => {
    if (!manualAccountId) return
    router.push(`${MTD_ROUTES.bankAccounts}/${manualAccountId}/categorise` as Href)
  }, [manualAccountId])

  const receiptDisabled = !manualAccountId || receiptScanBusy

  return (
    <>
      <YStack gap="$3" width="100%">
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          Quick actions
        </SizableText>

        <XStack gap="$2" width="100%">
          <MtdActionButton
            flex={1}
            size="large"
            variant="secondary"
            disabled={receiptDisabled}
            loading={receiptScanBusy}
            icon={<CameraIcon size={18} color={MTD_TOKENS.text} />}
            onPress={() => void openReceiptScan()}
          >
            Snap receipt
          </MtdActionButton>
          <MtdActionButton
            flex={1}
            size="large"
            variant="secondary"
            disabled={!manualAccountId}
            icon={<PlusIcon size={18} color={MTD_TOKENS.text} />}
            onPress={openIncome}
          >
            Add income
          </MtdActionButton>
        </XStack>
      </YStack>

      <ReceiptScanningPopup visible={isScanningReceipt} />

      {showManualEntry && manualAccountId ? (
        <ManualTransactionEditScreen
          key={`quick-action-${manualMode}-${receiptDraft?.localImageUri ?? 'manual'}`}
          bankAccountId={manualAccountId}
          initialCategory={manualMode === 'income' ? 'income' : 'business_expense'}
          allowedCategoryIds={[manualMode === 'income' ? 'income' : 'business_expense']}
          receiptDraft={receiptDraft}
          onClose={closeManualEntry}
          onSaved={handleSaved}
        />
      ) : null}
    </>
  )
}
