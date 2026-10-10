import { Link } from 'one'
import { SizableText, XStack, YStack } from 'tamagui'

import type { SubmissionBlocker } from '~/features/submission/server/submissionService'
import { MTD_ROUTES } from '../constants'
import { MTD_TOKENS } from '../mtdTokens'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'

type SubmissionChecklistProps = {
  transactionCount: number
  toReview: number
  uncategorised: number
  blockers: SubmissionBlocker[]
}

type ChecklistItemProps = {
  label: string
  complete: boolean
  action?: { label: string; href: (typeof MTD_ROUTES)[keyof typeof MTD_ROUTES] }
}

function ChecklistItem({ label, complete, action }: ChecklistItemProps) {
  return (
    <XStack
      bg={MTD_TOKENS.cardInset}
      borderWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
      rounded="$3"
      px="$3"
      py="$2.5"
      gap="$2.5"
      items="center"
      justify="space-between"
    >
      <XStack gap="$2.5" items="center" flex={1} minW={0}>
        <YStack
          width={22}
          height={22}
          rounded="$10"
          bg={complete ? MTD_TOKENS.green : MTD_TOKENS.cardBorder}
          items="center"
          justify="center"
          shrink={0}
        >
          {complete && <CheckIcon size={12} color={MTD_TOKENS.text} />}
        </YStack>
        <SizableText fontSize={13} color={MTD_TOKENS.text} flex={1}>
          {label}
        </SizableText>
      </XStack>

      {!complete && action && (
        <Link href={action.href as any} asChild>
          <SizableText
            fontSize={12}
            fontWeight="600"
            color={MTD_TOKENS.orange}
            shrink={0}
            cursor="pointer"
          >
            {action.label}
          </SizableText>
        </Link>
      )}
    </XStack>
  )
}

export function SubmissionChecklist({
  transactionCount,
  toReview,
  uncategorised,
}: SubmissionChecklistProps) {
  const hasTransactions = transactionCount > 0
  const reviewComplete = toReview === 0
  const categorisedComplete = uncategorised === 0

  return (
    <YStack gap="$2.5">
      <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
        Before you submit
      </SizableText>

      <YStack gap="$2">
        <ChecklistItem
          label={
            hasTransactions
              ? `${transactionCount} transaction${transactionCount === 1 ? '' : 's'} in this period`
              : 'No transactions in this period (nil update)'
          }
          complete
        />
        <ChecklistItem
          label={
            !hasTransactions
              ? 'Nothing to review'
              : reviewComplete
                ? 'All transactions reviewed'
                : `${toReview} transaction${toReview === 1 ? '' : 's'} need review`
          }
          complete={reviewComplete}
          action={
            reviewComplete || !hasTransactions
              ? undefined
              : { label: 'Review', href: MTD_ROUTES.bankAccounts }
          }
        />
        <ChecklistItem
          label={
            !hasTransactions
              ? 'Nothing to categorise'
              : categorisedComplete
                ? 'No uncategorised transactions'
                : `${uncategorised} uncategorised transaction${uncategorised === 1 ? '' : 's'}`
          }
          complete={categorisedComplete}
          action={
            categorisedComplete || !hasTransactions
              ? undefined
              : { label: 'Categorise', href: MTD_ROUTES.bankAccounts }
          }
        />
      </YStack>
    </YStack>
  )
}
