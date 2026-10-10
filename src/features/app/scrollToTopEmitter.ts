import { createEmitter, isEqualNever } from '@mtd/helpers'

export const scrollToTopEmitter = createEmitter<'home' | false>('scrollToTop', false, {
  comparator: isEqualNever,
})
