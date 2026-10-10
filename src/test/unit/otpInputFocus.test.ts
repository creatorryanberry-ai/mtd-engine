import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readSrc(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8')
}

describe('OtpInput focus', () => {
  it('delays first-field focus and uses the native caret', () => {
    const src = readSrc('src/features/auth/ui/OtpInput.tsx')

    expect(src).toMatch(/OTP_FOCUS_DELAY_MS/)
    expect(src).toMatch(/inputRef\.current\[0\]\?\.focus\(\)/)
    expect(src).not.toMatch(/caretHidden/)
    expect(src).not.toMatch(/OtpCaret/)
    expect(src).toMatch(/focusStyle=\{inputFocusStyle\}/)
    expect(src).toMatch(/focusVisibleStyle=\{inputFocusStyle\}/)
  })
})

describe('shared input focus style', () => {
  it('uses the same focus ring on Input, TextArea, and OtpInput', () => {
    const input = readSrc('src/interface/forms/Input.tsx')
    const textArea = readSrc('src/interface/forms/TextArea.tsx')
    const otp = readSrc('src/features/auth/ui/OtpInput.tsx')

    expect(input).toMatch(/focusStyle=\{inputFocusStyle\}/)
    expect(input).toMatch(/focusVisibleStyle=\{inputFocusStyle\}/)
    expect(input).toMatch(/borderColor: MTD_TOKENS\.orange/)
    expect(input).toMatch(/cursorColor=\{inputCaretColor\}/)
    expect(textArea).toMatch(/focusStyle: inputFocusStyle/)
    expect(textArea).toMatch(/focusVisibleStyle: inputFocusStyle/)
    expect(textArea).toMatch(/cursorColor: inputCaretColor/)
    expect(otp).toMatch(/focusStyle=\{inputFocusStyle\}/)
    expect(otp).toMatch(/focusVisibleStyle=\{inputFocusStyle\}/)
    expect(otp).toMatch(/cursorColor=\{inputCaretColor\}/)
  })
})
