import { YStack } from 'tamagui'

import { Button } from '../buttons/Button'
import { showToast, ToastProvider } from './Toast'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta = {
  title: 'Feedback/Toast',
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
}

export default meta

type Story = StoryObj

export const Triggers: Story = {
  render: () => (
    <YStack gap="$3">
      <Button onPress={() => showToast('Saved successfully', { type: 'success' })}>
        Success
      </Button>
      <Button onPress={() => showToast('Something went wrong', { type: 'error' })}>
        Error
      </Button>
      <Button onPress={() => showToast('Check your details', { type: 'warn' })}>
        Warning
      </Button>
      <Button onPress={() => showToast('FYI: sync complete', { type: 'info' })}>
        Info
      </Button>
    </YStack>
  ),
}
