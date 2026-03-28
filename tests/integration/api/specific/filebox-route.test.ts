import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

type AuthState = { authenticated: boolean }

const authState = vi.hoisted<AuthState>(() => ({ authenticated: false }))

const prismaMock = vi.hoisted(() => ({
  productionTask: {
    findFirst: vi.fn(),
  },
  cgVersion: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}))

const cosMock = vi.hoisted(() => ({
  uploadToCOS: vi.fn(),
  generateUniqueKey: vi.fn(),
}))

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

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/cos', () => cosMock)

function buildMultipartRequest(
  path: string,
  fields: Record<string, string>,
  fileName: string,
  fileContent: string = 'binary data',
): NextRequest {
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    formData.append(key, value)
  }
  const file = new File([fileContent], fileName, { type: 'application/octet-stream' })
  formData.append('file', file)

  return new NextRequest(new URL(path, 'http://localhost:3000'), {
    method: 'POST',
    body: formData,
  })
}

describe('FileBox route', () => {
  beforeEach(() => {
    authState.authenticated = false
    vi.clearAllMocks()
    cosMock.generateUniqueKey.mockReturnValue('cg/proj-1/task-1/file-abc.ma')
    cosMock.uploadToCOS.mockResolvedValue('cg/proj-1/task-1/file-abc.ma')
  })

  describe('POST /api/cg/[projectId]/filebox', () => {
    it('returns 401 when not authenticated', async () => {
      const { POST } = await import('@/app/api/cg/[projectId]/filebox/route')
      const req = buildMultipartRequest(
        '/api/cg/proj-1/filebox',
        { productionTaskId: 'task-1' },
        'MYPROJ_SQ010_SH0010_anim_v003.ma',
      )
      const res = await POST(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(401)
    })

    it('returns 400 when productionTaskId is missing', async () => {
      authState.authenticated = true
      const { POST } = await import('@/app/api/cg/[projectId]/filebox/route')
      const req = buildMultipartRequest(
        '/api/cg/proj-1/filebox',
        {},
        'MYPROJ_SQ010_SH0010_anim_v003.ma',
      )
      const res = await POST(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(400)
    })

    it('returns 400 when filename fails validation', async () => {
      authState.authenticated = true
      const { POST } = await import('@/app/api/cg/[projectId]/filebox/route')
      const req = buildMultipartRequest(
        '/api/cg/proj-1/filebox',
        { productionTaskId: 'task-1' },
        'bad-filename.txt',
      )
      const res = await POST(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(400)

      const data = await res.json() as { error: { message: string } }
      expect(data.error.message).toContain('Filename validation failed')
    })

    it('returns 404 when production task is not found', async () => {
      authState.authenticated = true
      prismaMock.productionTask.findFirst.mockResolvedValue(null)

      const { POST } = await import('@/app/api/cg/[projectId]/filebox/route')
      const req = buildMultipartRequest(
        '/api/cg/proj-1/filebox',
        { productionTaskId: 'task-1' },
        'MYPROJ_SQ010_SH0010_anim_v003.ma',
      )
      const res = await POST(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(404)
    })

    it('uploads file, creates version, and returns 201', async () => {
      authState.authenticated = true
      prismaMock.productionTask.findFirst.mockResolvedValue({
        id: 'task-1',
        pipelineStepId: 'step-1',
      })
      prismaMock.cgVersion.findFirst.mockResolvedValue({ versionNumber: 2 })
      prismaMock.cgVersion.create.mockResolvedValue({
        id: 'ver-new',
        productionTaskId: 'task-1',
        versionNumber: 3,
        filePath: 'cg/proj-1/task-1/file-abc.ma',
        mediaPath: 'MYPROJ_SQ010_SH0010_anim_v003.ma',
        status: 'pending_review',
        createdBy: { id: 'user-1', name: 'Test', email: 'test@test.com', image: null },
      })

      const { POST } = await import('@/app/api/cg/[projectId]/filebox/route')
      const req = buildMultipartRequest(
        '/api/cg/proj-1/filebox',
        { productionTaskId: 'task-1' },
        'MYPROJ_SQ010_SH0010_anim_v003.ma',
      )
      const res = await POST(req, { params: Promise.resolve({ projectId: 'proj-1' }) })
      expect(res.status).toBe(201)

      const data = await res.json() as { version: { versionNumber: number; filePath: string } }
      expect(data.version.versionNumber).toBe(3)
      expect(data.version.filePath).toBe('cg/proj-1/task-1/file-abc.ma')

      expect(cosMock.uploadToCOS).toHaveBeenCalledWith(
        expect.any(Buffer),
        'cg/proj-1/task-1/file-abc.ma',
      )

      expect(prismaMock.cgVersion.create).toHaveBeenCalledWith({
        data: {
          productionTaskId: 'task-1',
          versionNumber: 3,
          comment: null,
          status: 'pending_review',
          filePath: 'cg/proj-1/task-1/file-abc.ma',
          mediaPath: 'MYPROJ_SQ010_SH0010_anim_v003.ma',
          createdById: 'user-1',
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      })
    })

    it('extracts version number from filename when present', async () => {
      authState.authenticated = true
      prismaMock.productionTask.findFirst.mockResolvedValue({ id: 'task-1' })
      prismaMock.cgVersion.findFirst.mockResolvedValue({ versionNumber: 10 })
      prismaMock.cgVersion.create.mockResolvedValue({
        id: 'ver-new',
        versionNumber: 7,
        createdBy: { id: 'user-1', name: 'Test', email: null, image: null },
      })

      const { POST } = await import('@/app/api/cg/[projectId]/filebox/route')
      const req = buildMultipartRequest(
        '/api/cg/proj-1/filebox',
        { productionTaskId: 'task-1' },
        'MYPROJ_SQ010_SH0010_anim_v007.ma',
      )
      await POST(req, { params: Promise.resolve({ projectId: 'proj-1' }) })

      expect(prismaMock.cgVersion.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            versionNumber: 7,
          }),
        }),
      )
    })
  })
})
