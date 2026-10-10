import type { Href } from 'one'
import { router } from 'one'
import { SizableText, XStack } from 'tamagui'

import { MTD_ROUTES } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'
import { MtdAccentMutedBg } from './MtdAccentMutedBg'
import { MtdActionButton } from './MtdActionButton'
import { FileTextIcon } from '~/interface/icons/phosphor/FileTextIcon'
import { SparkleIcon } from '~/interface/icons/phosphor/SparkleIcon'

export function AiCategorisationBanner() {
  const handleRulesPress = () => {
    router.push(MTD_ROUTES.categorisationRules as Href)
  }

  return (
    <XStack
      bg={MTD_TOKENS.card}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$4"
      p="$3.5"
      gap="$3"
      items="center"
      flexDirection="column"
      $md={{ flexDirection: 'row' }}
    >
      <XStack gap="$3" items="flex-start" flex={1}>
        <MtdAccentMutedBg width={36} height={36} rounded="$10" shrink={0}>
          <SparkleIcon size={18} color={MTD_TOKENS.orange} />
        </MtdAccentMutedBg>
        <SizableText fontSize={13} color={MTD_TOKENS.textMuted} lineHeight={18} flex={1}>
          Rule-based categories: Review and confirm or change the category where needed.
        </SizableText>
      </XStack>

      <MtdActionButton
        variant="secondary"
        size="compact"
        shrink={0}
        width="100%"
        icon={<FileTextIcon size={16} color={MTD_TOKENS.text} />}
        onPress={handleRulesPress}
        $md={{ width: 'auto' }}
      >
        Categorisation rules
      </MtdActionButton>
    </XStack>
  )
}
