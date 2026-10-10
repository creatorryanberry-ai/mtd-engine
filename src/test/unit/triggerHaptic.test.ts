import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@mtd/helpers', () => ({
  IS_NATIVE: true,
}))

const impactAsync = vi.fn(async () => {})
vi.mock('expo-haptics', () => ({
  impactAsync,
  ImpactFeedbackStyle: {
    Light: 'Light',
    Medium: 'Medium',
    Heavy: 'Heavy',
    Soft: 'Soft',
    Rigid: 'Rigid',
  },
  notificationAsync: vi.fn(async () => {}),
  NotificationFeedbackType: {
    Success: 'Success',
    Warning: 'Warning',
    Error: 'Error',
  },
  selectionAsync: vi.fn(async () => {}),
}))

describe('triggerHaptic / composeHapticPressIn', () => {
  beforeEach(() => {
    impactAsync.mockClear()
  })

  it('defaults to light impact', async () => {
    const { triggerHaptic } = await import('~/interface/haptics/haptics')
    triggerHaptic()
    triggerHaptic(true)
    expect(impactAsync).toHaveBeenCalledWith('Light')
    expect(impactAsync).toHaveBeenCalledTimes(2)
  })

  it('no-ops when false', async () => {
    const { triggerHaptic } = await import('~/interface/haptics/haptics')
    triggerHaptic(false)
    expect(impactAsync).not.toHaveBeenCalled()
  })

  it('composeHapticPressIn fires then calls through', async () => {
    const { composeHapticPressIn } = await import('~/interface/haptics/haptics')
    const next = vi.fn()
    const handler = composeHapticPressIn(next, { haptic: 'medium' })
    handler('event')
    expect(impactAsync).toHaveBeenCalledWith('Medium')
    expect(next).toHaveBeenCalledWith('event')
  })
})
