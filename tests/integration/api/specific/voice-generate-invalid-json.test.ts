import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.hoisted(() => ({
  requireProjectAuthLight: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionProject: {
    findUnique: vi.fn(),
  },
  novelPromotionEpisode: {
    findFirst: vi.fn(),
  },
  novelPromotionVoiceLine: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
}))

const submitTaskMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/task/submitter', () => ({
  submitTask: submitTaskMock,
}))

describe('api specific - voice-generate invalid json', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns INVALID_PARAMS for malformed body and does not touch db/task submission', async () => {
    const mod = await import('@/app/api/novel-promotion/[projectId]/voice-generate/route')
    const req = new NextRequest('http://localhost:3000/api/novel-promotion/project-1/voice-generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(400)
    const body = await res.json() as { error?: { code?: string; message?: string } }
    expect(body.error?.code).toBe('INVALID_PARAMS')
    expect(body.error?.message).toContain('请求体必须是合法 JSON 对象')
    expect(prismaMock.novelPromotionProject.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.novelPromotionEpisode.findFirst).not.toHaveBeenCalled()
    expect(submitTaskMock).not.toHaveBeenCalled()
  })
})
