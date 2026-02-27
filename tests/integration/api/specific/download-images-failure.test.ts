import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
    project: { id: 'project-1', name: 'Project 1' },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionEpisode: {
    findUnique: vi.fn(),
  },
  novelPromotionProject: {
    findFirst: vi.fn(),
  },
}))

const resolveStorageKeyMock = vi.hoisted(() => vi.fn())
const logErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/media/service', () => ({
  resolveStorageKeyFromMediaValue: resolveStorageKeyMock,
}))
vi.mock('@/lib/cos', () => ({
  toFetchableUrl: vi.fn((url: string) => url),
  getCOSClient: vi.fn(() => ({ getObject: vi.fn() })),
}))
vi.mock('@/lib/logging/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logging/core')>()
  return {
    ...actual,
    logError: logErrorMock,
  }
})

describe('api specific - download images failure', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.novelPromotionEpisode.findUnique.mockResolvedValue({
      id: 'episode-1',
      storyboards: [
        {
          clipId: 'clip-1',
          panels: [
            {
              panelIndex: 1,
              description: '镜头1',
              imageUrl: 'https://cdn.example.com/failed.png',
            },
          ],
        },
      ],
      clips: [{ id: 'clip-1' }],
    })
    resolveStorageKeyMock.mockResolvedValue(null)
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network broken')
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns EXTERNAL_ERROR when any image file download fails', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/download-images/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/download-images',
      method: 'GET',
      query: {
        episodeId: 'episode-1',
      },
    })

    const res = await mod.GET(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBeGreaterThanOrEqual(400)
    const body = await res.json() as { error?: { code?: string; message?: string } }
    expect(body.error?.code).toBe('EXTERNAL_ERROR')
    expect(body.error?.message).toContain('图片打包失败')
    expect(logErrorMock).toHaveBeenCalledWith('Failed to download image 1:', expect.any(Error))
  })
})
