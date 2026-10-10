import { describe, expect, it } from 'vitest'

import { parseSseBlock } from '~/features/api/client/parseSseBlock'

describe('parseSseBlock', () => {
  it('reads a single data payload', () => {
    expect(parseSseBlock('data: {"entity":"inbox"}')).toEqual(['{"entity":"inbox"}'])
  })

  it('ignores comments and unnamed fields', () => {
    expect(parseSseBlock(': keep-alive\nevent: ping')).toEqual([])
  })

  it('strips the optional space after data:', () => {
    expect(parseSseBlock('data:{"entity":"inbox"}\ndata: {"type":"heartbeat"}')).toEqual([
      '{"entity":"inbox"}',
      '{"type":"heartbeat"}',
    ])
  })
})
