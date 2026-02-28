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

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

describe('api specific - character appearance parse contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.characterAppearance.findUnique.mockResolvedValue({
      id: 'appearance-1',
      characterId: 'character-1',
      descriptions: 'broken-json',
      character: {
        novelPromotionProject: {
          projectId: 'project-1',
        },
      },
    })
  })

  it('returns INTERNAL_ERROR when descriptions json is invalid', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/character/appearance/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/character/appearance',
      method: 'PATCH',
      body: {
        characterId: 'character-1',
        appearanceId: 'appearance-1',
        description: 'new description',
      },
    })

    const res = await mod.PATCH(req, {
      params: Promise.resolve({ projectId: 'project-1' }),
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
    expect(body.error.details.appearanceId).toBe('appearance-1')
    expect(prismaMock.characterAppearance.update).not.toHaveBeenCalled()
  })
})
