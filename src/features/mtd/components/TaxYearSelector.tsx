import { useCallback, useState } from 'react'
import { Modal, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SizableText, XStack, YStack } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { useSelectedTaxYear } from '~/features/mtd/context/TaxYearProvider'
import { getTaxYearStart } from '~/features/mtd/utils/quarterPeriods'
import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'
import { CaretDownIcon } from '~/interface/icons/phosphor/CaretDownIcon'
import { CheckIcon } from '~/interface/icons/phosphor/CheckIcon'
import { XIcon } from '~/interface/icons/phosphor/XIcon'

type TaxYearSelectorProps = {
  compact?: boolean
}

export function TaxYearSelector({ compact = false }: TaxYearSelectorProps) {
  const insets = useSafeAreaInsets()
  const { taxYear, availableTaxYears, setTaxYearStart } = useSelectedTaxYear()
  const [open, setOpen] = useState(false)
  const currentTaxYearStart = getTaxYearStart()

  const close = useCallback(() => setOpen(false), [])

  const onSelect = useCallback(
    (start: string) => {
      setTaxYearStart(start)
      setOpen(false)
    },
    [setTaxYearStart],
  )

  return (
    <>
      <YStack
        bg={MTD_TOKENS.card}
        borderWidth={1}
        borderColor={MTD_TOKENS.cardBorder}
        rounded="$3"
        px={compact ? '$3' : '$3.5'}
        py={compact ? '$2' : '$2.5'}
        cursor="pointer"
        onPress={() => setOpen(true)}
        pressStyle={{ opacity: 0.9 }}
        aria-label={`Tax year ${taxYear.label}`}
      >
        <XStack items="center" gap="$2">
          <SizableText
            fontSize={compact ? 13 : 14}
            fontWeight="600"
            color={MTD_TOKENS.text}
          >
            Tax year {taxYear.label}
          </SizableText>
          <CaretDownIcon size={14} color={MTD_TOKENS.textMuted} />
        </XStack>
      </YStack>

      <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
        <BrandThemeProvider>
          <Pressable style={styles.backdrop} onPress={close}>
            <YStack flex={1} justify="flex-end" pointerEvents="box-none">
              <Pressable onPress={(event) => event.stopPropagation()}>
                <YStack
                  bg={MTD_TOKENS.card}
                  borderTopLeftRadius={24}
                  borderTopRightRadius={24}
                  borderWidth={1}
                  borderColor={MTD_TOKENS.cardBorder}
                  borderBottomWidth={0}
                  pb={Math.max(insets.bottom, 16)}
                  pt="$3"
                >
                  <XStack px="$4" pb="$3" items="center" justify="center">
                    <YStack
                      position="absolute"
                      l="$4"
                      width={36}
                      height={36}
                      rounded="$10"
                      bg={MTD_TOKENS.cardInset}
                      items="center"
                      justify="center"
                      cursor="pointer"
                      pressStyle={{ opacity: 0.75 }}
                      onPress={close}
                      aria-label="Close"
                    >
                      <XIcon size={18} color={MTD_TOKENS.text} />
                    </YStack>
                    <SizableText fontSize={17} fontWeight="600" color={MTD_TOKENS.text}>
                      Tax year
                    </SizableText>
                  </XStack>

                  <YStack
                    mx="$3"
                    mb="$2"
                    bg={MTD_TOKENS.cardInset}
                    rounded="$5"
                    overflow="hidden"
                  >
                    {availableTaxYears.map((year) => {
                      const selected = year.start === taxYear.start
                      const isCurrent = year.start === currentTaxYearStart

                      return (
                        <XStack
                          key={year.start}
                          items="center"
                          justify="space-between"
                          gap="$3"
                          px="$4"
                          py="$3.5"
                          cursor="pointer"
                          pressStyle={{ opacity: 0.75 }}
                          onPress={() => onSelect(year.start)}
                          bg={selected ? MTD_TOKENS.card : undefined}
                        >
                          <SizableText
                            fontSize={16}
                            fontWeight={selected ? '700' : '500'}
                            color={selected ? MTD_TOKENS.orange : MTD_TOKENS.text}
                          >
                            {year.label}
                            {isCurrent ? ' (Current)' : ''}
                          </SizableText>
                          {selected ? (
                            <CheckIcon size={18} color={MTD_TOKENS.orange} />
                          ) : null}
                        </XStack>
                      )
                    })}
                  </YStack>
                </YStack>
              </Pressable>
            </YStack>
          </Pressable>
        </BrandThemeProvider>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
})
