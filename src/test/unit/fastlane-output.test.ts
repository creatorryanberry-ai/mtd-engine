import { describe, expect, it } from 'vitest'

import { summarizeFastlaneFailure } from '../../../scripts/release/helpers/fastlane-output'

describe('summarizeFastlaneFailure', () => {
  it('extracts the metro resolve error from a noisy dump', () => {
    const dump = [
      'warning: something Sendable',
      'Compiling ExpoImage',
      'error Unable to resolve module expo-image-manipulator from /x/prepareReceiptImage.native.ts',
      'Error: Unable to resolve module expo-image-manipulator from /x/prepareReceiptImage.native.ts',
      'Command PhaseScriptExecution failed with a nonzero exit code',
      'ARCHIVE FAILED',
    ].join('\n')

    const summary = summarizeFastlaneFailure(dump)
    expect(summary).toContain('Unable to resolve module expo-image-manipulator')
    expect(summary).toContain('ARCHIVE FAILED')
    expect(summary).not.toContain('Sendable')
  })
})
