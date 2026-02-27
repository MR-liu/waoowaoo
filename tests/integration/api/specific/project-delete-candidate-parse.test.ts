import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireUserAuth: vi.fn(async () => ({
    session: { user: { id: 'user-1', name: 'Tester' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
    delete: vi.fn(async () => ({ id: 'project-1' })),
    update: vi.fn(async () => ({ id: 'project-1' })),
  },
  novelPromotionProject: {
    findUnique: vi.fn(),
  },
}))

const deleteCOSObjectsMock = vi.hoisted(() => vi.fn(async () => ({ success: 0, failed: 0 })))
const resolveStorageKeyMock = vi.hoisted(() => vi.fn(async () => null))
const logErrorMock = vi.hoisted(() => vi.fn())
const logProjectActionMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/cos', () => ({
  addSignedUrlsToProject: vi.fn((project: unknown) => project),
  deleteCOSObjects: deleteCOSObjectsMock,
}))
vi.mock('@/lib/media/service', () => ({
  resolveStorageKeyFromMediaValue: resolveStorageKeyMock,
}))
vi.mock('@/lib/logging/semantic', () => ({
  logProjectAction: logProjectActionMock,
}))
vi.mock('@/lib/logging/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logging/core')>()
  return {
    ...actual,
    logError: logErrorMock,
  }
})

describe('api specific - project delete candidate parse error visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'Demo',
      user: { id: 'user-1' },
    })
    prismaMock.novelPromotionProject.findUnique.mockResolvedValue({
      characters: [],
      locations: [],
      episodes: [
        {
          audioUrl: null,
          storyboards: [
            {
              id: 'storyboard-1',
              storyboardImageUrl: null,
              candidateImages: 'broken-json',
              panels: [],
            },
          ],
        },
      ],
    })
  })

  it('logs candidateImages parse failure and still deletes project', async () => {
    const mod = await import('@/app/api/projects/[projectId]/route')
    const req = buildMockRequest({
      path: '/api/projects/project-1',
      method: 'DELETE',
      body: {},
    })

    const res = await mod.DELETE(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean; cosFilesDeleted: number; cosFilesFailed: number }
    expect(body.success).toBe(true)
    expect(logErrorMock).toHaveBeenCalledWith(
      expect.stringContaining('[Project project-1] 解析候选图失败 storyboardId=storyboard-1'),
    )
    expect(prismaMock.project.delete).toHaveBeenCalledWith({ where: { id: 'project-1' } })
    expect(logProjectActionMock).toHaveBeenCalled()
  })
})
