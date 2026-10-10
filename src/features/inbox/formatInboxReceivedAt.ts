const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

function padTime(value: number) {
  return String(value).padStart(2, '0')
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export function formatInboxReceivedAt(iso: string, now = new Date()) {
  const received = new Date(iso)
  if (Number.isNaN(received.getTime())) return iso

  const time = `${padTime(received.getHours())}:${padTime(received.getMinutes())}`
  const dayDiff = Math.round((startOfDay(now) - startOfDay(received)) / 86_400_000)

  if (dayDiff === 0) return `Today · ${time}`
  if (dayDiff === 1) return `Yesterday · ${time}`
  if (received.getFullYear() === now.getFullYear()) {
    return `${received.getDate()} ${MONTHS[received.getMonth()]}`
  }
  return `${received.getDate()} ${MONTHS[received.getMonth()]} ${received.getFullYear()}`
}
