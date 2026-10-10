import { createEmitter, isEqualNever } from '@mtd/helpers'

export const feedDropdownEmitter = createEmitter<boolean>('feedDropdown', false, {
  comparator: isEqualNever,
})
