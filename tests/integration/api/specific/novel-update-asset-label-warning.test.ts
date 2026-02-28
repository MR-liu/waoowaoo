import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionCharacter: {
    findUnique: vi.fn(),
  },
  characterAppearance: {
    update: vi.fn(async () => ({ id: 'appearance-1' })),
  },
}))

const fontMock = vi.hoisted(() => ({
  initializeFonts: vi.fn(async () => undefined),
  createLabelSVG: vi.fn(async () => '<svg/>'),
}))

const cosMock = vi.hoisted(() => ({
  uploadToCOS: vi.fn(),
  getSignedUrl: vi.fn(() => 'signed-url'),
  toFetchableUrl: vi.fn((value: string) => value),
  generateUniqueKey: vi.fn(() => 'new-key'),
}))

const mediaServiceMock = vi.hoisted(() => ({
  resolveStorageKeyFromMediaValue: vi.fn(async () => null),
}))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/fonts', () => fontMock)
vi.mock('@/lib/cos', () => cosMock)
vi.mock('@/lib/media/service', () => mediaServiceMock)

describe('api specific - novel update-asset-label warning visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.novelPromotionCharacter.findUnique.mockResolvedValue({
      id: 'character-1',
      appearances: [
        {
          id: 'appearance-1',
          appearanceIndex: 0,
          changeReason: '默认形象',
          imageUrls: null,
          imageUrl: 'cos://image-1',
        },
      ],
    })
  })

  it('returns structured warning when character image label update fails', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/update-asset-label/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/update-asset-label',
      method: 'POST',
      body: {
        type: 'character',
        id: 'character-1',
        newName: '新角色名',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      success: boolean
      labelWarningCount: number
      labelWarnings: Array<{ code: string; target: string; detail: string }>
      results: Array<{ imageUrls: string[] }>
    }

    expect(body.success).toBe(true)
    expect(body.labelWarningCount).toBe(1)
    expect(body.labelWarnings[0]).toEqual(expect.objectContaining({
      code: 'NOVEL_ASSET_LABEL_UPDATE_FAILED',
      target: 'characterAppearance:appearance-1:image:0',
    }))
    expect(body.labelWarnings[0].detail).toContain('无法归一化媒体 key')
    expect(body.results[0]?.imageUrls?.[0]).toBe('cos://image-1')
    expect(prismaMock.characterAppearance.update).toHaveBeenCalledTimes(1)
  })
})
