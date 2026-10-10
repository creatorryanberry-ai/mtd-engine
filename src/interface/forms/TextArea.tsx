import { TextArea as TamaguiTextArea, styled } from 'tamagui'

import { inputCaretColor, inputFocusStyle } from './Input'

export const TextArea = styled(TamaguiTextArea, {
  name: 'TextArea',
  background: '$color1',
  borderWidth: 0.5,
  borderColor: '$borderColor',
  placeholderTextColor: '$color8',
  minH: 100,
  fontSize: '$4',

  focusStyle: inputFocusStyle,
  focusVisibleStyle: inputFocusStyle,
  cursorColor: inputCaretColor,
  caretColor: inputCaretColor,
  selectionColor: inputCaretColor,

  variants: {
    size: {
      small: {
        rounded: '$2',
        fontSize: '$3',
        minHeight: 80,
        px: '$2.5',
        py: '$2',
      },
      medium: {
        rounded: '$4',
        fontSize: '$4',
        minHeight: 100,
      },
      large: {
        rounded: '$6',
        fontSize: '$5',
        minHeight: 120,
        px: '$4',
        py: '$3',
      },
    },
  } as const,

  defaultVariants: {
    size: 'medium',
  },
})
