import { YStack } from 'tamagui'

import { Em, InlineLink, Strong, Text } from './Text'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Text> = {
  title: 'Text/Text',
  component: Text,
}

export default meta

type Story = StoryObj<typeof Text>

export const Default: Story = {
  args: {
    children: 'Body text for forms, labels, and descriptions.',
    size: '$5',
  },
}

export const Typography: Story = {
  render: () => (
    <YStack gap="$2" maxW={400}>
      <Text size="$7" fontWeight="700">
        Heading style
      </Text>
      <Text size="$5">Regular body copy with comfortable line height.</Text>
      <Text size="$4" color="$color10">
        Muted secondary text
      </Text>
      <Text>
        <Strong>Strong</Strong> and <Em>emphasis</Em> with an{' '}
        <InlineLink>inline link</InlineLink>.
      </Text>
    </YStack>
  ),
}
