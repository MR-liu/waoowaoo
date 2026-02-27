import { beforeEach, describe, expect, it, vi } from 'vitest'

const logInfoMock = vi.hoisted(() => vi.fn())
const logErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logging/core', () => ({
  logInfo: logInfoMock,
  logError: logErrorMock,
}))

describe('async-submit queryFalStatus', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns failed result and logs parse error when 422 result body is invalid json', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response('not-json', { status: 422 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { queryFalStatus } = await import('@/lib/async-submit')
    const result = await queryFalStatus('fal-ai/veo3.1/fast/image-to-video', 'req-1', 'api-key')

    expect(result).toEqual({
      status: 'COMPLETED',
      completed: true,
      failed: true,
      error: '无法获取结果',
    })
    expect(logErrorMock).toHaveBeenCalledWith(expect.stringContaining('[FAL Status] 422错误体 JSON解析失败'))
  })

  it('returns failed result and logs parse error when 500 result body is invalid json', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response('invalid-json', { status: 500 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const { queryFalStatus } = await import('@/lib/async-submit')
    const result = await queryFalStatus('fal-ai/veo3.1/fast/image-to-video', 'req-2', 'api-key')

    expect(result).toEqual({
      status: 'COMPLETED',
      completed: true,
      failed: true,
      error: '下游服务错误',
    })
    expect(logErrorMock).toHaveBeenCalledWith(expect.stringContaining('[FAL Status] 500错误体 JSON解析失败'))
  })
})
