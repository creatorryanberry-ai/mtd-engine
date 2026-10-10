import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { InteractionManager, Modal, Pressable, StyleSheet, View } from 'react-native'
import { router, type Href } from 'one'
import { useEmitterValue } from '@mtd/helpers'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import { useMileageEntries } from '~/features/mileage/client/useMileageEntries'
import { MileageEditScreen } from '~/features/mileage/components/MileageEditScreen'
import { useSubmissionPeriod } from '~/features/mtd/context/TaxYearProvider'
import {
  scanReceiptWithPicker,
  type ManualReceiptDraft,
  type ReceiptPickSource,
} from '~/features/mtd/receipt/scanReceipt'
import { useMerchantFingerprints } from '~/features/mtd/receipt/client/useMerchantFingerprints'
import { getQuarterInfo } from '~/features/mtd/utils/quarterPeriods'
import { resolveManualEntryDate } from '~/features/mtd/utils/resolveManualEntryDate'
import { MTD_ROUTES } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { setManualEntryListMode } from '~/features/mtd/manualEntryListMode'
import { closeQuickAdd, quickAddOpenEmitter } from '~/features/mtd/quickAddEmitter'
import { SYSTEM_ACCOUNT_IDS } from '~/features/bankAccounts/defaultBankAccounts'
import { useMtdBankAccounts } from '~/features/bankAccounts/client/useMtdBankAccounts'
import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'
import type { TransactionEditCategoryId } from '~/features/mtd/categories/transactionEditCategories'
import { CameraIcon } from '~/interface/icons/phosphor/CameraIcon'
import { CarIcon } from '~/interface/icons/phosphor/CarIcon'
import { FileIcon } from '~/interface/icons/phosphor/FileIcon'
import { ImageIcon } from '~/interface/icons/phosphor/ImageIcon'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'
import { ReceiptIcon } from '~/interface/icons/phosphor/ReceiptIcon'
import { XIcon } from '~/interface/icons/phosphor/XIcon'

import { CisVoucherEditScreen } from './CisVoucherEditScreen'
import { ManualTransactionEditScreen } from './ManualTransactionEditScreen'
import { ReceiptScanningPopup } from './ReceiptScanningPopup'

type QuickAddActionId =
  | 'snap-expense'
  | 'pic-expense'
  | 'file-expense'
  | 'snap-income'
  | 'pic-income'
  | 'file-income'
  | 'expense'
  | 'income'
  | 'mileage'
  | 'cis'

type PendingScan = {
  source: ReceiptPickSource
  category: TransactionEditCategoryId
}

type QuickAddItem = {
  id: QuickAddActionId
  title: string
  description: string
  icon: ReactNode
  hidden?: boolean
}

function findAccountId(
  accounts: { id: string; externalAccountId: string }[],
  externalAccountId: string,
) {
  return (
    accounts.find((account) => account.externalAccountId === externalAccountId)?.id ??
    null
  )
}

function QuickAddRow({
  title,
  description,
  icon,
  onPress,
  disabled,
}: {
  title: string
  description?: string
  icon: ReactNode
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <XStack items="center" gap="$3.5" px="$4" py="$3.5">
        <YStack width={28} items="center" justify="center" shrink={0}>
          {icon}
        </YStack>
        <YStack flex={1} gap="$0.5" minW={0}>
          <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
            {title}
          </SizableText>
          {description ? (
            <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
              {description}
            </SizableText>
          ) : null}
        </YStack>
      </XStack>
    </Pressable>
  )
}

function QuickAddGridCell({
  title,
  icon,
  onPress,
  disabled,
}: {
  title: string
  icon: ReactNode
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      })}
    >
      <YStack items="center" justify="center" gap="$2" px="$2" py="$3.5" minH={84}>
        <YStack width={28} height={28} items="center" justify="center">
          {icon}
        </YStack>
        <SizableText
          fontSize={14}
          fontWeight="600"
          color={MTD_TOKENS.text}
          text="center"
          numberOfLines={2}
        >
          {title}
        </SizableText>
      </YStack>
    </Pressable>
  )
}

export function QuickAddSheet() {
  const open = useEmitterValue(quickAddOpenEmitter)
  const insets = useSafeAreaInsets()
  const { accounts } = useMtdBankAccounts()
  const { settings } = useBusinessSettings()
  const { entries: mileageEntries, refresh: refreshMileage } = useMileageEntries()
  const { taxYearStart, quarterId } = useSubmissionPeriod()
  const currentQuarter = useMemo(
    () => getQuarterInfo(quarterId, taxYearStart),
    [quarterId, taxYearStart],
  )

  const manualAccountId = useMemo(
    () => findAccountId(accounts, SYSTEM_ACCOUNT_IDS.manualEntry),
    [accounts],
  )
  const cisAccountId = useMemo(
    () => findAccountId(accounts, SYSTEM_ACCOUNT_IDS.cis),
    [accounts],
  )

  const showMileage = settings?.vehicleClaimMethod === 'mileage'
  const showCis = settings?.cisRegistered === true && Boolean(cisAccountId)

  const [receiptDraft, setReceiptDraft] = useState<ManualReceiptDraft | null>(null)
  const [manualCategory, setManualCategory] = useState<TransactionEditCategoryId | null>(
    null,
  )
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [showCisEntry, setShowCisEntry] = useState(false)
  const [showMileageEntry, setShowMileageEntry] = useState(false)
  const [receiptScanBusy, setReceiptScanBusy] = useState(false)
  const [isScanningReceipt, setIsScanningReceipt] = useState(false)
  const pendingScanRef = useRef<PendingScan | null>(null)
  const { asResolverInput } = useMerchantFingerprints()

  const iconColor = MTD_TOKENS.text

  const items: QuickAddItem[] = [
    {
      id: 'snap-expense',
      title: 'Snap expense',
      description: 'Take a photo of your receipt',
      icon: <CameraIcon size={22} color={iconColor} />,
      hidden: isWeb,
    },
    {
      id: 'pic-expense',
      title: 'Pic expense',
      description: 'Choose a photo of your receipt',
      icon: <ImageIcon size={22} color={iconColor} />,
    },
    {
      id: 'file-expense',
      title: 'File expense',
      description: 'Choose a PDF or image from Files',
      icon: <FileIcon size={22} color={iconColor} />,
    },
    {
      id: 'snap-income',
      title: 'Snap income',
      description: 'Take a photo of an invoice',
      icon: <CameraIcon size={22} color={iconColor} />,
      hidden: isWeb,
    },
    {
      id: 'pic-income',
      title: 'Pic income',
      description: 'Choose a photo of an invoice',
      icon: <ImageIcon size={22} color={iconColor} />,
    },
    {
      id: 'file-income',
      title: 'File income',
      description: 'Choose a PDF or image from Files',
      icon: <FileIcon size={22} color={iconColor} />,
    },
    {
      id: 'expense',
      title: 'Add expense',
      description: 'Enter an expense manually',
      icon: <PlusIcon size={22} color={iconColor} />,
    },
    {
      id: 'income',
      title: 'Add income',
      description: 'Record money received',
      icon: <PlusIcon size={22} color={iconColor} />,
    },
    {
      id: 'mileage',
      title: 'Add mileage',
      description: 'Record a business journey',
      icon: <CarIcon size={22} color={iconColor} />,
      hidden: !showMileage,
    },
    {
      id: 'cis',
      title: 'Add CIS voucher',
      description: 'Take a photo of your voucher',
      icon: <ReceiptIcon size={22} color={iconColor} />,
      hidden: !showCis,
    },
  ]

  const closeSheet = useCallback(() => {
    closeQuickAdd()
  }, [])

  const runReceiptScan = useCallback(
    async (source: ReceiptPickSource, category: TransactionEditCategoryId) => {
      if (!manualAccountId || receiptScanBusy) return
      setReceiptScanBusy(true)
      try {
        const draft = await scanReceiptWithPicker(source, {
          onScanning: () => setIsScanningReceipt(true),
          onScanningDone: () => setIsScanningReceipt(false),
          kind: category === 'income' ? 'invoice' : 'receipt',
          userFingerprints: asResolverInput(),
        })
        if (!draft) return

        if (draft.date) {
          const dateCheck = await resolveManualEntryDate(draft.date, currentQuarter)
          if (!dateCheck.ok) return
          draft.date = dateCheck.date
        }

        setReceiptDraft(draft)
        setManualCategory(category)
        setShowManualEntry(true)
      } catch (error) {
        console.info('[quick-add] receipt scan failed', error)
      } finally {
        setIsScanningReceipt(false)
        setReceiptScanBusy(false)
      }
    },
    [asResolverInput, currentQuarter, manualAccountId, receiptScanBusy],
  )

  // camera/library/file cannot present while the quick-add modal is still dismissing
  const openReceiptScan = useCallback(
    (source: ReceiptPickSource, category: TransactionEditCategoryId) => {
      if (!manualAccountId || receiptScanBusy) return
      pendingScanRef.current = { source, category }
      closeQuickAdd()
      InteractionManager.runAfterInteractions(() => {
        const pending = pendingScanRef.current
        pendingScanRef.current = null
        if (!pending) return
        // small extra delay so ios finishes modal teardown
        setTimeout(() => {
          void runReceiptScan(pending.source, pending.category)
        }, 300)
      })
    },
    [manualAccountId, receiptScanBusy, runReceiptScan],
  )

  const openManual = useCallback(
    (category: TransactionEditCategoryId) => {
      if (!manualAccountId) return
      closeQuickAdd()
      setReceiptDraft(null)
      setManualCategory(category)
      setShowManualEntry(true)
    },
    [manualAccountId],
  )

  const openCis = useCallback(() => {
    if (!cisAccountId) return
    closeQuickAdd()
    setShowCisEntry(true)
  }, [cisAccountId])

  const openMileage = useCallback(() => {
    closeQuickAdd()
    setShowMileageEntry(true)
  }, [])

  const handleAction = useCallback(
    (id: QuickAddActionId) => {
      switch (id) {
        case 'snap-expense':
          openReceiptScan('camera', 'business_expense')
          return
        case 'pic-expense':
          openReceiptScan('library', 'business_expense')
          return
        case 'file-expense':
          openReceiptScan('file', 'business_expense')
          return
        case 'snap-income':
          openReceiptScan('camera', 'income')
          return
        case 'pic-income':
          openReceiptScan('library', 'income')
          return
        case 'file-income':
          openReceiptScan('file', 'income')
          return
        case 'expense':
          openManual('business_expense')
          return
        case 'income':
          openManual('income')
          return
        case 'mileage':
          openMileage()
          return
        case 'cis':
          openCis()
          return
      }
    },
    [openCis, openManual, openMileage, openReceiptScan],
  )

  const closeManualEntry = useCallback(() => {
    setShowManualEntry(false)
    setReceiptDraft(null)
    setManualCategory(null)
  }, [])

  const handleManualSaved = useCallback(() => {
    if (!manualAccountId || !manualCategory) return
    const list = manualCategory === 'income' ? 'income' : 'expenses'
    setManualEntryListMode(list)
    router.push(
      `${MTD_ROUTES.bankAccounts}/${manualAccountId}/categorise?list=${list}` as Href,
    )
  }, [manualAccountId, manualCategory])

  const handleCisSaved = useCallback(() => {
    if (!cisAccountId) return
    router.push(`${MTD_ROUTES.bankAccounts}/${cisAccountId}/categorise` as Href)
  }, [cisAccountId])

  const manualDisabled = !manualAccountId || receiptScanBusy

  const gridRows: [QuickAddActionId, QuickAddActionId][] = isWeb
    ? [
        ['pic-income', 'pic-expense'],
        ['file-income', 'file-expense'],
        ['income', 'expense'],
      ]
    : [
        ['snap-income', 'snap-expense'],
        ['pic-income', 'pic-expense'],
        ['file-income', 'file-expense'],
        ['income', 'expense'],
      ]

  const fullWidthItems = items.filter(
    (item) => !item.hidden && (item.id === 'mileage' || item.id === 'cis'),
  )

  const renderGridCell = (id: QuickAddActionId) => {
    const item = items.find((entry) => entry.id === id)
    if (!item || item.hidden) return <YStack flex={1} />
    return (
      <QuickAddGridCell
        title={item.title}
        icon={item.icon}
        disabled={manualDisabled}
        onPress={() => handleAction(item.id)}
      />
    )
  }

  return (
    <>
      <Modal visible={open} transparent animationType="fade" onRequestClose={closeSheet}>
        <BrandThemeProvider>
          <Pressable style={styles.backdrop} onPress={closeSheet}>
            <View style={styles.sheetWrap} pointerEvents="box-none">
              <Pressable onPress={(event) => event.stopPropagation()}>
                <YStack
                  bg={MTD_TOKENS.card}
                  borderTopLeftRadius={24}
                  borderTopRightRadius={24}
                  borderWidth={1}
                  borderColor={MTD_TOKENS.cardBorder}
                  borderBottomWidth={0}
                  pb={Math.max(insets.bottom, 16)}
                  pt="$3"
                >
                  <XStack px="$4" pb="$2" items="center" justify="center">
                    <YStack
                      position="absolute"
                      l="$4"
                      width={36}
                      height={36}
                      rounded="$10"
                      bg={MTD_TOKENS.cardInset}
                      items="center"
                      justify="center"
                      cursor="pointer"
                      pressStyle={{ opacity: 0.75 }}
                      onPress={closeSheet}
                      aria-label="Close"
                    >
                      <XIcon size={18} color={MTD_TOKENS.text} />
                    </YStack>
                    <SizableText fontSize={17} fontWeight="600" color={MTD_TOKENS.text}>
                      Quick add
                    </SizableText>
                  </XStack>

                  <YStack mx="$3" mt="$2" gap="$2">
                    <YStack
                      bg={MTD_TOKENS.cardInset}
                      rounded="$5"
                      overflow="hidden"
                      borderWidth={1}
                      borderColor={MTD_TOKENS.cardBorder}
                    >
                      {gridRows.map((row, rowIndex) => (
                        <XStack
                          key={row.join('-')}
                          borderTopWidth={rowIndex === 0 ? 0 : 1}
                          borderColor={MTD_TOKENS.cardBorder}
                        >
                          {renderGridCell(row[0])}
                          <YStack width={1} bg={MTD_TOKENS.cardBorder} self="stretch" />
                          {renderGridCell(row[1])}
                        </XStack>
                      ))}
                    </YStack>

                    {fullWidthItems.length > 0 ? (
                      <YStack
                        bg={MTD_TOKENS.cardInset}
                        rounded="$5"
                        overflow="hidden"
                        borderWidth={1}
                        borderColor={MTD_TOKENS.cardBorder}
                      >
                        {fullWidthItems.map((item) => (
                          <QuickAddRow
                            key={item.id}
                            title={item.title}
                            description={item.description}
                            icon={item.icon}
                            onPress={() => handleAction(item.id)}
                          />
                        ))}
                      </YStack>
                    ) : null}
                  </YStack>
                </YStack>
              </Pressable>
            </View>
          </Pressable>
        </BrandThemeProvider>
      </Modal>

      <ReceiptScanningPopup visible={isScanningReceipt} />

      {showManualEntry && manualAccountId && manualCategory ? (
        <ManualTransactionEditScreen
          key={`quick-add-${manualCategory}-${receiptDraft?.localImageUri ?? 'manual'}`}
          bankAccountId={manualAccountId}
          initialCategory={manualCategory}
          allowedCategoryIds={[manualCategory]}
          receiptDraft={receiptDraft}
          onClose={closeManualEntry}
          onSaved={handleManualSaved}
        />
      ) : null}

      {showCisEntry && cisAccountId ? (
        <CisVoucherEditScreen
          bankAccountId={cisAccountId}
          onClose={() => setShowCisEntry(false)}
          onSaved={handleCisSaved}
        />
      ) : null}

      {showMileageEntry ? (
        <MileageEditScreen
          key="quick-add-mileage-create"
          entry={null}
          existingEntries={mileageEntries}
          onClose={() => setShowMileageEntry(false)}
          onSaved={() => {
            void refreshMileage()
          }}
        />
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
})
