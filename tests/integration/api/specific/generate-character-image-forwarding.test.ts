import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
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
  novelPromotionProject: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

const envMock = vi.hoisted(() => ({
  getBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/env', () => envMock)

describe('api specific - generate-character-image forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards only explicit fields to generate-image route', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('@/app/api/novel-promotion/[projectId]/generate-character-image/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/generate-character-image',
      method: 'POST',
      headers: { 'accept-language': 'zh-CN,zh;q=0.9' },
      body: {
        characterId: 'character-1',
        appearanceId: 'appearance-1',
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
      appearanceId?: string
      locale?: string
      meta?: Record<string, unknown>
      injected?: unknown
    }

    expect(forwarded.type).toBe('character')
    expect(forwarded.id).toBe('character-1')
    expect(forwarded.appearanceId).toBe('appearance-1')
    expect(forwarded.locale).toBe('zh')
    expect(forwarded.meta).toBeUndefined()
    expect(forwarded.injected).toBeUndefined()
  })

  it('returns unauthorized when auth fails', async () => {
    authMock.requireProjectAuthLight.mockResolvedValueOnce(
      NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }),
    )
    const mod = await import('@/app/api/novel-promotion/[projectId]/generate-character-image/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/generate-character-image',
      method: 'POST',
      body: { characterId: 'character-1' },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(401)
  })

  it('returns explicit GENERATION_FAILED details when downstream generate-image fails', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({ code: 'UPSTREAM_BUSY', error: 'upstream queue busy' }),
        { status: 503 },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('@/app/api/novel-promotion/[projectId]/generate-character-image/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/generate-character-image',
      method: 'POST',
      body: {
        characterId: 'character-1',
        appearanceId: 'appearance-1',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(500)
    const body = await res.json() as {
      success: boolean
      error: {
        code: string
        message: string
        details: { upstreamStatus?: number; upstreamCode?: string }
      }
    }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('GENERATION_FAILED')
    expect(body.error.message).toContain('upstream queue busy')
    expect(body.error.details.upstreamStatus).toBe(503)
    expect(body.error.details.upstreamCode).toBe('UPSTREAM_BUSY')
  })

  it('returns GENERATION_FAILED with parse detail when downstream failure body is not valid json', async () => {
    const fetchMock = vi.fn(async () => new Response('upstream busy', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('@/app/api/novel-promotion/[projectId]/generate-character-image/route')
    const req = buildMockRequest({
      path: '/api/novel-promotion/project-1/generate-character-image',
      method: 'POST',
      body: {
        characterId: 'character-1',
        appearanceId: 'appearance-1',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({ projectId: 'project-1' }) })
    expect(res.status).toBe(500)
    const body = await res.json() as {
      success: boolean
      error: {
        code: string
        details: { upstreamStatus?: number; upstreamParseError?: string }
      }
    }
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('GENERATION_FAILED')
    expect(body.error.details.upstreamStatus).toBe(503)
    expect(body.error.details.upstreamParseError).toContain('invalid JSON response')
  })
})
