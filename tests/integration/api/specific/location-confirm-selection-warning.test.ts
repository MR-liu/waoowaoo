import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const txMock = vi.hoisted(() => ({
  locationImage: {
    deleteMany: vi.fn(async () => ({ count: 1 })),
    update: vi.fn(async () => ({ id: 'img-1' })),
  },
  novelPromotionLocation: {
    update: vi.fn(async () => ({ id: 'location-1' })),
  },
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionLocation: {
    findUnique: vi.fn(),
  },
  $transaction: vi.fn(async (callback: (tx: typeof txMock) => Promise<void>) => {
    await callback(txMock)
  }),
}))

const resolveStorageKeyMock = vi.hoisted(() => vi.fn())
const deleteCOSObjectMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/media/service', () => ({
  resolveStorageKeyFromMediaValue: resolveStorageKeyMock,
}))
vi.mock('@/lib/cos', () => ({
  deleteCOSObject: deleteCOSObjectMock,
}))

describe('api specific - location confirm-selection warning visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.novelPromotionLocation.findUnique.mockResolvedValue({
      id: 'location-1',
      name: 'Scene A',
      selectedImageId: 'img-1',
      images: [
        { id: 'img-1', imageUrl: 'cos://selected', isSelected: true, imageIndex: 0 },
        { id: 'img-2', imageUrl: 'cos://candidate', isSelected: false, imageIndex: 1 },
      ],
    })
    resolveStorageKeyMock.mockResolvedValue('candidate-key')
    deleteCOSObjectMock.mockRejectedValue(new Error('cos delete failed'))
  })

  it('returns structured cleanup warning when deleting unselected location image fails', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/location/confirm-selection/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/location/confirm-selection',
      method: 'POST',
      body: {
        locationId: 'location-1',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      success: boolean
      deletedCount: number
      cleanupWarningCount: number
      cleanupWarnings: Array<{ code: string; target: string; detail: string }>
    }
    expect(body.success).toBe(true)
    expect(body.deletedCount).toBe(0)
    expect(body.cleanupWarningCount).toBe(1)
    expect(body.cleanupWarnings[0]).toEqual(expect.objectContaining({
      code: 'LOCATION_CONFIRM_SELECTION_DELETE_COS_FAILED',
      target: 'locationImage:img-2',
    }))
    expect(body.cleanupWarnings[0].detail).toContain('cos delete failed')
  })
})
