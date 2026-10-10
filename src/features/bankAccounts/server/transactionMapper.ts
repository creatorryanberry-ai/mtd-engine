export function getMerchantInitials(merchantName: string) {
  const words = merchantName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return `${words[0]![0] ?? ''}${words[1]![0] ?? ''}`.toUpperCase()
}

const AVATAR_COLORS = [
  '#00539F',
  '#FFD500',
  '#FF9900',
  '#1D4ED8',
  '#005A9C',
  '#0066CC',
  '#B91C1C',
  '#5B2C6F',
  '#047857',
  '#7C3AED',
]

export function getMerchantColor(merchantName: string) {
  let hash = 0
  for (let i = 0; i < merchantName.length; i++) {
    hash = merchantName.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!
}
