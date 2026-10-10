import { createEmitter } from '@mtd/helpers'

export const quickAddOpenEmitter = createEmitter('quickAddOpen', false)

export function openQuickAdd() {
  quickAddOpenEmitter.emit(true)
}

export function closeQuickAdd() {
  quickAddOpenEmitter.emit(false)
}
