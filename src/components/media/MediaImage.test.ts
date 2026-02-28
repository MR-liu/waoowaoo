import { describe, expect, it } from 'vitest'
import { shouldDisableNextImageOptimization } from './MediaImage'

describe('MediaImage', () => {
  it('disables next/image optimization for stable /m route', () => {
    expect(shouldDisableNextImageOptimization('/m/public-image-id')).toBe(true)
  })

  it('keeps optimization for non-/m url', () => {
    expect(shouldDisableNextImageOptimization('/api/files/images/a.png')).toBe(false)
    expect(shouldDisableNextImageOptimization('https://example.com/a.png')).toBe(false)
  })
})
