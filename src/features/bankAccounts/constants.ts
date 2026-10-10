export const TRANSACTION_WINDOW_DAYS = 90

export function getWindowStartDate(days = TRANSACTION_WINDOW_DAYS) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}
