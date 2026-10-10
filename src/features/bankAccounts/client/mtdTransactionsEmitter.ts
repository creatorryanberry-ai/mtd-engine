import { createGlobalEmitter, isEqualNever } from '@mtd/helpers'

export const mtdTransactionsEmitter = createGlobalEmitter<number>('mtdTransactions', 0, {
  comparator: isEqualNever,
})

export function notifyMtdTransactionsChanged() {
  mtdTransactionsEmitter.emit(Date.now())
}
