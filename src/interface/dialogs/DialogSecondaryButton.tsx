import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'

import type { ComponentProps } from 'react'

type DialogSecondaryButtonProps = Omit<ComponentProps<typeof MtdActionButton>, 'variant'>

export function DialogSecondaryButton(props: DialogSecondaryButtonProps) {
  return <MtdActionButton variant="secondary" {...props} />
}
