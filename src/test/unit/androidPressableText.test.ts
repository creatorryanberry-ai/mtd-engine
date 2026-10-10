import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readSrc(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8')
}

describe('android pressable text', () => {
  it('does not let child text steal taps on shared pressable surfaces', () => {
    const accent = readSrc('src/features/mtd/components/MtdAccentMutedBg.tsx')
    const button = readSrc('src/features/mtd/components/MtdActionButton.tsx')
    const datePicker = readSrc('src/interface/forms/MtdDatePickerTrigger.tsx')
    const otp = readSrc('src/features/auth/ui/OtpInput.tsx')
    const reviewChoice = readSrc(
      'src/features/mtd/components/review-wizard/ReviewWizardChoice.tsx',
    )

    const calendar = readSrc('src/features/mileage/components/MileageMonthCalendar.tsx')
    const excludeRow = readSrc('src/features/mileage/components/MileageRepeatForm.tsx')
    const mileageRow = readSrc('src/features/mileage/components/MileageRowContent.tsx')

    expect(accent).toMatch(/pointerEvents=\{isPressable \? 'box-only'/)
    expect(button).toMatch(/pointerEvents=\{isDisabled \? 'none' : 'box-only'\}/)
    expect(datePicker).toMatch(/pointerEvents="box-only"/)
    expect(otp).toMatch(/pointerEvents="box-only"/)
    expect(reviewChoice).toMatch(/pointerEvents="box-only"/)
    expect(calendar).toMatch(/pointerEvents=\{onPattern \? 'box-only' : 'none'\}/)
    expect(excludeRow).toMatch(
      /onPress=\{onOpenExcludeDates\}\s+pointerEvents="box-only"/,
    )
    expect(mileageRow).toMatch(/onPress=\{onPressSeries\}\s+pointerEvents="box-only"/)
  })

  it('opens exclude dates inside the editor instead of a nested portal', () => {
    expect(readSrc('src/features/mileage/components/MileageEditScreen.tsx')).toMatch(
      /<MileageExcludeDatesScreen\s+nested/,
    )
    expect(
      readSrc('src/features/mileage/components/MileageExcludeDatesScreen.tsx'),
    ).toMatch(/if \(nested\)/)
  })
})
