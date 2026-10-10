import type { ReactNode } from 'react'
import { XStack } from 'tamagui'

export function MtdRadioGroup({ children }: { children: ReactNode }) {
  return (
    <XStack gap="$2" width="100%" flexWrap="wrap" items="flex-start">
      {children}
    </XStack>
  )
}
