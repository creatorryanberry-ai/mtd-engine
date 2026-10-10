import { Slot } from 'one'

import { MtdShell } from '~/features/mtd/components/MtdShell'

export function TabsLayout() {
  return (
    <MtdShell>
      <Slot />
    </MtdShell>
  )
}
