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

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

describe('api specific - appearance description parse contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('novel update-appearance returns INTERNAL_ERROR when descriptions json is invalid', async () => {
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
    expect(res.status).toBe(500)
    const body = await res.json() as {
      success: boolean
      error: {
        code: string
        message: string
        details: { appearanceId?: string }
      }
    }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toContain('descriptions contract invalid')
    expect(body.error.details.appearanceId).toBe('appearance-1')
    expect(prismaMock.characterAppearance.update).not.toHaveBeenCalled()
  })

  it('asset-hub appearance PATCH returns INTERNAL_ERROR when descriptions json is invalid', async () => {
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
    expect(res.status).toBe(500)
    const body = await res.json() as {
      success: boolean
      error: {
        code: string
        message: string
        details: { appearanceId?: string }
      }
    }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('INTERNAL_ERROR')
    expect(body.error.message).toContain('descriptions contract invalid')
    expect(body.error.details.appearanceId).toBe('g-appearance-1')
    expect(prismaMock.globalCharacterAppearance.update).not.toHaveBeenCalled()
  })
})
