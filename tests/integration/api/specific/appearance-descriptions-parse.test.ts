import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  requireUserAuth: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  characterAppearance: {
    findUnique: vi.fn(),
    update: vi.fn(async () => ({ id: 'appearance-1' })),
  },
  globalCharacter: {
    findUnique: vi.fn(),
  },
  globalCharacterAppearance: {
    findFirst: vi.fn(),
    update: vi.fn(async () => ({ id: 'g-appearance-1' })),
  },
}))

const logWarnMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/logging/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logging/core')>()
  return {
    ...actual,
    logWarn: logWarnMock,
  }
})

describe('api specific - appearance description parse fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('novel update-appearance logs parse failure and falls back to single description', async () => {
    prismaMock.characterAppearance.findUnique.mockResolvedValueOnce({
      id: 'appearance-1',
      descriptions: 'not-json',
      description: 'old description',
    })

    const mod = await import('@/app/api/novel-promotion/[projectId]/update-appearance/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/update-appearance',
      method: 'POST',
      body: {
        characterId: 'character-1',
        appearanceId: 'appearance-1',
        newDescription: ' new description ',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    expect(logWarnMock).toHaveBeenCalledWith(expect.stringContaining('[Update Appearance] descriptions JSON parse failed'))
    expect(prismaMock.characterAppearance.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'appearance-1' },
      data: {
        descriptions: JSON.stringify(['new description']),
        description: 'new description',
      },
    }))
  })

  it('asset-hub appearance PATCH logs parse failure and falls back to single description', async () => {
    prismaMock.globalCharacter.findUnique.mockResolvedValueOnce({
      id: 'character-1',
      userId: 'user-1',
    })
    prismaMock.globalCharacterAppearance.findFirst.mockResolvedValueOnce({
      id: 'g-appearance-1',
      descriptions: 'broken-json',
      description: 'legacy description',
    })

    const mod = await import('@/app/api/asset-hub/characters/[characterId]/appearances/[appearanceIndex]/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/characters/character-1/appearances/0',
      method: 'PATCH',
      body: {
        description: ' updated description ',
      },
    })

    const res = await mod.PATCH(req, {
      params: Promise.resolve({ characterId: 'character-1', appearanceIndex: '0' }),
    })
    expect(res.status).toBe(200)
    expect(logWarnMock).toHaveBeenCalledWith(expect.stringContaining('[AssetHub Appearance] descriptions JSON parse failed'))
    expect(prismaMock.globalCharacterAppearance.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'g-appearance-1' },
      data: expect.objectContaining({
        descriptions: JSON.stringify(['updated description']),
        description: 'updated description',
      }),
    }))
  })
})
