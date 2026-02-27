import { describe, expect, it, vi } from 'vitest'
import { readOptionalValue } from '@/lib/llm/read-optional'

describe('readOptionalValue', () => {
  it('returns read value when read succeeds', async () => {
    const onError = vi.fn()
    const result = await readOptionalValue({
      read: async () => 'ok',
      fallback: 'fallback',
      onError,
    })

    expect(result).toBe('ok')
    expect(onError).not.toHaveBeenCalled()
  })

  it('returns fallback and reports error when read throws', async () => {
    const onError = vi.fn()
    const result = await readOptionalValue({
      read: async () => {
        throw new Error('boom')
      },
      fallback: 'fallback',
      onError,
    })

    expect(result).toBe('fallback')
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })
})
