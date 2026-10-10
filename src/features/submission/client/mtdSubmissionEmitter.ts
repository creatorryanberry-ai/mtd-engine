import { createEmitter, isEqualNever } from '@mtd/helpers'

export const mtdSubmissionEmitter = createEmitter<number>('mtdSubmission', 0, {
  comparator: isEqualNever,
})

export function notifyMtdSubmissionChanged() {
  mtdSubmissionEmitter.emit(Date.now())
}
