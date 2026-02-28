import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  characterAppearance: {
    findUnique: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(async () => ({ id: 'appearance-1' })),
    findMany: vi.fn(async () => []),
    update: vi.fn(async () => ({ id: 'appearance-1' })),
  },
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

describe('api specific - character appearance delete warning visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.characterAppearance.count.mockResolvedValue(2)
  })

  it('returns parse warning when imageUrls contract is invalid', async () => {
    prismaMock.characterAppearance.findUnique.mockResolvedValue({
      id: 'appearance-1',
      characterId: 'character-1',
      appearanceIndex: 1,
      changeReason: '初始形象',
      imageUrl: 'cos://main',
      imageUrls: '{broken-json',
      character: { name: 'Hero' },
    })
    resolveStorageKeyMock.mockResolvedValue('main-key')
    deleteCOSObjectMock.mockResolvedValue(undefined)

    const mod = await import('@/app/api/novel-promotion/[projectId]/character/appearance/route')
    const req = new NextRequest(
      'http://localhost:3000/api/novel-promotion/project-1/character/appearance?characterId=character-1&appearanceId=appearance-1',
      { method: 'DELETE' },
    )

    const res = await mod.DELETE(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      success: boolean
      deletedImages: number
      cleanupWarningCount: number
      cleanupWarnings: Array<{ code: string; target: string }>
    }
    expect(body.success).toBe(true)
    expect(body.deletedImages).toBe(1)
    expect(body.cleanupWarningCount).toBe(1)
    expect(body.cleanupWarnings[0]).toEqual(expect.objectContaining({
      code: 'CHARACTER_APPEARANCE_IMAGE_URLS_PARSE_FAILED',
      target: 'characterAppearance:appearance-1:imageUrls',
    }))
  })

  it('returns delete warning when candidate image cleanup fails', async () => {
    prismaMock.characterAppearance.findUnique.mockResolvedValue({
      id: 'appearance-1',
      characterId: 'character-1',
      appearanceIndex: 1,
      changeReason: '初始形象',
      imageUrl: null,
      imageUrls: JSON.stringify(['cos://img-a', 'cos://img-b']),
      character: { name: 'Hero' },
    })
    resolveStorageKeyMock.mockImplementation(async (value: string) => {
      if (value === 'cos://img-a') return 'img-a'
      if (value === 'cos://img-b') return 'img-b'
      return null
    })
    deleteCOSObjectMock.mockImplementation(async (key: string) => {
      if (key === 'img-b') {
        throw new Error('cos delete failed')
      }
    })

    const mod = await import('@/app/api/novel-promotion/[projectId]/character/appearance/route')
    const req = new NextRequest(
      'http://localhost:3000/api/novel-promotion/project-1/character/appearance?characterId=character-1&appearanceId=appearance-1',
      { method: 'DELETE' },
    )

    const res = await mod.DELETE(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      success: boolean
      deletedImages: number
      cleanupWarningCount: number
      cleanupWarnings: Array<{ code: string; target: string }>
    }
    expect(body.success).toBe(true)
    expect(body.deletedImages).toBe(1)
    expect(body.cleanupWarningCount).toBe(1)
    expect(body.cleanupWarnings[0]).toEqual(expect.objectContaining({
      code: 'CHARACTER_APPEARANCE_DELETE_COS_FAILED',
      target: 'characterAppearance:appearance-1:imageUrls:1',
    }))
  })
})
