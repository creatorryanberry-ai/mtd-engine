import { defaultConfig } from '@tamagui/config/v5'
import { createTamagui } from 'tamagui'

import { animationsRoot } from './animationsRoot'
import { fonts } from './fonts'
import { themes as themesJS } from './themes'

export const config = createTamagui({
  // LLMs love shared configs
  ...defaultConfig,

  animations: animationsRoot,
  fonts,

  // include themes on client so brand switches (e.g. light_actor) resolve without a CSS rebuild
  themes: themesJS,

  settings: {
    ...defaultConfig.settings,
    // brand themes own light/dark. OS prefers-color-scheme must not paint :root / .t_Button dark.
    shouldAddPrefersColorThemes: false,
  },
})

export type Conf = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}

  interface TypeOverride {
    groupNames(): 'button' | 'message' | 'icon' | 'item' | 'frame' | 'card'
  }
}
