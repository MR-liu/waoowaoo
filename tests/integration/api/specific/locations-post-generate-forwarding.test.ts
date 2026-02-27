import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { buildMockRequest } from '../../../helpers/request'

const authMock = vi.hoisted(() => ({
  requireUserAuth: vi.fn(async () => ({
    session: { user: { id: 'user-1' } },
  })),
  isErrorResponse: vi.fn((value: unknown) => value instanceof Response),
}))

const prismaMock = vi.hoisted(() => ({
  globalAssetFolder: {
    findUnique: vi.fn(),
  },
  globalLocation: {
    create: vi.fn(async () => ({ id: 'location-1', userId: 'user-1' })),
    findUnique: vi.fn(async () => ({
      id: 'location-1',
      userId: 'user-1',
      name: 'Old Town',
      summary: '夜景老城',
      images: [],
    })),
  },
  globalLocationImage: {
    createMany: vi.fn(async () => ({ count: 3 })),
  },
}))

const mediaAttachMock = vi.hoisted(() => ({
  attachMediaFieldsToGlobalLocation: vi.fn(async (value: unknown) => value),
}))

const envMock = vi.hoisted(() => ({
  getBaseUrl: vi.fn(() => 'http://localhost:3000'),
}))

vi.mock('@/lib/api-auth', () => authMock)
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/media/attach', () => mediaAttachMock)
vi.mock('@/lib/env', () => envMock)

describe('api specific - locations POST forwarding to generate-image task', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.globalAssetFolder.findUnique.mockResolvedValue(null)
  })

  it('forwards locale and strips meta payload for background generate-image request', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const mod = await import('@/app/api/asset-hub/locations/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/locations',
      method: 'POST',
      headers: {
        'accept-language': 'zh-CN,zh;q=0.9',
      },
      body: {
        name: 'Old Town',
        summary: '夜景老城',
        artStyle: 'american-comic',
        meta: { locale: 'zh', injected: 'should-not-forward' },
      },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(200)

    const calledUrl = fetchMock.mock.calls[0]?.[0]
    const calledInit = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined
    expect(String(calledUrl)).toContain('/api/asset-hub/generate-image')
    expect((calledInit?.headers as Record<string, string>)['Accept-Language']).toBe('zh-CN,zh;q=0.9')

    const rawBody = calledInit?.body
    expect(typeof rawBody).toBe('string')
    const forwarded = JSON.parse(String(rawBody)) as {
      type?: string
      id?: string
      locale?: string
      artStyle?: string
      meta?: Record<string, unknown>
      injected?: unknown
    }

    expect(forwarded.type).toBe('location')
    expect(forwarded.id).toBe('location-1')
    expect(forwarded.locale).toBe('zh')
    expect(forwarded.artStyle).toBe('american-comic')
    expect(forwarded.meta).toBeUndefined()
    expect(forwarded.injected).toBeUndefined()
  })

  it('returns unauthorized when auth fails', async () => {
    authMock.requireUserAuth.mockResolvedValueOnce(
      NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }),
    )
    const mod = await import('@/app/api/asset-hub/locations/route')
    const req = buildMockRequest({
      path: '/api/asset-hub/locations',
      method: 'POST',
      body: { name: 'Old Town' },
    })

    const res = await mod.POST(req)
    expect(res.status).toBe(401)
  })
})
