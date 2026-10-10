import { Text, XStack, YStack } from 'tamagui'

import { HeartIcon } from './HeartIcon'
import { GearIcon } from './GearIcon'
import { UserIcon } from './UserIcon'
import { BellIcon } from './BellIcon'
import { CheckIcon } from './CheckIcon'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta = {
  title: 'Icons/Phosphor',
}

export default meta

type Story = StoryObj

const icons = [
  { name: 'Heart', Icon: HeartIcon },
  { name: 'Gear', Icon: GearIcon },
  { name: 'User', Icon: UserIcon },
  { name: 'Bell', Icon: BellIcon },
  { name: 'Check', Icon: CheckIcon },
] as const

export const Gallery: Story = {
  render: () => (
    <XStack gap="$6" flexWrap="wrap">
      {icons.map(({ name, Icon }) => (
        <YStack key={name} gap="$2" items="center" width={72}>
          <Icon size={28} color="$color12" />
          <Text fontSize={12} color="$color10">
            {name}
          </Text>
        </YStack>
      ))}
    </XStack>
  ),
}

export const Sizes: Story = {
  render: () => (
    <XStack gap="$4" items="center">
      <HeartIcon size={16} />
      <HeartIcon size={24} />
      <HeartIcon size={32} />
      <HeartIcon size={48} />
    </XStack>
  ),
}
