import { createEmitter, isEqualNever } from '@mtd/helpers'

export const hmrcConnectionEmitter = createEmitter<number>('hmrcConnection', 0, {
  comparator: isEqualNever,
})

export function notifyHmrcConnectionChanged() {
  hmrcConnectionEmitter.emit(Date.now())
}
