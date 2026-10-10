import { showToast } from '~/interface/toast/helpers'

export function toastError(error: unknown, fallback: string) {
  showToast(error instanceof Error ? error.message : fallback, { type: 'error' })
}

export function toastSuccess(message: string) {
  showToast(message, { type: 'success' })
}
