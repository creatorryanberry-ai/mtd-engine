import './tamagui.css'

import { useEmitterValue } from '@mtd/helpers'
import { MetaTheme, SchemeProvider, useUserScheme } from '@vxrn/color-scheme'
import { type ReactNode } from 'react'
import { isWeb, TamaguiProvider, useTheme } from 'tamagui'

import { brandThemeIdEmitter } from '~/features/theme/brandThemeId'
import { getBrandScheme, getBrandTheme } from '~/features/theme/brandThemes'

import { config } from './tamagui.config'

export const TamaguiRootProvider = ({ children }: { children: ReactNode }) => {
  const brandId = useEmitterValue(brandThemeIdEmitter)
  const brand = getBrandTheme(brandId)
  const scheme = getBrandScheme(brand)

  return (
    <SchemeProvider forceScheme={scheme}>
      <TamaguiInnerProvider defaultTheme={brand.tamaguiThemeName}>
        {children}
      </TamaguiInnerProvider>
    </SchemeProvider>
  )
}

const TamaguiInnerProvider = ({
  children,
  defaultTheme,
}: {
  children: ReactNode
  defaultTheme: string
}) => {
  const userScheme = useUserScheme()

  return (
    <TamaguiProvider disableInjectCSS config={config} defaultTheme={defaultTheme}>
      {isWeb && (
        <ThemeMetaTag fallback={userScheme.value === 'dark' ? '#0A0A0A' : '#FFFFFF'} />
      )}
      {children}
    </TamaguiProvider>
  )
}

const ThemeMetaTag = ({ fallback }: { fallback: string }) => {
  const theme = useTheme()
  return (
    <MetaTheme
      color={theme.background?.val ?? fallback}
      darkColor="#000"
      lightColor="#fff"
    />
  )
}
