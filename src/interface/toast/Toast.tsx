import { Toast, useToastItem, type ToastT } from '@tamagui/toast/v2'
import type { ReactNode } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { isWeb, SizableText, XStack, YStack, type ColorTokens } from 'tamagui'

import { MTD_TOKENS } from '~/features/mtd/mtdTokens'
import { BrandThemeProvider } from '~/features/theme/BrandThemeProvider'
import { CheckCircleIcon } from '~/interface/icons/phosphor/CheckCircleIcon'
import { InfoIcon } from '~/interface/icons/phosphor/InfoIcon'
import { WarningCircleIcon } from '~/interface/icons/phosphor/WarningCircleIcon'
import { XCircleIcon } from '~/interface/icons/phosphor/XCircleIcon'

export { showToast } from './helpers'

const toastIcons = {
  success: <CheckCircleIcon size={18} color="$green10" />,
  error: <XCircleIcon size={18} color="$red10" />,
  warning: <WarningCircleIcon size={18} color="$yellow10" />,
  info: <InfoIcon size={18} color="$blue10" />,
}

const toastTitleColor: Record<string, ColorTokens> = {
  success: '$green10',
  error: '$red10',
  warning: '$yellow10',
  info: '$blue10',
  default: '$color12',
  loading: '$color12',
}

function ToastContent({ toast: t }: { toast: ToastT }) {
  const { handleClose } = useToastItem()
  const toastType = t.type ?? 'default'

  const title = typeof t.title === 'function' ? t.title() : t.title
  const description =
    typeof t.description === 'function' ? t.description() : t.description

  return (
    <>
      <XStack gap="$3" items="center">
        <Toast.Icon />
        <YStack flex={1} gap="$0.5">
          {title ? (
            <Toast.Title
              fontWeight="600"
              size="$3"
              color={toastTitleColor[toastType]}
              numberOfLines={1}
            >
              {title}
            </Toast.Title>
          ) : null}
          {description ? (
            <Toast.Description color={MTD_TOKENS.textMuted} size="$2" numberOfLines={2}>
              {description}
            </Toast.Description>
          ) : null}
          {t.action || t.cancel ? (
            <XStack gap="$2" mt="$2">
              {t.action ? (
                <Toast.Action
                  bg={MTD_TOKENS.orange}
                  hoverStyle={{ opacity: 0.9 }}
                  pressStyle={{ opacity: 0.85 }}
                  onPress={(e: any) => {
                    t.action?.onClick?.(e)
                    if (!e.defaultPrevented) handleClose()
                  }}
                >
                  <SizableText size="$1" fontWeight="600" color={MTD_TOKENS.onOrange}>
                    {t.action.label}
                  </SizableText>
                </Toast.Action>
              ) : null}
              {t.cancel ? (
                <Toast.Action
                  bg="transparent"
                  onPress={(e: any) => {
                    t.cancel?.onClick?.(e)
                    handleClose()
                  }}
                >
                  <SizableText size="$1" color={MTD_TOKENS.textMuted}>
                    {t.cancel.label}
                  </SizableText>
                </Toast.Action>
              ) : null}
            </XStack>
          ) : null}
        </YStack>
      </XStack>

      {isWeb ? <Toast.Close position="absolute" t={-6} l={-6} z={1} /> : null}
    </>
  )
}

const TOAST_OFFSET = 16

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const insets = useSafeAreaInsets()
  const offset = isWeb
    ? TOAST_OFFSET
    : {
        top: insets.top > 0 ? insets.top : TOAST_OFFSET,
        left: TOAST_OFFSET,
        right: TOAST_OFFSET,
      }

  return (
    <Toast
      position={isWeb ? 'top-right' : 'top-center'}
      duration={3000}
      visibleToasts={4}
      gap={12}
      icons={toastIcons}
      closeButton={isWeb}
    >
      <Toast.Viewport offset={offset}>
        <BrandThemeProvider>
          <Toast.List
            renderItem={({ toast, index }) => (
              <Toast.Item
                key={toast.id}
                toast={toast}
                index={index}
                bg={MTD_TOKENS.card}
                borderWidth={1}
                borderColor={MTD_TOKENS.cardBorder}
                rounded="$4"
                p="$3"
                shadowColor="#000"
                shadowOpacity={0.35}
                shadowRadius={12}
                shadowOffset={{ width: 0, height: 4 }}
              >
                <ToastContent toast={toast} />
              </Toast.Item>
            )}
          />
        </BrandThemeProvider>
      </Toast.Viewport>
      {children}
    </Toast>
  )
}
