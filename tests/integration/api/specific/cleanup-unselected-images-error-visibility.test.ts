import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuth: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
    novelData: { id: 'novel-1' },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  characterAppearance: {
    findMany: vi.fn(),
    update: vi.fn(async () => ({ id: 'appearance-1' })),
  },
  novelPromotionLocation: {
    findMany: vi.fn(),
    update: vi.fn(async () => ({ id: 'location-1' })),
  },
  locationImage: {
    delete: vi.fn(async () => ({ id: 'img-1' })),
    update: vi.fn(async () => ({ id: 'img-0' })),
  },
}))

const deleteCOSObjectMock = vi.hoisted(() => vi.fn())
const resolveStorageKeyMock = vi.hoisted(() => vi.fn())
const logWarnMock = vi.hoisted(() => vi.fn())

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
    logWarn: logWarnMock,
  }
})

describe('api specific - cleanup-unselected-images error visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.characterAppearance.findMany.mockResolvedValue([
      {
        id: 'appearance-1',
        selectedIndex: 0,
        imageUrls: JSON.stringify(['cos/selected.png', 'cos/unselected.png']),
      },
    ])
    prismaMock.novelPromotionLocation.findMany.mockResolvedValue([])
    resolveStorageKeyMock.mockResolvedValue('cos/unselected.png')
    deleteCOSObjectMock.mockRejectedValue(new Error('delete failed'))
  })

  it('continues cleanup and logs warning when COS deletion fails', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/cleanup-unselected-images/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/cleanup-unselected-images',
      method: 'POST',
      body: {},
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; deletedCount: number }
    expect(body.success).toBe(true)
    expect(logWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('[Cleanup Unselected] 删除角色候选图失败 appearanceId=appearance-1'),
    )
    expect(prismaMock.characterAppearance.update).toHaveBeenCalledWith({
      where: { id: 'appearance-1' },
      data: {
        imageUrls: JSON.stringify(['cos/selected.png']),
        selectedIndex: 0,
      },
    })
  })
})
