import { describe, expect, it } from 'vitest'

import {
  MILEAGE_SERIES_API_MISSING_MESSAGE,
  mileageSeriesRequestError,
} from '~/features/mileage/client/mileageSeriesRequestError'

describe('mileageSeriesRequestError', () => {
  it('maps a router 404 to a local-api hint', () => {
    expect(
      mileageSeriesRequestError({ status: 404, error: 'not found' }, 'fallback'),
    ).toBe(MILEAGE_SERIES_API_MISSING_MESSAGE)
  })

  it('maps a bare not-found message even without a status', () => {
    expect(mileageSeriesRequestError({ message: 'not found' }, 'fallback')).toBe(
      MILEAGE_SERIES_API_MISSING_MESSAGE,
    )
  })

  it('keeps other api errors', () => {
    expect(
      mileageSeriesRequestError(
        { status: 400, message: 'Failed to create mileage series' },
        'fallback',
      ),
    ).toBe('Failed to create mileage series')
  })
})
