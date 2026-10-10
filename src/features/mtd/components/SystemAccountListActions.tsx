import type { ReactNode } from 'react'
import { XStack, YStack } from 'tamagui'

import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { CameraIcon } from '~/interface/icons/phosphor/CameraIcon'
import { FileIcon } from '~/interface/icons/phosphor/FileIcon'
import { ImageIcon } from '~/interface/icons/phosphor/ImageIcon'
import { PlusIcon } from '~/interface/icons/phosphor/PlusIcon'

import type { SystemBankAccountKind } from '~/features/bankAccounts/defaultBankAccounts'

type SystemAccountListActionsProps = {
  kind: SystemBankAccountKind
  addTransactionLabel?: string
  scanPhotoLabel?: string
  choosePhotoLabel?: string
  chooseFileLabel?: string
  onAddTransaction?: () => void
  onAddVoucher?: () => void
  onAddStatement?: () => void
  onTakeReceiptPhoto?: () => void
  onChooseReceiptPhoto?: () => void
  onChooseReceiptFile?: () => void
  receiptScanBusy?: boolean
}

function ActionButton({
  label,
  onPress,
  icon,
  loading,
  disabled,
}: {
  label: string
  onPress?: () => void
  icon?: ReactNode
  loading?: boolean
  disabled?: boolean
}) {
  return (
    <MtdActionButton
      flex={1}
      size="large"
      variant="secondary"
      icon={icon ?? <PlusIcon size={18} color={MTD_TOKENS.text} />}
      onPress={onPress}
      loading={loading}
      disabled={disabled}
    >
      {label}
    </MtdActionButton>
  )
}

function ScanChooseRow({
  scanPhotoLabel,
  choosePhotoLabel,
  chooseFileLabel,
  onTakeReceiptPhoto,
  onChooseReceiptPhoto,
  onChooseReceiptFile,
  receiptScanBusy,
}: {
  scanPhotoLabel: string
  choosePhotoLabel: string
  chooseFileLabel: string
  onTakeReceiptPhoto?: () => void
  onChooseReceiptPhoto?: () => void
  onChooseReceiptFile?: () => void
  receiptScanBusy: boolean
}) {
  if (!onTakeReceiptPhoto && !onChooseReceiptPhoto && !onChooseReceiptFile) return null

  return (
    <YStack gap="$2" width="100%">
      {onTakeReceiptPhoto || onChooseReceiptPhoto ? (
        <XStack gap="$2" width="100%">
          {onTakeReceiptPhoto ? (
            <ActionButton
              label={scanPhotoLabel}
              onPress={onTakeReceiptPhoto}
              icon={<CameraIcon size={18} color={MTD_TOKENS.text} />}
              loading={receiptScanBusy}
              disabled={receiptScanBusy}
            />
          ) : null}
          {onChooseReceiptPhoto ? (
            <ActionButton
              label={choosePhotoLabel}
              onPress={onChooseReceiptPhoto}
              icon={<ImageIcon size={18} color={MTD_TOKENS.text} />}
              loading={receiptScanBusy}
              disabled={receiptScanBusy}
            />
          ) : null}
        </XStack>
      ) : null}
      {onChooseReceiptFile ? (
        <ActionButton
          label={chooseFileLabel}
          onPress={onChooseReceiptFile}
          icon={<FileIcon size={18} color={MTD_TOKENS.text} />}
          loading={receiptScanBusy}
          disabled={receiptScanBusy}
        />
      ) : null}
    </YStack>
  )
}

function AddScanChooseLayout({
  addLabel,
  onAdd,
  scanPhotoLabel,
  choosePhotoLabel,
  chooseFileLabel,
  onTakeReceiptPhoto,
  onChooseReceiptPhoto,
  onChooseReceiptFile,
  receiptScanBusy,
}: {
  addLabel: string
  onAdd?: () => void
  scanPhotoLabel: string
  choosePhotoLabel: string
  chooseFileLabel: string
  onTakeReceiptPhoto?: () => void
  onChooseReceiptPhoto?: () => void
  onChooseReceiptFile?: () => void
  receiptScanBusy: boolean
}) {
  return (
    <YStack gap="$2" width="100%">
      <XStack gap="$2" width="100%">
        <ActionButton label={addLabel} onPress={onAdd} />
      </XStack>
      <ScanChooseRow
        scanPhotoLabel={scanPhotoLabel}
        choosePhotoLabel={choosePhotoLabel}
        chooseFileLabel={chooseFileLabel}
        onTakeReceiptPhoto={onTakeReceiptPhoto}
        onChooseReceiptPhoto={onChooseReceiptPhoto}
        onChooseReceiptFile={onChooseReceiptFile}
        receiptScanBusy={receiptScanBusy}
      />
    </YStack>
  )
}

export function SystemAccountListActions({
  kind,
  addTransactionLabel = 'Transaction',
  scanPhotoLabel = 'Take pic',
  choosePhotoLabel = 'Select pic',
  chooseFileLabel = 'Choose file',
  onAddTransaction,
  onAddVoucher,
  onAddStatement,
  onTakeReceiptPhoto,
  onChooseReceiptPhoto,
  onChooseReceiptFile,
  receiptScanBusy = false,
}: SystemAccountListActionsProps) {
  if (kind === 'cis') {
    return (
      <AddScanChooseLayout
        addLabel="Add voucher"
        onAdd={onAddVoucher}
        scanPhotoLabel={scanPhotoLabel}
        choosePhotoLabel={choosePhotoLabel}
        chooseFileLabel={chooseFileLabel}
        onTakeReceiptPhoto={onTakeReceiptPhoto}
        onChooseReceiptPhoto={onChooseReceiptPhoto}
        onChooseReceiptFile={onChooseReceiptFile}
        receiptScanBusy={receiptScanBusy}
      />
    )
  }

  if (kind === 'landlord') {
    return (
      <AddScanChooseLayout
        addLabel="Add statement"
        onAdd={onAddStatement}
        scanPhotoLabel={scanPhotoLabel}
        choosePhotoLabel={choosePhotoLabel}
        chooseFileLabel={chooseFileLabel}
        onTakeReceiptPhoto={onTakeReceiptPhoto}
        onChooseReceiptPhoto={onChooseReceiptPhoto}
        onChooseReceiptFile={onChooseReceiptFile}
        receiptScanBusy={receiptScanBusy}
      />
    )
  }

  const showReceiptScan =
    kind === 'manual-entry' &&
    (onTakeReceiptPhoto || onChooseReceiptPhoto || onChooseReceiptFile)

  return (
    <YStack gap="$2" width="100%">
      <XStack gap="$2" flexWrap="wrap" width="100%">
        <ActionButton label={addTransactionLabel} onPress={onAddTransaction} />
      </XStack>

      {showReceiptScan ? (
        <ScanChooseRow
          scanPhotoLabel={scanPhotoLabel}
          choosePhotoLabel={choosePhotoLabel}
          chooseFileLabel={chooseFileLabel}
          onTakeReceiptPhoto={onTakeReceiptPhoto}
          onChooseReceiptPhoto={onChooseReceiptPhoto}
          onChooseReceiptFile={onChooseReceiptFile}
          receiptScanBusy={receiptScanBusy}
        />
      ) : null}
    </YStack>
  )
}
