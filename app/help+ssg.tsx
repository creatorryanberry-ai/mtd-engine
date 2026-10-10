import { Separator, SizableText, XStack, YStack } from 'tamagui'

import {
  ADMIN_EMAIL,
  APP_NAME,
  DISCORD_INVITE_URL,
  HELP_REQUESTS_URL,
  HELP_ROADMAP_URL,
  PRIVACY_POLICY_PATH,
} from '~/constants/app'
import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { InfoCard } from '~/features/site/ui/InfoCard'
import { HeadInfo } from '~/interface/app/HeadInfo'
import { Link } from '~/interface/app/Link'
import { ChatCircleIcon } from '~/interface/icons/phosphor/ChatCircleIcon'
import { EnvelopeIcon } from '~/interface/icons/phosphor/EnvelopeIcon'
import { SparkleIcon } from '~/interface/icons/phosphor/SparkleIcon'
import { UserIcon } from '~/interface/icons/phosphor/UserIcon'
import { MtdStaticPageShell } from '~/interface/landing/MtdStaticPageShell'

export const sitemap = {
  priority: 0.7,
  changefreq: 'monthly',
}

export const HelpPage = () => {
  return (
    <MtdStaticPageShell wide>
      <HeadInfo
        title="Help & Support"
        description={`Get help with ${APP_NAME}. Contact support, submit requests, or browse frequently asked questions.`}
      />

      <YStack gap="$4">
        <SizableText
          render="h1"
          role="heading"
          fontFamily="$heading"
          fontSize={32}
          fontWeight="700"
          color={MTD_TOKENS.text}
          lineHeight={40}
        >
          Help & Support
        </SizableText>

        <SizableText fontSize={18} color={MTD_TOKENS.textMuted} fontWeight="300">
          Got a question about {APP_NAME}? We&apos;re here to help.
        </SizableText>

        <XStack flexWrap="wrap" columnGap="$3" rowGap="$3" mt="$2">
          <Link asChild hideExternalIcon href={`mailto:${ADMIN_EMAIL}`} target="_blank">
            <InfoCard maxColumns={2} title="Email Support" Icon={EnvelopeIcon}>
              Send us an email at {ADMIN_EMAIL} and we&apos;ll get back to you as soon as
              possible.
            </InfoCard>
          </Link>

          <Link asChild hideExternalIcon href={HELP_REQUESTS_URL} target="_blank">
            <InfoCard maxColumns={2} title="Submit a Request" Icon={ChatCircleIcon}>
              Have a specific issue or question? Submit a support request and our team
              will help you out.
            </InfoCard>
          </Link>

          <Link asChild hideExternalIcon href={HELP_ROADMAP_URL} target="_blank">
            <InfoCard maxColumns={2} title="Request a Feature" Icon={SparkleIcon}>
              Have an idea for a new feature? Let us know what you&apos;d like to see in{' '}
              {APP_NAME}.
            </InfoCard>
          </Link>

          {DISCORD_INVITE_URL ? (
            <Link asChild hideExternalIcon href={DISCORD_INVITE_URL} target="_blank">
              <InfoCard maxColumns={2} title="Join our Discord" Icon={UserIcon}>
                Connect with other sole traders and get support from our team.
              </InfoCard>
            </Link>
          ) : null}
        </XStack>

        <YStack gap="$5" mt="$4">
          <SizableText
            render="h2"
            role="heading"
            fontFamily="$heading"
            fontSize={24}
            fontWeight="700"
            color={MTD_TOKENS.text}
          >
            Frequently Asked Questions
          </SizableText>

          <Separator borderColor={MTD_TOKENS.cardBorder} />

          <YStack gap="$6">
            <YStack gap="$2">
              <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
                How do I connect my bank account?
              </SizableText>
              <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
                From the Download step in the app, follow the secure Open Banking flow to
                link your account. Transactions are imported automatically for you to
                review.
              </SizableText>
            </YStack>

            <YStack gap="$2">
              <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
                How do I submit to HMRC?
              </SizableText>
              <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
                Once your transactions are downloaded and categorised, use the Submit step
                to send your quarterly update to HMRC. You&apos;ll need an active HMRC
                connection in Settings.
              </SizableText>
            </YStack>

            <YStack gap="$2">
              <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
                How do I delete my account?
              </SizableText>
              <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
                You can request account deletion from Settings. This action is permanent
                and cannot be undone.
              </SizableText>
            </YStack>

            <YStack gap="$2">
              <SizableText fontSize={16} fontWeight="600" color={MTD_TOKENS.text}>
                Is my data secure?
              </SizableText>
              <SizableText fontSize={14} color={MTD_TOKENS.textMuted} lineHeight={20}>
                Yes — we use industry-standard encryption and secure connections for bank
                data and HMRC submissions. See our{' '}
                <Link href={PRIVACY_POLICY_PATH}>
                  <SizableText
                    fontSize={14}
                    color={MTD_TOKENS.orange}
                    textDecorationLine="underline"
                  >
                    Privacy Policy
                  </SizableText>
                </Link>{' '}
                for more details.
              </SizableText>
            </YStack>
          </YStack>
        </YStack>
      </YStack>
    </MtdStaticPageShell>
  )
}
