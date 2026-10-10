import { createElement, forwardRef, type ComponentProps } from 'react'

// web-only svg filter primitives (not in @tamagui/react-native-svg)
export const Filter = forwardRef<SVGFilterElement, ComponentProps<'filter'>>(
  (props, ref) => createElement('filter', { ...props, ref }),
)

export const FeGaussianBlur = forwardRef<
  SVGFEGaussianBlurElement,
  ComponentProps<'feGaussianBlur'>
>((props, ref) => createElement('feGaussianBlur', { ...props, ref }))
