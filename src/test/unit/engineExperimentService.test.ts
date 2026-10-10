import { describe, expect, it, vi } from 'vitest'

import {
  canTransition,
  EXPERIMENT_TRANSITIONS,
  normalizeArms,
  resolveHoldoutRate,
} from '~/features/engine/measure/server/experimentService'

vi.mock('~/database/db', () => ({ drizzle: {} }))
vi.mock('~/features/engine/core/server/workspaceAccess', () => ({
  assertNotKilled: () => {},
}))

function statusOf(fn: () => unknown) {
  try {
    fn()
  } catch (error) {
    if (error instanceof Response) return error.status
    throw error
  }
  return null
}

describe('experiment transition graph', () => {
  it('allows only the documented moves', () => {
    const allowed = Object.entries(EXPERIMENT_TRANSITIONS).flatMap(([from, tos]) =>
      tos.map((to) => `${from}>${to}`),
    )
    expect(allowed.sort()).toEqual(
      [
        'draft>running',
        'draft>aborted',
        'running>paused',
        'running>completed',
        'running>aborted',
        'paused>running',
        'paused>completed',
        'paused>aborted',
      ].sort(),
    )
  })

  it('refuses everything else', () => {
    expect(canTransition('draft', 'running')).toBe(true)
    expect(canTransition('draft', 'paused')).toBe(false)
    expect(canTransition('draft', 'completed')).toBe(false)
    expect(canTransition('running', 'running')).toBe(false)
    expect(canTransition('running', 'draft')).toBe(false)
    expect(canTransition('completed', 'running')).toBe(false)
    expect(canTransition('aborted', 'running')).toBe(false)
    expect(canTransition('unknown', 'running')).toBe(false)
    expect(canTransition('running', 'toString')).toBe(false)
  })
})

describe('experiment configuration', () => {
  it('gives a holdout experiment one treatment arm by default', () => {
    expect(normalizeArms('holdout', undefined)).toEqual([
      { name: 'Treatment', isControl: false, weight: 1, assetVariantId: null },
    ])
  })

  it('makes the first a/b arm the control when none is flagged', () => {
    const arms = normalizeArms('ab', [{ name: 'A' }, { name: 'B', weight: 2 }])
    expect(arms.map((arm) => [arm.name, arm.isControl, arm.weight])).toEqual([
      ['A', true, 1],
      ['B', false, 2],
    ])
  })

  it('rejects invalid arm sets', () => {
    expect(statusOf(() => normalizeArms('ab', [{ name: 'A' }]))).toBe(400)
    expect(
      statusOf(() =>
        normalizeArms('ab', [
          { name: 'A', isControl: true },
          { name: 'B', isControl: true },
        ]),
      ),
    ).toBe(400)
    expect(statusOf(() => normalizeArms('holdout', [{ name: 'A', weight: 0 }]))).toBe(400)
  })

  it('requires a real holdout for holdout experiments', () => {
    expect(resolveHoldoutRate('holdout', undefined)).toBe(0.1)
    expect(resolveHoldoutRate('ab', undefined)).toBe(0)
    expect(resolveHoldoutRate('ab', 0.05)).toBe(0.05)
    expect(statusOf(() => resolveHoldoutRate('holdout', 0.01))).toBe(400)
    expect(statusOf(() => resolveHoldoutRate('holdout', 0))).toBe(400)
    expect(statusOf(() => resolveHoldoutRate('ab', 0.01))).toBe(400)
  })
})
