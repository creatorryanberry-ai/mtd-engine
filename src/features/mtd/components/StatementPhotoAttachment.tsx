import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Image as RNImage, useWindowDimensions } from 'react-native'
import { isWeb, SizableText, XStack, YStack } from 'tamagui'

import { pickReceiptDocument } from '~/helpers/media/documentPicker'
import { pickImageFromLibrary, takePhotoWithCamera } from '~/helpers/media/imagePicker'
import { isRasterImageAsset } from '~/helpers/media/isRasterImageAsset'
import { ensureRasterReceiptAsset } from '~/features/mtd/receipt/ensureRasterReceiptAsset'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { CameraIcon } from '~/interface/icons/phosphor/CameraIcon'
import { FileIcon } from '~/interface/icons/phosphor/FileIcon'
import { ImageIcon } from '~/interface/icons/phosphor/ImageIcon'
import { XIcon } from '~/interface/icons/phosphor/XIcon'
import { useUploadFiles } from '~/interface/upload/uploadFile'
import { MtdActionButton } from './MtdActionButton'
import { ZoomableAttachmentImage } from './ZoomableAttachmentImage'

type StatementPhotoAttachmentProps = {
  attachmentUrl: string | null
  initialLocalPreview?: string | null
  initialFileName?: string | null
  initialMimeType?: string | null
  onChange: (url: string | null) => void
  onLocalPreviewChange?: (uri: string | null) => void
  onBusyChange?: (busy: boolean) => void
}

type PickedUploadAsset = {
  uri: string
  width?: number
  height?: number
  fileName?: string | null
  mimeType?: string
  fileSize?: number
}

const DEFAULT_PORTRAIT_RATIO = 4 / 3

export function StatementPhotoAttachment({
  attachmentUrl,
  initialLocalPreview = null,
  initialFileName = null,
  initialMimeType = null,
  onChange,
  onLocalPreviewChange,
  onBusyChange,
}: StatementPhotoAttachmentProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [localPreview, setLocalPreview] = useState<string | null>(initialLocalPreview)
  const [previewFileName, setPreviewFileName] = useState<string | null>(initialFileName)
  const [previewMimeType, setPreviewMimeType] = useState<string | null>(initialMimeType)
  const [imageRatio, setImageRatio] = useState(DEFAULT_PORTRAIT_RATIO)
  const [isCapturing, setIsCapturing] = useState(false)

  const { uploads, handleFileChange, clear } = useUploadFiles({
    purpose: 'receipt',
    onChange: (nextUploads) => {
      const latest = nextUploads[nextUploads.length - 1]
      if (latest?.status === 'complete' && (latest.attachmentRef || latest.url)) {
        onChange(latest.attachmentRef ?? latest.url ?? null)
        setIsCapturing(false)
        onBusyChange?.(false)
      }
      if (latest?.status === 'error') {
        setIsCapturing(false)
        onBusyChange?.(false)
      }
      if (latest?.status === 'uploading') {
        onBusyChange?.(true)
      }
    },
  })

  const latestUpload = uploads[uploads.length - 1]
  const isUploading = latestUpload?.status === 'uploading'
  const candidatePreview =
    localPreview || latestUpload?.preview || attachmentUrl || latestUpload?.url || null
  const previewUrl =
    candidatePreview && /^(file:|https?:|data:)/i.test(candidatePreview)
      ? candidatePreview
      : localPreview
  const progress = latestUpload?.progress
  const busy = isCapturing || isUploading
  const previewWidth = Math.min(windowWidth - 32, 720)
  const imageHeight = previewWidth * imageRatio
  const viewerMaxHeight = Math.round(windowHeight * 0.65)
  const isRemotePreview = Boolean(previewUrl && /^https?:\/\//i.test(previewUrl))
  const showImage =
    Boolean(previewUrl) &&
    (isRemotePreview ||
      isRasterImageAsset({
        mimeType: previewMimeType ?? latestUpload?.type,
        fileName: previewFileName ?? latestUpload?.name,
        uri: previewUrl,
      }))
  const showStoredAttachment = Boolean(attachmentUrl) && !previewUrl && !localPreview
  const displayName =
    previewFileName?.trim() ||
    latestUpload?.name ||
    (previewUrl ? previewUrl.split('/').pop()?.split('?')[0] : null) ||
    'Attached file'

  useEffect(() => {
    if (!previewUrl || !showImage) {
      setImageRatio(DEFAULT_PORTRAIT_RATIO)
      return
    }

    // attachment refs are not fetchable image uris — only size local/http previews
    if (!/^(file:|https?:|data:)/i.test(previewUrl)) {
      setImageRatio(DEFAULT_PORTRAIT_RATIO)
      return
    }

    RNImage.getSize(
      previewUrl,
      (width, height) => {
        if (width > 0 && height > 0) {
          setImageRatio(height / width)
        }
      },
      () => {
        setImageRatio(DEFAULT_PORTRAIT_RATIO)
      },
    )
  }, [previewUrl, showImage])

  const uploadAsset = async (asset: PickedUploadAsset) => {
    setLocalPreview(asset.uri)
    setPreviewFileName(asset.fileName ?? null)
    setPreviewMimeType(asset.mimeType ?? null)
    onLocalPreviewChange?.(asset.uri)
    if (asset.width && asset.height && asset.width > 0) {
      setImageRatio(asset.height / asset.width)
    }

    const fileName = asset.fileName || `landlord-statement-${Date.now()}.jpg`
    const mimeType = asset.mimeType || 'image/jpeg'

    let file: File
    if (isWeb) {
      const response = await fetch(asset.uri)
      const blob = await response.blob()
      file = new File([blob], fileName, { type: mimeType })
    } else {
      file = {
        uri: asset.uri,
        name: fileName,
        type: mimeType,
      } as unknown as File
    }

    handleFileChange({
      target: { files: [file] },
    } as unknown as ChangeEvent<HTMLInputElement>)
  }

  const uploadPickedAsset = async (
    picker: (allowsEditing: boolean) => Promise<{
      canceled: boolean
      assets?: Array<PickedUploadAsset> | null
    } | null>,
  ) => {
    setIsCapturing(true)
    onBusyChange?.(true)
    try {
      const result = await picker(false)
      if (!result || result.canceled || !result.assets?.[0]) {
        setIsCapturing(false)
        onBusyChange?.(false)
        return
      }

      await uploadAsset(result.assets[0])
    } catch (error) {
      console.info('[landlord-statement] photo capture failed', error)
      setIsCapturing(false)
      onBusyChange?.(false)
    }
  }

  const uploadPickedDocument = async () => {
    setIsCapturing(true)
    onBusyChange?.(true)
    try {
      const result = await pickReceiptDocument()
      if (!result || result.canceled || !result.assets?.[0]) {
        setIsCapturing(false)
        onBusyChange?.(false)
        return
      }

      const rasterAsset = await ensureRasterReceiptAsset(result.assets[0])
      await uploadAsset(rasterAsset)
    } catch (error) {
      console.info('[landlord-statement] file pick failed', error)
      setIsCapturing(false)
      onBusyChange?.(false)
    }
  }

  const handleRemove = () => {
    clear()
    setLocalPreview(null)
    setPreviewFileName(null)
    setPreviewMimeType(null)
    setImageRatio(DEFAULT_PORTRAIT_RATIO)
    onLocalPreviewChange?.(null)
    onChange(null)
    onBusyChange?.(false)
  }

  return (
    <YStack gap="$2" width="100%">
      <SizableText fontSize={13} fontWeight="500" color={MTD_TOKENS.textMuted}>
        Statement attachment
      </SizableText>

      {previewUrl || showStoredAttachment ? (
        <YStack
          gap="$2"
          width="100%"
          bg={MTD_TOKENS.card}
          borderWidth={1}
          borderColor={MTD_TOKENS.cardBorder}
          rounded="$4"
          overflow="hidden"
        >
          {showImage && previewUrl ? (
            <ZoomableAttachmentImage
              uri={previewUrl}
              width={previewWidth}
              height={imageHeight}
              maxHeight={viewerMaxHeight}
            />
          ) : (
            <XStack px="$3" pt="$3" gap="$3" items="center">
              <YStack
                width={40}
                height={40}
                rounded="$3"
                bg={MTD_TOKENS.cardInset}
                items="center"
                justify="center"
              >
                <FileIcon size={22} color={MTD_TOKENS.text} />
              </YStack>
              <SizableText
                flex={1}
                fontSize={14}
                fontWeight="500"
                color={MTD_TOKENS.text}
                numberOfLines={2}
              >
                {displayName}
              </SizableText>
            </XStack>
          )}
          <XStack px="$3" pb="$3" gap="$2" items="center" justify="space-between">
            <SizableText fontSize={13} color={MTD_TOKENS.textMuted}>
              {isUploading
                ? `Uploading${progress != null ? ` ${progress}%` : ''}…`
                : 'Attached'}
            </SizableText>
            <XStack gap="$2">
              <MtdActionButton
                size="compact"
                variant="secondary"
                disabled={busy}
                icon={<CameraIcon size={16} color={MTD_TOKENS.text} />}
                onPress={() => void uploadPickedAsset(takePhotoWithCamera)}
              >
                Retake
              </MtdActionButton>
              <MtdActionButton
                size="compact"
                variant="secondary"
                disabled={isUploading}
                icon={<XIcon size={16} color={MTD_TOKENS.text} />}
                onPress={handleRemove}
              >
                Remove
              </MtdActionButton>
            </XStack>
          </XStack>
        </YStack>
      ) : (
        <YStack gap="$2" width="100%">
          <XStack gap="$2" flexWrap="wrap" width="100%">
            {isWeb ? null : (
              <MtdActionButton
                flex={1}
                size="large"
                variant="secondary"
                disabled={busy}
                loading={isCapturing}
                icon={<CameraIcon size={18} color={MTD_TOKENS.text} />}
                onPress={() => void uploadPickedAsset(takePhotoWithCamera)}
              >
                Take pic
              </MtdActionButton>
            )}
            <MtdActionButton
              flex={1}
              size="large"
              variant="secondary"
              disabled={busy}
              loading={isUploading}
              icon={<ImageIcon size={18} color={MTD_TOKENS.text} />}
              onPress={() => void uploadPickedAsset(pickImageFromLibrary)}
            >
              Select pic
            </MtdActionButton>
          </XStack>
          <MtdActionButton
            size="large"
            variant="secondary"
            disabled={busy}
            loading={isUploading}
            icon={<FileIcon size={18} color={MTD_TOKENS.text} />}
            onPress={() => void uploadPickedDocument()}
          >
            Choose file
          </MtdActionButton>
        </YStack>
      )}
    </YStack>
  )
}
