import { describe, expect, it } from 'vitest'
import { buildStableImageSourceKey } from './MediaImageWithLoading'

describe('MediaImageWithLoading', () => {
  it('normalizes /m route key by path', () => {
    expect(buildStableImageSourceKey('/m/public-id?foo=1')).toBe('/m/public-id')
  })

  it('normalizes /api/cos/sign key and removes volatile params', () => {
    expect(
      buildStableImageSourceKey('/api/cos/sign?key=images%2Fa.png&Expires=123456'),
    ).toBe('/api/cos/sign?key=images%2Fa.png')
  })

  it('drops cloud signature query to prevent equivalent url flicker', () => {
    expect(
      buildStableImageSourceKey('https://cdn.example.com/images/a.png?q-sign-algorithm=sha1&q-signature=abc'),
    ).toBe('https://cdn.example.com/images/a.png')
  })
})
