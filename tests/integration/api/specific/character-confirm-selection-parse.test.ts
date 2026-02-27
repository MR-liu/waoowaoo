import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  characterAppearance: {
    findUnique: vi.fn(),
    update: vi.fn(async () => ({ id: 'appearance-1' })),
  },
}))

const resolveStorageKeyMock = vi.hoisted(() => vi.fn())
const deleteCOSObjectMock = vi.hoisted(() => vi.fn())
const logWarnMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/media/service', () => ({
  resolveStorageKeyFromMediaValue: resolveStorageKeyMock,
}))
vi.mock('@/lib/cos', () => ({
  deleteCOSObject: deleteCOSObjectMock,
}))
vi.mock('@/lib/logging/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logging/core')>()
  return {
    ...actual,
    logWarn: logWarnMock,
  }
})

describe('api specific - character confirm-selection parse fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.characterAppearance.findUnique.mockResolvedValue({
      id: 'appearance-1',
      selectedIndex: 0,
      imageUrls: JSON.stringify(['cos/selected.png', 'cos/unselected.png']),
      descriptions: 'broken-json',
      description: 'legacy description',
      changeReason: '初始形象',
      character: { name: 'Hero' },
    })
    resolveStorageKeyMock.mockResolvedValue('cos/unselected.png')
    deleteCOSObjectMock.mockResolvedValue(undefined)
  })

  it('logs descriptions parse failure and still confirms selection', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/character/confirm-selection/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/character/confirm-selection',
      method: 'POST',
      body: {
        characterId: 'character-1',
        appearanceId: 'appearance-1',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    expect(logWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('[Character Confirm Selection] descriptions JSON parse failed appearanceId=appearance-1'),
    )
    expect(prismaMock.characterAppearance.update).toHaveBeenCalledWith({
      where: { id: 'appearance-1' },
      data: {
        imageUrl: 'cos/selected.png',
        imageUrls: JSON.stringify(['cos/selected.png']),
        selectedIndex: 0,
        description: 'legacy description',
        descriptions: JSON.stringify(['legacy description']),
      },
    })
  })
})
