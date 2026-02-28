import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireUserAuth: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  project: {
    findUnique: vi.fn(),
    update: vi.fn(async () => ({ id: 'project-1' })),
  },
  novelPromotionProject: {
    findUnique: vi.fn(),
  },
}))

const cosMock = vi.hoisted(() => ({
  addSignedUrlsToProject: vi.fn((project: unknown) => project),
}))

const mediaAttachMock = vi.hoisted(() => ({
  attachMediaFieldsToProject: vi.fn(async (project: unknown) => project),
}))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/cos', () => cosMock)
vi.mock('@/lib/media/attach', () => mediaAttachMock)

describe('api specific - project activity update warning visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.project.findUnique.mockResolvedValue({
      id: 'project-1',
      userId: 'user-1',
      name: 'Demo',
      user: { id: 'user-1' },
    })
  })

  it('projects route returns structured warning when lastAccessedAt update fails', async () => {
    prismaMock.project.update.mockRejectedValueOnce(new Error('update project activity failed'))

    const mod = await import('@/app/api/projects/[projectId]/route')
    const req = buildMockRequest({
      path: '/api/projects/project-1',
      method: 'GET',
    })

    const res = await mod.GET(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      project: { id: string }
      updateWarningCount: number
      updateWarnings: Array<{ code: string; target: string; detail: string }>
    }

    expect(body.project.id).toBe('project-1')
    expect(body.updateWarningCount).toBe(1)
    expect(body.updateWarnings[0]).toEqual(expect.objectContaining({
      code: 'PROJECT_LAST_ACCESSED_UPDATE_FAILED',
      target: 'project.lastAccessedAt',
    }))
    expect(body.updateWarnings[0].detail).toContain('update project activity failed')
  })

  it('project data route returns structured warning when lastAccessedAt update fails', async () => {
    prismaMock.project.update.mockRejectedValueOnce(new Error('update project data activity failed'))
    prismaMock.novelPromotionProject.findUnique.mockResolvedValue({
      id: 'novel-1',
      projectId: 'project-1',
      episodes: [],
      characters: [],
      locations: [],
    })

    const mod = await import('@/app/api/projects/[projectId]/data/route')
    const req = buildMockRequest({
      path: '/api/projects/project-1/data',
      method: 'GET',
    })

    const res = await mod.GET(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      project: { id: string }
      updateWarningCount: number
      updateWarnings: Array<{ code: string; target: string; detail: string }>
    }

    expect(body.project.id).toBe('project-1')
    expect(body.updateWarningCount).toBe(1)
    expect(body.updateWarnings[0]).toEqual(expect.objectContaining({
      code: 'PROJECT_LAST_ACCESSED_UPDATE_FAILED',
      target: 'project.lastAccessedAt',
    }))
    expect(body.updateWarnings[0].detail).toContain('update project data activity failed')
  })
})
