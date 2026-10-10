import { useState } from 'react'
import { Label, XStack } from 'tamagui'

import { Switch } from './Switch'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Switch> = {
  title: 'Forms/Switch',
  component: Switch,
}

export default meta

type Story = StoryObj<typeof Switch>

function SwitchStory() {
  const [checked, setChecked] = useState(false)
  return (
    <XStack gap="$3" items="center">
      <Switch checked={checked} onCheckedChange={setChecked} />
      <Label>Notifications</Label>
    </XStack>
  )
}

export const Default: Story = {
  render: () => <SwitchStory />,
}
