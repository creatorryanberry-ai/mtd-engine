import { SizableText, XStack, YStack } from 'tamagui'

import type { SubmissionCategoryLine } from '~/features/submission/server/submissionService'
import { MTD_TOKENS } from '../mtdTokens'
import { formatSubmissionAmount } from '../utils/formatAmount'

type SubmissionTotalsTableProps = {
  categoryLines: SubmissionCategoryLine[]
  incomeTotal: number
  expenseTotal: number
  taxableProfit: number
}

function CategoryRow({ line }: { line: SubmissionCategoryLine }) {
  return (
    <XStack
      px="$3"
      py="$2.5"
      items="center"
      justify="space-between"
      borderBottomWidth={1}
      borderColor={MTD_TOKENS.cardBorder}
    >
      <YStack flex={1} minW={0} gap="$0.5">
        <SizableText fontSize={13} color={MTD_TOKENS.text}>
          {line.label}
        </SizableText>
        {line.hmrcBox !== undefined && (
          <SizableText fontSize={11} color={MTD_TOKENS.textSubtle}>
            Box {line.hmrcBox}
          </SizableText>
        )}
      </YStack>
      <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.text} shrink={0}>
        {formatSubmissionAmount(line.total)}
      </SizableText>
    </XStack>
  )
}

export function SubmissionTotalsTable({
  categoryLines,
  incomeTotal,
  expenseTotal,
  taxableProfit,
}: SubmissionTotalsTableProps) {
  const incomeLines = categoryLines.filter((line) => line.type === 'income')
  const expenseLines = categoryLines.filter((line) => line.type === 'expense')

  return (
    <YStack gap="$3">
      <SizableText fontSize={15} fontWeight="600" color={MTD_TOKENS.text}>
        Quarterly totals
      </SizableText>

      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$4"
        overflow="hidden"
      >
        {categoryLines.length === 0 ? (
          <SizableText fontSize={13} color={MTD_TOKENS.textMuted} px="$3" py="$3">
            No reportable totals for this period yet.
          </SizableText>
        ) : (
          <>
            {incomeLines.length > 0 && (
              <YStack>
                <SizableText
                  fontSize={11}
                  fontWeight="600"
                  color={MTD_TOKENS.textSubtle}
                  letterSpacing={0.8}
                  px="$3"
                  py="$2"
                  bg={MTD_TOKENS.cardInset}
                >
                  INCOME
                </SizableText>
                {incomeLines.map((line) => (
                  <CategoryRow key={line.id} line={line} />
                ))}
              </YStack>
            )}

            {expenseLines.length > 0 && (
              <YStack>
                <SizableText
                  fontSize={11}
                  fontWeight="600"
                  color={MTD_TOKENS.textSubtle}
                  letterSpacing={0.8}
                  px="$3"
                  py="$2"
                  bg={MTD_TOKENS.cardInset}
                >
                  EXPENSES
                </SizableText>
                {expenseLines.map((line) => (
                  <CategoryRow key={line.id} line={line} />
                ))}
              </YStack>
            )}
          </>
        )}

        <YStack bg={MTD_TOKENS.cardInset} px="$3" py="$3" gap="$2">
          <XStack justify="space-between">
            <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
              Total income
            </SizableText>
            <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.text}>
              {formatSubmissionAmount(incomeTotal)}
            </SizableText>
          </XStack>
          <XStack justify="space-between">
            <SizableText fontSize={12} color={MTD_TOKENS.textMuted}>
              Allowable expenses
            </SizableText>
            <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.text}>
              {formatSubmissionAmount(expenseTotal)}
            </SizableText>
          </XStack>
          <XStack justify="space-between" pt="$1">
            <SizableText fontSize={13} fontWeight="600" color={MTD_TOKENS.text}>
              Taxable profit
            </SizableText>
            <SizableText fontSize={14} fontWeight="700" color={MTD_TOKENS.orange}>
              {formatSubmissionAmount(taxableProfit)}
            </SizableText>
          </XStack>
        </YStack>
      </YStack>
    </YStack>
  )
}
