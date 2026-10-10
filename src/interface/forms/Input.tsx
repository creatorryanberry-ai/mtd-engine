import { memo } from 'react'
import { isWeb, Input as TamaguiInput } from 'tamagui'

import {
  MTD_INPUT_FONT_SIZE,
  MTD_INPUT_HEIGHT,
  getMtdInputProps,
  resolveMtdColor,
} from '~/features/mtd/mtdFormStyles'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useBrandTheme } from '~/features/theme/BrandThemeProvider'

import { GlassView } from '../effects/GlassView'

import type { RefObject } from 'react'
import type { GetProps, TamaguiElement, ViewProps } from 'tamagui'

export type InputProps = GetProps<typeof TamaguiInput> & {
  ref?: RefObject<TamaguiElement | null>
  glass?: boolean
}

export type Input = TamaguiElement

export const inputFocusStyle = {
  outlineWidth: isWeb ? 3 : 0,
  outlineStyle: 'solid',
  outlineColor: isWeb ? '$background04' : 'transparent',
  outlineOffset: 1,
  borderWidth: 0.5,
  borderColor: MTD_TOKENS.orange,
} satisfies ViewProps['focusVisibleStyle']

export const inputCaretColor = MTD_TOKENS.text

export const Input = memo(({ ref, glass, ...props }: InputProps) => {
  const { brand } = useBrandTheme()
  const themed = getMtdInputProps(brand.colors)

  const inputElement = (
    <TamaguiInput
      unstyled
      ref={ref}
      focusStyle={inputFocusStyle}
      focusVisibleStyle={inputFocusStyle}
      cursorColor={inputCaretColor}
      caretColor={inputCaretColor}
      selectionColor={inputCaretColor}
      {...themed}
      {...props}
      height={MTD_INPUT_HEIGHT}
      fontSize={MTD_INPUT_FONT_SIZE}
      borderWidth={glass && !isWeb ? 0 : (props.borderWidth ?? themed.borderWidth)}
      bg={
        glass ? 'transparent' : resolveMtdColor(props.bg, MTD_TOKENS.cardInset, themed.bg)
      }
      borderColor={resolveMtdColor(
        props.borderColor,
        MTD_TOKENS.cardBorder,
        themed.borderColor,
      )}
      color={resolveMtdColor(props.color, MTD_TOKENS.text, themed.color)}
      placeholderTextColor={resolveMtdColor(
        props.placeholderTextColor,
        MTD_TOKENS.textSubtle,
        themed.placeholderTextColor,
      )}
      outlineWidth={props.outlineWidth ?? 0}
      underlineColorAndroid="transparent"
    />
  )
  if (glass && !isWeb) {
    return (
      <GlassView borderRadius={14} intensity={40}>
        {inputElement}
      </GlassView>
    )
  }

  return inputElement
})
