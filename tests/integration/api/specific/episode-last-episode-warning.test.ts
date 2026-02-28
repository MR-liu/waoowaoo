import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
    novelData: { id: 'novel-1', projectId: 'project-1' },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionEpisode: {
    findUnique: vi.fn(),
  },
  novelPromotionProject: {
    update: vi.fn(async () => ({ id: 'novel-1', projectId: 'project-1' })),
  },
}))

const mediaAttachMock = vi.hoisted(() => ({
  attachMediaFieldsToProject: vi.fn(async (episode: unknown) => episode),
}))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/media/attach', () => mediaAttachMock)

describe('api specific - episode lastEpisode update warning visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.novelPromotionEpisode.findUnique.mockResolvedValue({
      id: 'episode-1',
      clips: [],
      storyboards: [],
      shots: [],
      voiceLines: [],
    })
  })

  it('episodes route returns structured warning when lastEpisodeId update fails', async () => {
    prismaMock.novelPromotionProject.update.mockRejectedValueOnce(new Error('update last episode failed'))

    const mod = await import('@/app/api/novel-promotion/[projectId]/episodes/[episodeId]/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/episodes/episode-1',
      method: 'GET',
    })

    const res = await mod.GET(req, {
      params: Promise.resolve({ projectId: 'project-1', episodeId: 'episode-1' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json() as {
      episode: { id: string }
      updateWarningCount: number
      updateWarnings: Array<{ code: string; target: string; detail: string }>
    }

    expect(body.episode.id).toBe('episode-1')
    expect(body.updateWarningCount).toBe(1)
    expect(body.updateWarnings[0]).toEqual(expect.objectContaining({
      code: 'PROJECT_LAST_EPISODE_UPDATE_FAILED',
      target: 'novelPromotionProject.lastEpisodeId',
    }))
    expect(body.updateWarnings[0].detail).toContain('update last episode failed')
  })
})
