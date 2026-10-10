import { Select } from './Select'

import type { Meta, StoryObj } from '@storybook/react'

const meta: Meta<typeof Select> = {
  title: 'Forms/Select',
  component: Select,
}

export default meta

type Story = StoryObj<typeof Select>

const items = [
  { id: 'q1', name: 'Q1 2025' },
  { id: 'q2', name: 'Q2 2025' },
  { id: 'q3', name: 'Q3 2025' },
  { id: 'q4', name: 'Q4 2025' },
]

export const Default: Story = {
  args: {
    items,
    defaultValue: 'q1',
    width: 220,
  },
}
