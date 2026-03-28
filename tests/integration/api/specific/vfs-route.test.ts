import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

type AuthState = { authenticated: boolean }

const authState = vi.hoisted<AuthState>(() => ({ authenticated: false }))

vi.mock('@/lib/api-auth', () => {
  const unauthorized = () =>
    new Response(
      JSON.stringify({ error: { code: 'UNAUTHORIZED' } }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )

  return {
    isErrorResponse: (value: unknown) => value instanceof Response,
    requireProjectAuthLight: async (projectId: string) => {
      if (!authState.authenticated) return unauthorized()
      return {
        session: { user: { id: 'user-1' } },
        project: { id: projectId, userId: 'user-1' },
      }
    },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

describe('VFS route', () => {
  beforeEach(() => {
    authState.authenticated = false
  })

  describe('GET /api/cg/[projectId]/vfs', () => {
    it('returns 401 when not authenticated', async () => {
      const { GET } = await import('@/app/api/cg/[projectId]/vfs/route')
      const req = buildMockRequest({
        path: '/api/cg/proj-1/vfs',
        method: 'GET',
        query: { uri: 'nexus://MYPROJ/SQ010/SH0010' },
      })
      const res = await GET(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(401)
    })

    it('returns 400 when uri param is missing', async () => {
      authState.authenticated = true
      const { GET } = await import('@/app/api/cg/[projectId]/vfs/route')
      const req = buildMockRequest({
        path: '/api/cg/proj-1/vfs',
        method: 'GET',
      })
      const res = await GET(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(400)
    })

    it('resolves a nexus URI to physical path components', async () => {
      authState.authenticated = true
      const { GET } = await import('@/app/api/cg/[projectId]/vfs/route')
      const req = buildMockRequest({
        path: '/api/cg/proj-1/vfs',
        method: 'GET',
        query: { uri: 'nexus://MYPROJ/SQ010/SH0010/anim', platform: 'linux' },
      })
      const res = await GET(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(200)

      const data = await res.json() as {
        logicalPath: string
        physicalPath: string
        components: { projectCode: string; sequenceCode: string; shotCode: string; stepCode: string }
      }
      expect(data.logicalPath).toBe('nexus://MYPROJ/SQ010/SH0010/anim')
      expect(data.physicalPath).toBe('/mnt/projects/MYPROJ/SQ010/SH0010/anim')
      expect(data.components.projectCode).toBe('MYPROJ')
      expect(data.components.sequenceCode).toBe('SQ010')
      expect(data.components.shotCode).toBe('SH0010')
      expect(data.components.stepCode).toBe('anim')
    })

    it('resolves to Windows path when platform=win32', async () => {
      authState.authenticated = true
      const { GET } = await import('@/app/api/cg/[projectId]/vfs/route')
      const req = buildMockRequest({
        path: '/api/cg/proj-1/vfs',
        method: 'GET',
        query: { uri: 'nexus://MYPROJ/SQ010', platform: 'win32' },
      })
      const res = await GET(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(200)

      const data = await res.json() as { physicalPath: string }
      expect(data.physicalPath).toBe('Z:\\Projects\\MYPROJ\\SQ010')
    })

    it('returns 400 for invalid platform', async () => {
      authState.authenticated = true
      const { GET } = await import('@/app/api/cg/[projectId]/vfs/route')
      const req = buildMockRequest({
        path: '/api/cg/proj-1/vfs',
        method: 'GET',
        query: { uri: 'nexus://MYPROJ', platform: 'solaris' },
      })
      const res = await GET(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(400)
    })

    it('returns 400 for invalid nexus URI', async () => {
      authState.authenticated = true
      const { GET } = await import('@/app/api/cg/[projectId]/vfs/route')
      const req = buildMockRequest({
        path: '/api/cg/proj-1/vfs',
        method: 'GET',
        query: { uri: 'file:///bad' },
      })
      const res = await GET(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/cg/[projectId]/vfs', () => {
    it('returns 401 when not authenticated', async () => {
      const { POST } = await import('@/app/api/cg/[projectId]/vfs/route')
      const req = buildMockRequest({
        path: '/api/cg/proj-1/vfs',
        method: 'POST',
        body: { shotCode: 'SH0010', steps: ['anim'] },
      })
      const res = await POST(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(401)
    })

    it('returns 400 when shotCode is missing', async () => {
      authState.authenticated = true
      const { POST } = await import('@/app/api/cg/[projectId]/vfs/route')
      const req = buildMockRequest({
        path: '/api/cg/proj-1/vfs',
        method: 'POST',
        body: { steps: ['anim'] },
      })
      const res = await POST(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(400)
    })

    it('returns 400 when steps is empty', async () => {
      authState.authenticated = true
      const { POST } = await import('@/app/api/cg/[projectId]/vfs/route')
      const req = buildMockRequest({
        path: '/api/cg/proj-1/vfs',
        method: 'POST',
        body: { shotCode: 'SH0010', steps: [] },
      })
      const res = await POST(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(400)
    })

    it('generates a directory tree for a shot', async () => {
      authState.authenticated = true
      const { POST } = await import('@/app/api/cg/[projectId]/vfs/route')
      const req = buildMockRequest({
        path: '/api/cg/proj-1/vfs',
        method: 'POST',
        body: { shotCode: 'SH0010', steps: ['anim', 'comp'] },
      })
      const res = await POST(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(201)

      const data = await res.json() as { directories: string[] }
      expect(data.directories).toEqual([
        'SH0010/anim/publish',
        'SH0010/anim/work',
        'SH0010/anim/caches',
        'SH0010/anim/renders',
        'SH0010/comp/publish',
        'SH0010/comp/work',
        'SH0010/comp/caches',
        'SH0010/comp/renders',
      ])
    })
  })
})
