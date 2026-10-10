import { Image as ExpoImage } from 'expo-image'
import { ScrollView } from 'react-native'

type ZoomableAttachmentImageProps = {
  uri: string
  width: number
  height: number
  maxHeight: number
  contentPosition?: 'center' | 'top' | 'bottom'
  recyclingKey?: string
}

/** web: scrollable preview (browser pinch/scroll handles zoom where available) */
export function ZoomableAttachmentImage({
  uri,
  width,
  height,
  maxHeight,
  contentPosition = 'center',
  recyclingKey,
}: ZoomableAttachmentImageProps) {
  return (
    <ScrollView
      style={{ width: '100%', maxHeight }}
      contentContainerStyle={{ width: '100%' }}
      showsVerticalScrollIndicator
      nestedScrollEnabled
    >
      <ExpoImage
        source={{ uri }}
        style={{ width, height, alignSelf: 'center' }}
        contentFit="contain"
        contentPosition={contentPosition}
        recyclingKey={recyclingKey ?? uri}
      />
    </ScrollView>
  )
}
