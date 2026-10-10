/** integer pence. never use floating point for tax maths. */
export type Pence = number

const POUNDS_TO_PENCE = 100

export function poundsToPence(pounds: number): Pence {
  if (!Number.isFinite(pounds) || pounds <= 0) return 0
  return Math.round(pounds * POUNDS_TO_PENCE)
}

export function penceToPounds(pence: Pence): number {
  if (!Number.isFinite(pence) || pence === 0) return 0
  return pence / POUNDS_TO_PENCE
}

export function clampNonNegativePence(value: number): Pence {
  if (!Number.isFinite(value) || value <= 0) return 0
  return Math.round(value)
}

export function penceFromUnknown(value: unknown): Pence {
  if (typeof value === 'number') return poundsToPence(value)
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseFloat(value.replace(/[£,\s]/g, ''))
    return poundsToPence(parsed)
  }
  return 0
}
