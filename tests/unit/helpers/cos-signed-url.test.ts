import { beforeEach, describe, expect, it, vi } from 'vitest'

const infoMock = vi.hoisted(() => vi.fn())
const warnMock = vi.hoisted(() => vi.fn())
const errorMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/logging/core', () => ({
  createScopedLogger: vi.fn(() => ({
    info: infoMock,
    warn: warnMock,
    error: errorMock,
  })),
}))

describe('cos addSignedUrlsToStoryboard', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.STORAGE_TYPE = 'local'
  })

  it('logs parse failures and keeps safe defaults for malformed history/candidates', async () => {
    const { addSignedUrlsToStoryboard } = await import('@/lib/cos')

    const result = addSignedUrlsToStoryboard({
      id: 'storyboard-1',
      storyboardImageUrl: null,
      imageHistory: 'not-json',
      panels: [
        {
          id: 'panel-1',
          imageUrl: 'images/panel-1.png',
          sketchImageUrl: null,
          videoUrl: null,
          lipSyncVideoUrl: null,
          panelImageHistory: '{bad',
          candidateImages: 'broken-json',
        },
      ],
    })

    expect(result.historyCount).toBe(0)
    expect(result.panels?.[0]?.historyCount).toBe(0)
    expect(result.panels?.[0]?.candidateImages).toBe('broken-json')
    expect(warnMock).toHaveBeenCalledWith(
      '[签名URL] 解析 panel history 失败，使用默认计数 0',
      expect.objectContaining({ panelId: 'panel-1' }),
    )
    expect(warnMock).toHaveBeenCalledWith(
      '[签名URL] 解析 candidateImages 失败，保留原始值',
      expect.objectContaining({ panelId: 'panel-1' }),
    )
    expect(warnMock).toHaveBeenCalledWith(
      '[签名URL] 解析 storyboard history 失败，使用默认计数 0',
      expect.objectContaining({ storyboardId: 'storyboard-1' }),
    )
  })
})
