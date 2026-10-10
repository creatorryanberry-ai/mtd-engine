import { YStack } from 'tamagui'

import { Button } from './Button'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Button> = {
  title: 'Buttons/Button',
  component: Button,
}

export default meta

type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: {
    children: 'Continue',
  },
}

export const Variants: Story = {
  render: () => (
    <YStack gap="$3" items="center">
      <Button variant="default">Default</Button>
      <Button variant="action" theme="accent">
        Action
      </Button>
      <Button variant="outlined">Outlined</Button>
      <Button variant="subtle">Subtle</Button>
      <Button variant="transparent">Transparent</Button>
    </YStack>
  ),
}

export const Sizes: Story = {
  render: () => (
    <YStack gap="$3" items="center">
      <Button size="tiny">Tiny</Button>
      <Button size="small">Small</Button>
      <Button size="medium">Medium</Button>
      <Button size="large">Large</Button>
    </YStack>
  ),
}
