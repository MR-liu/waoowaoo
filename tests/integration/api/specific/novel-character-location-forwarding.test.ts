import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireProjectAuth: vi.fn(async (projectId: string) => ({
    session: { user: { id: 'user-1' } },
    novelData: { id: `novel-${projectId}`, projectId },
  })),
  requireProjectAuthLight: vi.fn(async (projectId: string) => ({
    session: { user: { id: 'user-1' } },
    novelData: { id: `novel-${projectId}`, projectId },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  novelPromotionCharacter: {
    create: vi.fn(async () => ({ id: 'character-1' })),
    findUnique: vi.fn(async () => ({
      id: 'character-1',
      appearances: [],
    })),
  },
  characterAppearance: {
    create: vi.fn(async () => ({ id: 'appearance-1' })),
  },
  novelPromotionLocation: {
    create: vi.fn(async () => ({ id: 'location-1' })),
    findUnique: vi.fn(async () => ({
      id: 'location-1',
      name: 'Old Town',
      images: [],
    })),
  },
  locationImage: {
    create: vi.fn(async () => ({ id: 'image-1' })),
  },
  novelPromotionProject: {
    update: vi.fn(async () => ({ id: 'novel-project-1' })),
  },
}))

const envMock = vi.hoisted(() => ({
  getBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/env', () => envMock)

describe('api specific - novel character/location POST forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('character route forwards locale and strips meta before calling generate-character-image', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('@/app/api/novel-promotion/[projectId]/character/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/character',
      method: 'POST',
      headers: { 'accept-language': 'zh-CN,zh;q=0.9' },
      body: {
        name: 'Hero',
        description: '冷静，黑发',
        meta: { locale: 'zh', injected: 'should-not-forward' },
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const calledUrl = fetchMock.mock.calls[0]?.[0]
    const calledInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(String(calledUrl)).toContain('/api/novel-promotion/project-1/generate-character-image')
    expect((calledInit?.headers as Record<string, string>)['Accept-Language']).toBe('zh-CN,zh;q=0.9')

    const rawBody = calledInit?.body
    expect(typeof rawBody).toBe('string')
    const forwarded = JSON.parse(String(rawBody)) as {
      locale?: string
      meta?: Record<string, unknown>
      characterId?: string
      appearanceIndex?: number
      injected?: unknown
    }

    expect(forwarded.characterId).toBe('character-1')
    expect(forwarded.appearanceIndex).toBe(0)
    expect(forwarded.locale).toBe('zh')
    expect(forwarded.meta).toBeUndefined()
    expect(forwarded.injected).toBeUndefined()
  })

  it('location route forwards locale and strips meta before calling generate-image', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('@/app/api/novel-promotion/[projectId]/location/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/location',
      method: 'POST',
      headers: { 'accept-language': 'zh-CN,zh;q=0.9' },
      body: {
        name: 'Old Town',
        description: '夜景老城',
        summary: '夜景老城',
        meta: { locale: 'zh', injected: 'should-not-forward' },
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)

    const calledUrl = fetchMock.mock.calls[0]?.[0]
    const calledInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(String(calledUrl)).toContain('/api/novel-promotion/project-1/generate-image')
    expect((calledInit?.headers as Record<string, string>)['Accept-Language']).toBe('zh-CN,zh;q=0.9')

    const rawBody = calledInit?.body
    expect(typeof rawBody).toBe('string')
    const forwarded = JSON.parse(String(rawBody)) as {
      type?: string
      id?: string
      locale?: string
      meta?: Record<string, unknown>
      injected?: unknown
    }

    expect(forwarded.type).toBe('location')
    expect(forwarded.id).toBe('location-1')
    expect(forwarded.locale).toBe('zh')
    expect(forwarded.meta).toBeUndefined()
    expect(forwarded.injected).toBeUndefined()
  })

  it('returns unauthorized when project auth fails', async () => {
    authMock.requireProjectAuth.mockResolvedValueOnce(
      NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }),
    )
    const mod = await import('@/app/api/novel-promotion/[projectId]/character/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/character',
      method: 'POST',
      body: { name: 'Hero' },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(401)
  })

  it('character route returns structured trigger warning when background generation trigger fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('character trigger failed')
    })
    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('@/app/api/novel-promotion/[projectId]/character/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/character',
      method: 'POST',
      body: {
        name: 'Hero',
        description: '冷静，黑发',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      success: boolean
      triggerWarningCount: number
      triggerWarnings: Array<{
        code: string
        target: string
        detail: string
      }>
    }
    expect(body.success).toBe(true)
    expect(body.triggerWarningCount).toBe(1)
    expect(body.triggerWarnings[0]).toEqual(expect.objectContaining({
      code: 'BACKGROUND_TRIGGER_FAILED',
      target: 'novel-promotion.generate-character-image',
    }))
    expect(body.triggerWarnings[0].detail).toContain('character trigger failed')
  })

  it('location route returns structured trigger warning when background generation returns non-ok status', async () => {
    const fetchMock = vi.fn(async () => new Response('queue unavailable', { status: 502 }))
    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('@/app/api/novel-promotion/[projectId]/location/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/location',
      method: 'POST',
      body: {
        name: 'Old Town',
        description: '夜景老城',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      success: boolean
      triggerWarningCount: number
      triggerWarnings: Array<{
        code: string
        target: string
        status?: number
      }>
    }
    expect(body.success).toBe(true)
    expect(body.triggerWarningCount).toBe(1)
    expect(body.triggerWarnings[0]).toEqual(expect.objectContaining({
      code: 'BACKGROUND_TRIGGER_FAILED',
      target: 'novel-promotion.generate-image',
      status: 502,
    }))
  })
})
