import { Button } from '../buttons/Button'
import { GlobalTooltipProvider, Tooltip } from './Tooltip'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Tooltip> = {
  title: 'Overlays/Tooltip',
  component: Tooltip,
  decorators: [
    (Story) => (
      <GlobalTooltipProvider>
        <Story />
      </GlobalTooltipProvider>
    ),
  ],
}

export default meta

type Story = StoryObj<typeof Tooltip>

export const Default: Story = {
  render: () => (
    <Tooltip label="Save your changes">
      <Button>Hover me</Button>
    </Tooltip>
  ),
}
