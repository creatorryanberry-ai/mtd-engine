import { YStack } from 'tamagui'

import { Input } from './Input'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Input> = {
  title: 'Forms/Input',
  component: Input,
}

export default meta

type Story = StoryObj<typeof Input>

export const Default: Story = {
  args: {
    placeholder: 'Email address',
    defaultValue: '',
  },
}

export const States: Story = {
  render: () => (
    <YStack gap="$3" width={320}>
      <Input placeholder="Empty" />
      <Input placeholder="With value" defaultValue="hello@example.com" />
      <Input placeholder="Disabled" disabled />
    </YStack>
  ),
}
