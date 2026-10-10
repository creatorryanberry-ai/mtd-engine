import { MtdActionButton } from '~/features/mtd/components/MtdActionButton'

import type { ComponentProps } from 'react'

type DialogPrimaryButtonProps = Omit<ComponentProps<typeof MtdActionButton>, 'variant'>

export function DialogPrimaryButton(props: DialogPrimaryButtonProps) {
  return <MtdActionButton variant="primary" {...props} />
}
