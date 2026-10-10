import { XStack } from 'tamagui'

import { Avatar } from './Avatar'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Avatar> = {
  title: 'Avatars/Avatar',
  component: Avatar,
}

export default meta

type Story = StoryObj<typeof Avatar>

export const Placeholder: Story = {
  args: {
    image: null,
    name: 'Alex Morgan',
    size: 'large',
  },
}

export const Sizes: Story = {
  render: () => (
    <XStack gap="$4" items="center">
      <Avatar image={null} name="Small" size="small" />
      <Avatar image={null} name="Medium" size="medium" />
      <Avatar image={null} name="Large" size="large" />
      <Avatar image={null} name="Extra" size={48} />
    </XStack>
  ),
}

export const WithImage: Story = {
  args: {
    image: 'https://i.pravatar.cc/150?img=12',
    name: 'Jordan Lee',
    size: 'large',
    isOnline: true,
  },
}
