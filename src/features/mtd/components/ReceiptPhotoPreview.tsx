import { useEffect, useState } from 'react'
import { Image as RNImage, useWindowDimensions } from 'react-native'
import { SizableText, XStack, YStack } from 'tamagui'

import { isRasterImageAsset } from '~/helpers/media/isRasterImageAsset'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { FileIcon } from '~/interface/icons/phosphor/FileIcon'
import { XIcon } from '~/interface/icons/phosphor/XIcon'
import { MtdActionButton } from './MtdActionButton'
import { ZoomableAttachmentImage } from './ZoomableAttachmentImage'

type ReceiptPhotoPreviewProps = {
  imageUri: string | null
  fileName?: string | null
  mimeType?: string | null
  photoLabel?: string
  onRemove: () => void
}

const DEFAULT_PORTRAIT_RATIO = 4 / 3

export function ReceiptPhotoPreview({
  imageUri,
  fileName = null,
  mimeType = null,
  photoLabel = 'Receipt',
  onRemove,
}: ReceiptPhotoPreviewProps) {
  const { width: windowWidth } = useWindowDimensions()
  const [imageRatio, setImageRatio] = useState(DEFAULT_PORTRAIT_RATIO)

  const previewWidth = Math.min(windowWidth - 32, 720)
  const imageHeight = previewWidth * imageRatio
  const showImage =
    Boolean(imageUri) && isRasterImageAsset({ mimeType, fileName, uri: imageUri })
  const displayName =
    fileName?.trim() ||
    (imageUri ? imageUri.split('/').pop()?.split('?')[0] : null) ||
    'Attached file'

  useEffect(() => {
    if (!imageUri || !showImage) {
      setImageRatio(DEFAULT_PORTRAIT_RATIO)
      return
    }

    RNImage.getSize(
      imageUri,
      (width, height) => {
        if (width > 0 && height > 0) {
          setImageRatio(height / width)
        }
      },
      () => {
        setImageRatio(DEFAULT_PORTRAIT_RATIO)
      },
    )
  }, [imageUri, showImage])

  if (!imageUri) return null

  return (
    <YStack gap="$2.5" width="100%">
      <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.textMuted}>
        {photoLabel}
      </SizableText>
      <YStack
        gap="$2"
        width="100%"
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$4"
        overflow="hidden"
      >
        {showImage ? (
          <ZoomableAttachmentImage
            uri={imageUri}
            width={previewWidth}
            height={imageHeight}
            maxHeight={imageHeight}
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
            {showImage
              ? 'Photo ready — attaches when you save'
              : 'File ready — attaches when you save'}
          </SizableText>
          <MtdActionButton
            size="compact"
            variant="secondary"
            icon={<XIcon size={16} color={MTD_TOKENS.text} />}
            onPress={onRemove}
          >
            Remove
          </MtdActionButton>
        </XStack>
      </YStack>
    </YStack>
  )
}
