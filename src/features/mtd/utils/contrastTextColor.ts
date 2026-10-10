const LIGHT_TEXT = '#FFFFFF'
const DARK_TEXT = '#111827'

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '')
  if (normalized.length !== 6) return null

  const red = Number.parseInt(normalized.slice(0, 2), 16)
  const green = Number.parseInt(normalized.slice(2, 4), 16)
  const blue = Number.parseInt(normalized.slice(4, 6), 16)

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return null
  }

  return { red, green, blue }
}

function channelLuminance(channel: number) {
  const value = channel / 255
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function relativeLuminance(red: number, green: number, blue: number) {
  return (
    0.2126 * channelLuminance(red) +
    0.7152 * channelLuminance(green) +
    0.0722 * channelLuminance(blue)
  )
}

function contrastRatio(luminance1: number, luminance2: number) {
  const lighter = Math.max(luminance1, luminance2)
  const darker = Math.min(luminance1, luminance2)
  return (lighter + 0.05) / (darker + 0.05)
}

function isRedBackground(rgb: { red: number; green: number; blue: number }) {
  const { red, green, blue } = rgb
  const max = Math.max(red, green, blue)

  return red === max && red >= 160 && green < red * 0.5 && blue < red * 0.5
}

export function getContrastingTextColor(backgroundColor: string) {
  const rgb = hexToRgb(backgroundColor)
  if (!rgb) return LIGHT_TEXT

  if (isRedBackground(rgb)) return LIGHT_TEXT

  const backgroundLuminance = relativeLuminance(rgb.red, rgb.green, rgb.blue)
  const darkLuminance = relativeLuminance(17, 24, 39)
  const whiteContrast = contrastRatio(backgroundLuminance, 1)
  const darkContrast = contrastRatio(backgroundLuminance, darkLuminance)

  return whiteContrast >= darkContrast ? LIGHT_TEXT : DARK_TEXT
}
