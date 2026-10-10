import { useState } from 'react'
import { YStack } from 'tamagui'

import { Button } from '../buttons/Button'
import { Dialog } from './Dialog'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Dialog> = {
  title: 'Overlays/Dialog',
  component: Dialog,
}

export default meta

type Story = StoryObj<typeof Dialog>

function DialogStory() {
  const [open, setOpen] = useState(false)
  return (
    <YStack gap="$4" items="center">
      <Button onPress={() => setOpen(true)}>Open dialog</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <Dialog.Header
          title="Confirm action"
          description="This dialog uses the MTD design system shell."
        />
        <Dialog.Body>
          <YStack gap="$3">
            <Button onPress={() => setOpen(false)}>Close</Button>
          </YStack>
        </Dialog.Body>
      </Dialog>
    </YStack>
  )
}

export const Default: Story = {
  render: () => <DialogStory />,
}
