import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionEpisode: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  novelPromotionProject: {
    findUnique: vi.fn(),
  },
}))

const getSignedUrlMock = vi.hoisted(() => vi.fn((key: string) => `https://signed/${key}`))
const resolveStorageKeyMock = vi.hoisted(() => vi.fn())
const logWarnMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/cos', () => ({
  getSignedUrl: getSignedUrlMock,
}))
vi.mock('@/lib/media/service', () => ({
  resolveStorageKeyFromMediaValue: resolveStorageKeyMock,
}))
vi.mock('@/lib/logging/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/logging/core')>()
  return {
    ...actual,
    logWarn: logWarnMock,
  }
})

describe('api specific - speaker-voice route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logs parse failure for corrupted speakerVoices and returns empty map', async () => {
    prismaMock.novelPromotionEpisode.findUnique.mockResolvedValue({
      id: 'episode-1',
      speakerVoices: '{broken-json',
    })

    const mod = await import('@/app/api/novel-promotion/[projectId]/speaker-voice/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/speaker-voice',
      method: 'GET',
      query: { episodeId: 'episode-1' },
    })

    const res = await mod.GET(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as { speakerVoices: Record<string, unknown> }
    expect(body.speakerVoices).toEqual({})
    expect(logWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('[Speaker Voice] speakerVoices JSON parse failed context=get episodeId=episode-1'),
    )
    expect(getSignedUrlMock).not.toHaveBeenCalled()
  })

  it('returns INVALID_PARAMS for malformed patch body with explicit message', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/speaker-voice/route')
    const req = new NextRequest('http://localhost:3000/api/novel-promotion/project-1/speaker-voice', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })

    const res = await mod.PATCH(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    const body = await res.json() as { error?: { code?: string; message?: string } }
    expect(body.error?.code).toBe('INVALID_PARAMS')
    expect(body.error?.message).toContain('请求体必须是合法 JSON 对象')
    expect(prismaMock.novelPromotionProject.findUnique).not.toHaveBeenCalled()
    expect(resolveStorageKeyMock).not.toHaveBeenCalled()
  })
})
