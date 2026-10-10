import { useCallback, useMemo, useState } from 'react'
import { Linking, Modal, useWindowDimensions } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, ScrollView, SizableText, XStack, YStack } from 'tamagui'

import { API_BASE_URL } from '~/constants/urls'
import { useBusinessSettings } from '~/features/business/useBusinessSettings'
import { downloadInboxAsset } from '~/features/inbox/client/downloadInboxAsset'
import { readInboxOcrText } from '~/features/inbox/client/readInboxOcrText'
import { useInboundEmailAddress } from '~/features/inbox/client/useInboundEmailAddress'
import {
  useInboxDocuments,
  type InboxEmailNoticeItem,
  type InboxDocumentListItem,
} from '~/features/inbox/client/useInboxDocuments'
import { formatInboxReceivedAt } from '~/features/inbox/formatInboxReceivedAt'
import { type InboxProcessKind } from '~/features/inbox/guessInboxDocumentKind'
import { isRasterImageAsset } from '~/helpers/media/isRasterImageAsset'
import { CisVoucherEditScreen } from '~/features/mtd/components/CisVoucherEditScreen'
import { LandlordStatementEditScreen } from '~/features/mtd/components/LandlordStatementEditScreen'
import { ManualTransactionEditScreen } from '~/features/mtd/components/ManualTransactionEditScreen'
import { MtdAccentMutedBg } from '~/features/mtd/components/MtdAccentMutedBg'
import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MtdDetailHeader } from '~/features/mtd/components/MtdDetailHeader'
import { ReceiptScanningPopup } from '~/features/mtd/components/ReceiptScanningPopup'
import { ZoomableAttachmentImage } from '~/features/mtd/components/ZoomableAttachmentImage'
import { MTD_ROUTES, MTD_TAB_BAR_HEIGHT } from '~/features/mtd/constants'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useMtdSelectionColors } from '~/features/mtd/useMtdSelectionColors'
import { isDemoMode } from '~/helpers/isDemoMode'
import { ArrowUpRightIcon } from '~/interface/icons/phosphor/ArrowUpRightIcon'
import { BriefcaseIcon } from '~/interface/icons/phosphor/BriefcaseIcon'
import { FileTextIcon } from '~/interface/icons/phosphor/FileTextIcon'
import { HouseIcon } from '~/interface/icons/phosphor/HouseIcon'
import { parseCisVoucherText } from '~/features/mtd/receipt/parseCisVoucherText'
import { parseLandlordStatementText } from '~/features/mtd/receipt/parseLandlordStatementText'
import { parseReceiptText } from '~/features/mtd/receipt/parseReceiptText'
import { useMerchantFingerprints } from '~/features/mtd/receipt/client/useMerchantFingerprints'
import {
  matchFingerprintForDocument,
  matchPrivateUsePercentForDocument,
  matchProcessKindForDocument,
} from '~/features/mtd/receipt/merchant/matchFingerprint'
import type {
  ReceiptScanAsset,
  ManualReceiptDraft,
} from '~/features/mtd/receipt/scanReceipt'
import type { CisVoucherDraft } from '~/features/mtd/receipt/scanCisVoucher'
import type { LandlordStatementDraft } from '~/features/mtd/receipt/scanLandlordStatement'
import { SYSTEM_ACCOUNT_IDS } from '~/features/bankAccounts/defaultBankAccounts'
import { useMtdBankAccounts } from '~/features/bankAccounts/client/useMtdBankAccounts'
import { useVisibleBankAccounts } from '~/features/bankAccounts/client/useVisibleBankAccounts'
import { dialogConfirm } from '~/interface/dialogs/actions'
import { showToast } from '~/interface/toast/helpers'
import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'

type ProcessKind = InboxProcessKind

const PROCESS_KIND_ICONS = {
  receipt: BriefcaseIcon,
  invoice: ArrowUpRightIcon,
  cis: FileTextIcon,
  landlord: HouseIcon,
} as const
const DOCUMENT_PREVIEW_ASPECT_RATIO = Math.SQRT2
const NO_ATTACHMENT_META_PREFIX = 'no_attachment_meta:'

function parseNoAttachmentMeta(message: string | null | undefined) {
  if (!message?.startsWith(NO_ATTACHMENT_META_PREFIX)) return null
  const raw = message.slice(NO_ATTACHMENT_META_PREFIX.length)
  try {
    const parsed = JSON.parse(raw) as {
      bodyPreview?: string | null
      linkUrl?: string | null
    }
    return {
      bodyPreview: parsed.bodyPreview?.trim() || null,
      linkUrl: parsed.linkUrl?.trim() || null,
    }
  } catch {
    return null
  }
}

function ProcessKindButton({
  label,
  kind,
  selected,
  onPress,
}: {
  label: string
  kind: ProcessKind
  selected: boolean
  onPress: () => void
}) {
  const { borderColor, iconColor, textColor } = useMtdSelectionColors(selected)
  const Icon = PROCESS_KIND_ICONS[kind]

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

function sourceLabel(source: string) {
  if (source === 'Email') return 'Received by email'
  if (source === 'Upload') return 'Uploaded'
  if (source === 'Camera') return 'Taken with camera'
  return 'Received'
}

export function InboxScreen() {
  const insets = useSafeAreaInsets()
  const { width } = useWindowDimensions()
  const { settings } = useBusinessSettings()
  const {
    items,
    notices,
    isLoading,
    error,
    fetchDocument,
    ignoreDocument,
    markProcessed,
    deleteNotice,
  } = useInboxDocuments()
  const { address } = useInboundEmailAddress()
  const mtdEmail = address?.emailAddress
  const { accounts } = useMtdBankAccounts()
  const { systemAccounts } = useVisibleBankAccounts(accounts)
  const { asResolverInput, refresh } = useMerchantFingerprints()

  const manualAccountId =
    systemAccounts.find(
      (account) => account.externalAccountId === SYSTEM_ACCOUNT_IDS.manualEntry,
    )?.id ?? null
  const cisAccountId =
    systemAccounts.find((account) => account.externalAccountId === SYSTEM_ACCOUNT_IDS.cis)
      ?.id ?? null
  const landlordAccountId =
    systemAccounts.find(
      (account) => account.externalAccountId === SYSTEM_ACCOUNT_IDS.landlord,
    )?.id ?? null

  const processOptions = useMemo(() => {
    const options: Array<{ id: ProcessKind; label: string }> = [
      { id: 'receipt', label: 'Receipt (expense)' },
      { id: 'invoice', label: 'Invoice (income)' },
    ]
    if (settings?.cisRegistered && cisAccountId) {
      options.push({ id: 'cis', label: 'CIS voucher' })
    }
    if (settings?.businessType === 'landlord' && landlordAccountId) {
      options.push({ id: 'landlord', label: 'Landlord statement' })
    }
    return options
  }, [cisAccountId, landlordAccountId, settings?.businessType, settings?.cisRegistered])

  const [processTarget, setProcessTarget] = useState<InboxDocumentListItem | null>(null)
  const [selectedKind, setSelectedKind] = useState<ProcessKind | null>(null)
  const [preparedScan, setPreparedScan] = useState<{
    itemId: string
    asset: ReceiptScanAsset
    ocrText: string
  } | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [receiptDraft, setReceiptDraft] = useState<ManualReceiptDraft | null>(null)
  const [receiptKind, setReceiptKind] = useState<'receipt' | 'invoice'>('receipt')
  const [cisDraft, setCisDraft] = useState<CisVoucherDraft | null>(null)
  const [landlordDraft, setLandlordDraft] = useState<LandlordStatementDraft | null>(null)

  const closeProcess = useCallback(() => {
    setProcessTarget(null)
    setSelectedKind(null)
    setReceiptDraft(null)
    setCisDraft(null)
    setLandlordDraft(null)
  }, [])

  const handleIgnore = useCallback(
    async (item: InboxDocumentListItem) => {
      const confirmed = await dialogConfirm({
        title: 'Ignore this document?',
        description:
          'It will be removed from your inbox. You can still find it in records later if needed.',
      })
      if (!confirmed) return
      try {
        await ignoreDocument(item.id)
      } catch (error) {
        showToast('Could not ignore document', {
          type: 'error',
          message: error instanceof Error ? error.message : undefined,
        })
      }
    },
    [ignoreDocument],
  )

  const runProcess = useCallback(
    async (
      item: InboxDocumentListItem,
      kind: ProcessKind,
      prepared?: { asset: ReceiptScanAsset; ocrText: string },
    ) => {
      const ocrText = prepared?.ocrText ?? ''
      const asset = prepared?.asset
      setSelectedKind(kind)
      setReceiptDraft(null)
      setCisDraft(null)
      setLandlordDraft(null)

      if (kind === 'cis') {
        const parsed = parseCisVoucherText(ocrText)
        setCisDraft({
          customer: parsed.customer ?? '',
          date: parsed.date,
          gross: parsed.gross,
          tax: parsed.tax,
          ocrText,
        })
        return
      }
      if (kind === 'landlord') {
        const parsed = parseLandlordStatementText(ocrText)
        setLandlordDraft({
          lettingAgent: parsed.lettingAgent ?? '',
          date: parsed.date,
          grossRents: parsed.grossRents,
          expenses: parsed.expenses,
          vatOnExpenses: parsed.vatOnExpenses,
          localImageUri: asset?.uri ?? '',
          attachmentUrl: null,
          fileName: asset?.fileName ?? null,
          mimeType: asset?.mimeType ?? null,
          ocrText,
        })
        return
      }

      // reload fingerprints from api so a prior correction is always available
      const latest = await refresh()
      const userFingerprints =
        latest.length > 0
          ? latest.map((fp) => ({
              signalType: fp.signalType,
              signalValue: fp.signalValue,
              canonicalName: fp.canonicalName,
              processKind: fp.processKind,
              privateUsePercent: fp.privateUsePercent,
            }))
          : asResolverInput()
      console.info('[merchant-fingerprint] applying', {
        count: userFingerprints.length,
        names: [...new Set(userFingerprints.map((fp) => fp.canonicalName))],
      })

      const parsed = parseReceiptText(ocrText, kind, { userFingerprints })
      const matched = matchFingerprintForDocument(ocrText, userFingerprints)
      // same hit that drives processKind / private use — prefer its saved name
      let name = matched?.canonicalName?.trim() || parsed.supplier || ''
      let nameNeedsConfirm = false
      if (!matched && kind === 'invoice' && parsed.nameNeedsConfirm) {
        nameNeedsConfirm = true
        name = parsed.nameCandidates[0] ?? ''
      }
      const rememberedPrivateUse =
        kind === 'receipt'
          ? matchPrivateUsePercentForDocument(ocrText, userFingerprints)
          : null
      setReceiptKind(kind)
      setReceiptDraft({
        name,
        suggestedName: name,
        details: parsed.invoiceNumber ? `Invoice #${parsed.invoiceNumber}` : '',
        date: parsed.date,
        amount: parsed.amount,
        localImageUri: asset?.uri ?? '',
        attachmentUrl: null,
        fileName: asset?.fileName ?? null,
        mimeType: asset?.mimeType ?? null,
        nameNeedsConfirm,
        ocrText,
        documentKind: kind,
        privateUsePercent: rememberedPrivateUse,
      })
    },
    [asResolverInput, refresh],
  )

  const startProcess = useCallback(
    async (
      item: InboxDocumentListItem,
      prepared: { itemId: string; asset: ReceiptScanAsset; ocrText: string },
    ) => {
      setProcessTarget(item)
      setReceiptDraft(null)
      setCisDraft(null)
      setLandlordDraft(null)
      setPreparedScan({ itemId: item.id, ...prepared })

      const latest = await refresh()
      const fingerprints =
        latest.length > 0
          ? latest.map((fp) => ({
              signalType: fp.signalType,
              signalValue: fp.signalValue,
              canonicalName: fp.canonicalName,
              processKind: fp.processKind,
              privateUsePercent: fp.privateUsePercent,
            }))
          : asResolverInput()
      const remembered = matchProcessKindForDocument(prepared.ocrText, fingerprints)
      const allowed =
        remembered != null && processOptions.some((option) => option.id === remembered)

      if (remembered && allowed) {
        console.info('[merchant-fingerprint] auto process kind', { kind: remembered })
        await runProcess(item, remembered, prepared)
        return
      }

      setSelectedKind(null)
    },
    [asResolverInput, processOptions, refresh, runProcess],
  )

  const handleProcess = useCallback(
    async (item: InboxDocumentListItem) => {
      if (preparedScan?.itemId === item.id) {
        await startProcess(item, preparedScan)
        return
      }
      setIsScanning(true)
      try {
        const detail = await fetchDocument(item.id)
        if (!detail.previewUrl) {
          throw new Error('Document file is not available')
        }
        const downloaded = await downloadInboxAsset(
          detail.previewUrl,
          detail.originalFileName,
          detail.mimeType,
        )
        const { rasterAsset, text } = await readInboxOcrText(downloaded)
        const prepared = { itemId: item.id, asset: rasterAsset, ocrText: text }
        setPreparedScan(prepared)
        setIsScanning(false)
        await startProcess(item, prepared)
      } catch (error) {
        setIsScanning(false)
        const rawMessage = error instanceof Error ? error.message : undefined
        const isMissingFile =
          typeof rawMessage === 'string' &&
          (/status 404/i.test(rawMessage) || /not found/i.test(rawMessage))
        showToast('Could not process document', {
          type: 'error',
          message: isMissingFile
            ? 'The file is no longer available. Ignore this item and forward the email again.'
            : rawMessage,
        })
      }
    },
    [fetchDocument, preparedScan, startProcess],
  )

  const handleSaved = useCallback(
    async (documentId: string, transactionId: string) => {
      try {
        await markProcessed({
          id: documentId,
          mtdTransactionId: transactionId,
        })
      } catch (error) {
        showToast('Saved, but inbox was not updated', {
          type: 'warn',
          message: error instanceof Error ? error.message : undefined,
        })
      }
    },
    [markProcessed],
  )

  const handleDeleteNotice = useCallback(
    async (notice: InboxEmailNoticeItem) => {
      const confirmed = await dialogConfirm({
        title: 'Delete email notice?',
        description: 'This will remove the email from your inbox. This cannot be undone.',
      })
      if (!confirmed) return
      try {
        await deleteNotice(notice.id)
      } catch (error) {
        showToast('Could not delete email notice', {
          type: 'error',
          message: error instanceof Error ? error.message : undefined,
        })
      }
    },
    [deleteNotice],
  )

  const renderNoAttachmentNotice = (notice: InboxEmailNoticeItem) => {
    const meta = parseNoAttachmentMeta(notice.errorMessage)
    return (
      <YStack
        key={notice.id}
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$5"
        px="$4"
        py="$4"
        gap="$2"
      >
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          {notice.subject?.trim() || 'Email received'}
        </SizableText>
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
          {notice.fromAddress ? `From ${notice.fromAddress}` : 'From email inbox'}
        </SizableText>
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
          {formatInboxReceivedAt(notice.receivedAt)}
        </SizableText>
        <SizableText fontSize={13} color={MTD_TOKENS.textSubtle} lineHeight={18}>
          No supported attachment was found, so this email was not added as a processable
          inbox document.
        </SizableText>
        {meta?.bodyPreview ? (
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={18}>
            {meta.bodyPreview}
          </SizableText>
        ) : null}
        {meta?.linkUrl ? (
          <SizableText
            fontSize={13}
            color={MTD_TOKENS.orange}
            textDecorationLine="underline"
            cursor="pointer"
            onPress={() => {
              if (meta.linkUrl) void Linking.openURL(meta.linkUrl)
            }}
          >
            Confirm forwarding
          </SizableText>
        ) : null}
        <XStack justify="flex-end" pt="$1">
          <MtdActionButton
            size="compact"
            variant="secondary"
            onPress={() => void handleDeleteNotice(notice)}
          >
            Delete
          </MtdActionButton>
        </XStack>
      </YStack>
    )
  }

  const content = (
    <YStack
      gap="$4"
      px="$4"
      pt="$4"
      pb={isWeb ? '$6' : insets.bottom + MTD_TAB_BAR_HEIGHT + 24}
      maxW={720}
      width="100%"
      mx="auto"
    >
      <SizableText fontSize={15} color={MTD_TOKENS.textMuted}>
        {items.length === 1 ? '1 document waiting' : `${items.length} documents waiting`}
      </SizableText>
      {isLoading ? (
        <SizableText fontSize={14} color={MTD_TOKENS.textMuted}>
          Loading inbox…
        </SizableText>
      ) : items.length === 0 && notices.length === 0 ? (
        <YStack
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$5"
          px="$4"
          py="$5"
          gap="$2"
        >
          <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
            Inbox is empty
          </SizableText>
          {error ? (
            <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
              Could not load inbox. Leave this screen and open it again.
            </SizableText>
          ) : (
            <YStack gap="$1">
              <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
                Forward receipts, invoices, CIS vouchers and statements to your MTD email.
              </SizableText>
              {mtdEmail ? (
                <SizableText
                  fontSize={14}
                  fontWeight="600"
                  color={MTD_TOKENS.orange}
                  textDecorationLine="underline"
                  cursor="pointer"
                  onPress={() => void Linking.openURL(`mailto:${mtdEmail}`)}
                >
                  {mtdEmail}
                </SizableText>
              ) : null}
              <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
                They will show up here ready to process.
              </SizableText>
            </YStack>
          )}
          {isDemoMode ? (
            <SizableText fontSize={12} color={MTD_TOKENS.textSubtle}>
              {API_BASE_URL}
            </SizableText>
          ) : null}
        </YStack>
      ) : (
        <YStack gap="$3">
          {items.map((item) => (
            <YStack
              key={item.id}
              bg={MTD_TOKENS.card}
              borderWidth={1}
              borderColor={MTD_TOKENS.cardBorder}
              rounded="$5"
              px="$4"
              py="$4"
              gap="$3"
            >
              <YStack gap="$1">
                <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
                  {item.subject?.trim() || item.originalFileName}
                </SizableText>
                {item.subject?.trim() ? (
                  <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                    {item.originalFileName}
                  </SizableText>
                ) : null}
                <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
                  {sourceLabel(item.source)}
                  {item.fromAddress ? ` from ${item.fromAddress}` : ''}
                </SizableText>
                <SizableText fontSize={13} color={MTD_TOKENS.textSubtle}>
                  {formatInboxReceivedAt(item.receivedAt)}
                </SizableText>
              </YStack>
              <XStack gap="$2" flexWrap="wrap">
                <MtdActionButton size="compact" onPress={() => void handleProcess(item)}>
                  Process
                </MtdActionButton>
                <MtdActionButton
                  size="compact"
                  variant="secondary"
                  onPress={() => void handleIgnore(item)}
                >
                  Ignore
                </MtdActionButton>
              </XStack>
            </YStack>
          ))}
          {notices.length > 0 ? (
            <YStack gap="$3" mt="$2">
              <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.textMuted}>
                Emails without usable attachments
              </SizableText>
              {notices.map((notice) => renderNoAttachmentNotice(notice))}
            </YStack>
          ) : null}
        </YStack>
      )}
    </YStack>
  )

  const processPreviewUri =
    processTarget &&
    preparedScan?.itemId === processTarget.id &&
    isRasterImageAsset({
      mimeType: preparedScan.asset.mimeType,
      fileName: preparedScan.asset.fileName,
      uri: preparedScan.asset.uri,
    })
      ? preparedScan.asset.uri
      : null
  const previewWidth = Math.max(width - 32, 1)
  const previewHeight = Math.round(previewWidth * DOCUMENT_PREVIEW_ASPECT_RATIO)
  const previewFooter =
    processPreviewUri && processTarget ? (
      <YStack
        width="100%"
        height={previewHeight}
        rounded="$4"
        overflow="hidden"
        bg="#000"
      >
        <ZoomableAttachmentImage
          key={processTarget.id}
          uri={processPreviewUri}
          width={previewWidth}
          height={previewHeight}
          maxHeight={previewHeight}
          recyclingKey={`${processTarget.id}:${processPreviewUri}`}
        />
      </YStack>
    ) : null
  const kindSwitcher = (
    <YStack gap="$2.5">
      <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.textMuted}>
        Process as
      </SizableText>
      <SizableText fontSize={13} color={MTD_TOKENS.textSubtle} lineHeight={18}>
        Choose how to record this document before you can save.
      </SizableText>
      <YStack gap="$2">
        {processOptions.map((option) => (
          <ProcessKindButton
            key={option.id}
            kind={option.id}
            label={option.label}
            selected={option.id === selectedKind}
            onPress={() => {
              if (!processTarget || option.id === selectedKind) return
              const prepared =
                preparedScan?.itemId === processTarget.id ? preparedScan : undefined
              runProcess(processTarget, option.id, prepared).catch((error) => {
                console.info('[inbox] process failed', error)
              })
            }}
          />
        ))}
      </YStack>
    </YStack>
  )
  const processFooter = (
    <YStack gap="$5">
      {kindSwitcher}
      {previewFooter}
    </YStack>
  )
  const processChooser = (
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
          onPress={closeProcess}
          py="$1"
          pr="$2"
        >
          <SizableText fontSize={15} fontWeight="500" color={MTD_TOKENS.textMuted}>
            Cancel
          </SizableText>
        </YStack>
        <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
          Process document
        </SizableText>
        <YStack width={56} />
      </XStack>
      <ScrollView
        flex={1}
        contentContainerStyle={{
          px: 16,
          pt: 16,
          pb: isWeb ? 32 : insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <YStack gap="$5" maxW={720} width="100%" self="center">
          {processFooter}
        </YStack>
      </ScrollView>
    </YStack>
  )

  return (
    <YStack flex={1} bg={MTD_TOKENS.background}>
      {isWeb ? (
        <>
          <MtdDetailHeader backHref={MTD_ROUTES.records} title="Inbox" />
          <YStack flex={1} minH={0} overflow="scroll">
            {content}
          </YStack>
        </>
      ) : (
        <>
          <YStack pt={insets.top}>
            <MtdDetailHeader backHref={MTD_ROUTES.records} title="Inbox" />
          </YStack>
          <ScrollView flex={1} showsVerticalScrollIndicator={false}>
            {content}
          </ScrollView>
        </>
      )}

      <ReceiptScanningPopup visible={isScanning} />

      <Modal
        visible={Boolean(processTarget)}
        animationType="fade"
        onRequestClose={closeProcess}
      >
        <BrandThemeProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            {!selectedKind ? (
              processChooser
            ) : receiptDraft && manualAccountId ? (
              <ManualTransactionEditScreen
                key={`${selectedKind}-${processTarget.id}`}
                embedded
                hideReceiptPreview
                hideCategoryPicker
                footer={processFooter}
                bankAccountId={manualAccountId}
                initialCategory={
                  receiptKind === 'invoice' ? 'income' : 'business_expense'
                }
                allowedCategoryIds={
                  receiptKind === 'invoice' ? ['income'] : ['business_expense']
                }
                receiptDraft={receiptDraft}
                onClose={closeProcess}
                onSaved={(entry) => {
                  const documentId = processTarget?.id
                  if (!documentId) return
                  closeProcess()
                  void handleSaved(documentId, entry.id)
                }}
              />
            ) : cisDraft && cisAccountId ? (
              <CisVoucherEditScreen
                key={`cis-${processTarget.id}`}
                embedded
                footer={processFooter}
                bankAccountId={cisAccountId}
                voucherDraft={cisDraft}
                onClose={closeProcess}
                onSaved={(entry) => {
                  const documentId = processTarget?.id
                  if (!documentId) return
                  closeProcess()
                  void handleSaved(documentId, entry.id)
                }}
              />
            ) : landlordDraft && landlordAccountId ? (
              <LandlordStatementEditScreen
                key={`landlord-${processTarget.id}`}
                embedded
                hideAttachment
                footer={processFooter}
                bankAccountId={landlordAccountId}
                statementDraft={landlordDraft}
                onClose={closeProcess}
                onSaved={(entry) => {
                  const documentId = processTarget?.id
                  if (!documentId) return
                  closeProcess()
                  void handleSaved(documentId, entry.id)
                }}
              />
            ) : (
              processChooser
            )}
          </GestureHandlerRootView>
        </BrandThemeProvider>
      </Modal>
    </YStack>
  )
}
