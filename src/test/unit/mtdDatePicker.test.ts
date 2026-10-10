import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function readSrc(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf-8')
}

describe('mtd date picker', () => {
  it('uses the expo system date picker on native', () => {
    const native = readSrc('src/interface/forms/MtdDatePicker.native.tsx')
    expect(native).toMatch(/from '@react-native-community\/datetimepicker'/)
    expect(native).toMatch(/DateTimePickerAndroid/)
    expect(native).not.toMatch(/react-native-date-picker/)
    expect(native).not.toMatch(/DateWheelColumn/)
    expect(readSrc('src/interface/forms/MtdDatePickerTrigger.tsx')).toMatch(
      /pointerEvents="box-only"/,
    )
  })

  it('keeps web on the html date input', () => {
    const web = readSrc('src/interface/forms/MtdDatePicker.tsx')
    expect(web).toMatch(/type="date"/)
    expect(web).not.toMatch(/datetimepicker/)
    expect(web).toMatch(/showPicker/)
    expect(web).toMatch(/MtdDatePickerTrigger/)
  })

  it('unmounts the ios modal when the picker is closed', () => {
    const native = readSrc('src/interface/forms/MtdDatePicker.native.tsx')
    expect(native).toMatch(/<Modal/)
    expect(native).toMatch(/Platform\.OS === 'ios' && open/)
    expect(native).toMatch(/dateBounds/)
  })

  it('keeps the flow date picker out of vite web optimize', () => {
    const vite = readSrc('vite.config.ts')
    expect(vite).toMatch(/'@react-native-community\/datetimepicker'/)
    expect(vite).toMatch(/optimizeDeps/)
    expect(vite).toMatch(/ssr:/)
  })

  it('routes cis through the shared picker and snaps to the 5th', () => {
    const cis = readSrc('src/features/mtd/components/CisVoucherDatePicker.tsx')
    expect(cis).toMatch(/MtdDatePicker/)
    expect(cis).toMatch(/toCisVoucherIsoDate/)
    expect(cis).not.toMatch(/DateWheelColumn/)
  })
})

describe('mtd input chrome', () => {
  it('shares the same field height, radius, and border across inputs and date pickers', () => {
    const styles = readSrc('src/features/mtd/mtdFormStyles.ts')
    const input = readSrc('src/interface/forms/Input.tsx')
    const datePicker = readSrc('src/interface/forms/MtdDatePicker.tsx')
    const datePickerNative = readSrc('src/interface/forms/MtdDatePicker.native.tsx')

    expect(styles).toMatch(/MTD_INPUT_HEIGHT = 44/)
    expect(styles).toMatch(/rounded: '\$4'/)
    expect(styles).toMatch(/borderWidth: 0\.5/)
    expect(input).toMatch(/getMtdInputProps/)
    expect(input).toMatch(/useBrandTheme/)
    expect(input).toMatch(/outlineWidth=\{props.outlineWidth \?\? 0\}/)
    expect(input).toMatch(/underlineColorAndroid="transparent"/)
    expect(styles).toMatch(/colors\.cardBorder/)
    expect(datePicker).toMatch(/MtdDatePickerTrigger/)
    expect(datePickerNative).toMatch(/MtdDatePickerTrigger/)
    expect(readSrc('src/interface/forms/MtdDatePickerTrigger.tsx')).toMatch(
      /getMtdFieldChrome/,
    )
  })
})
