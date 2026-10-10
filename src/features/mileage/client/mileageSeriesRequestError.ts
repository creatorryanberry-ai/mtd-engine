export const MILEAGE_SERIES_API_MISSING_MESSAGE =
  'Repeating mileage is not on this server yet. Use local bun dev, not staging.'

function messageFromError(error: unknown, fallback: string) {
  if (!error) return fallback
  if (typeof error === 'string') return error

  if (typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string') {
      return error.message
    }

    if ('error' in error) {
      const nested = (error as { error: unknown }).error
      if (typeof nested === 'string') return nested
      if (
        nested &&
        typeof nested === 'object' &&
        'message' in nested &&
        typeof nested.message === 'string'
      ) {
        return nested.message
      }
    }
  }

  return fallback
}

export function mileageSeriesRequestError(error: unknown, fallback: string) {
  const message = messageFromError(error, fallback)
  const status =
    error && typeof error === 'object' && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined

  if (status === 404 || /^not found$/i.test(message.trim())) {
    return MILEAGE_SERIES_API_MISSING_MESSAGE
  }

  return message
}
