export function formatMtdAmount(amount: number) {
  const prefix = amount < 0 ? '-£' : '£'
  return `${prefix}${Math.abs(amount).toFixed(2)}`
}

export function formatSubmissionAmount(amount: number) {
  const prefix = amount < 0 ? '-£' : '£'
  return `${prefix}${Math.abs(amount).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatSubmissionTimestamp(isoDate: string) {
  const date = new Date(isoDate)
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}
