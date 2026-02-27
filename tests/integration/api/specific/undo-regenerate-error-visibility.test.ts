import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionPanel: {
    findUnique: vi.fn(),
    update: vi.fn(async () => ({ id: 'panel-1' })),
  },
}))

const deleteCOSObjectMock = vi.hoisted(() => vi.fn())
const resolveStorageKeyMock = vi.hoisted(() => vi.fn())
const logErrorMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/cos', () => ({
  deleteCOSObject: deleteCOSObjectMock,
}))
vi.mock('@/lib/media/service', () => ({
  resolveStorageKeyFromMediaValue: resolveStorageKeyMock,
}))
vi.mock('@/lib/logging/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logging/core')>()
  return {
    ...actual,
    logError: logErrorMock,
  }
})

describe('api specific - undo-regenerate error visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs COS deletion failure when undo panel regenerate', async () => {
    prismaMock.novelPromotionPanel.findUnique.mockResolvedValueOnce({
      id: 'panel-1',
      imageUrl: 'cos/panel-current.png',
      previousImageUrl: 'cos/panel-previous.png',
    })
    resolveStorageKeyMock.mockResolvedValueOnce('cos/panel-current.png')
    deleteCOSObjectMock.mockRejectedValueOnce(new Error('delete failed'))

    const mod = await import('@/app/api/novel-promotion/[projectId]/undo-regenerate/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/undo-regenerate',
      method: 'POST',
      body: {
        type: 'panel',
        id: 'panel-1',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('[undo-regenerate] 删除镜头当前图片失败 panelId=panel-1'),
    )
    expect(prismaMock.novelPromotionPanel.update).toHaveBeenCalledWith({
      where: { id: 'panel-1' },
      data: {
        imageUrl: 'cos/panel-previous.png',
        previousImageUrl: null,
        candidateImages: null,
      },
    })
  })
})
