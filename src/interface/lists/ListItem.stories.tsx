import { SizableText, YStack } from 'tamagui'

import { GearIcon } from '../icons/phosphor/GearIcon'
import { ListItem } from './ListItem'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof ListItem> = {
  title: 'Lists/ListItem',
  component: ListItem,
}

export default meta

type Story = StoryObj<typeof ListItem>

export const Default: Story = {
  render: () => (
    <YStack width={360} gap="$2">
      <ListItem>
        <ListItem.Icon>
          <GearIcon size={20} />
        </ListItem.Icon>
        <ListItem.Text>
          <SizableText fontWeight="600">Settings</SizableText>
          <SizableText size="$2" color="$gray10">
            Manage your account
          </SizableText>
        </ListItem.Text>
      </ListItem>
      <ListItem>
        <ListItem.Text>
          <SizableText fontWeight="600">Plain row</SizableText>
          <SizableText size="$2" color="$gray10">
            Without an icon
          </SizableText>
        </ListItem.Text>
      </ListItem>
    </YStack>
  ),
}
