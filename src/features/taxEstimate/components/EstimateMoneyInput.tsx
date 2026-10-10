import { Input } from '~/interface/forms/Input'

export function EstimateMoneyInput({
  value,
  onChangeText,
  placeholder = '0',
  prefix = '£',
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  prefix?: string
}) {
  return (
    <Input
      value={prefix ? `${prefix}${value}` : value}
      placeholder={prefix ? `${prefix}${placeholder}` : placeholder}
      onChangeText={(text) => {
        const next = prefix ? text.replace(/^[£\s]+/, '') : text
        onChangeText(next)
      }}
      keyboardType="decimal-pad"
      inputMode="decimal"
      autoCorrect={false}
      spellCheck={false}
    />
  )
}

export function parsePoundsInput(value: string): number | null {
  const normalized = value.replace(/[£,\s]/g, '')
  if (!normalized) return null
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function poundsToInput(value: number | null | undefined) {
  if (value == null) return ''
  return String(value)
}
