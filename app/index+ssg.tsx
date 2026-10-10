import { Theme, YStack } from 'tamagui'

import { APP_NAME } from '~/constants/app'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { HeadInfo } from '~/interface/app/HeadInfo'
import { MtdLandingFeatures } from '~/interface/landing/MtdLandingFeatures'
import { MtdLandingFooter } from '~/interface/landing/MtdLandingFooter'
import { MtdLandingHeader } from '~/interface/landing/MtdLandingHeader'
import { MtdLandingHero } from '~/interface/landing/MtdLandingHero'
import { MTD_THEME_NAME } from '~/tamagui/themes'

const ogImageUrl = `${process.env.ONE_SERVER_URL}/og.jpg`

export function IndexPage() {
  return (
    <Theme name={MTD_THEME_NAME}>
      <YStack position="relative" bg={MTD_TOKENS.background} minH="100vh">
        <HeadInfo
          title={APP_NAME}
          description="Making Tax Digital for UK sole traders — download transactions, categorise income and expenses, and submit to HMRC."
          openGraph={{
            url: process.env.ONE_SERVER_URL,
            images: [{ url: ogImageUrl, width: 1200, height: 630 }],
          }}
        />

        <MtdLandingHeader />
        <MtdLandingHero />
        <MtdLandingFeatures />
        <MtdLandingFooter />
      </YStack>
    </Theme>
  )
}
