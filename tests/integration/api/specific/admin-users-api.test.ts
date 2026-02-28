import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const requireUserAuthMock = vi.hoisted(() => vi.fn())
const isErrorResponseMock = vi.hoisted(() => vi.fn(() => false))
const isAdminSessionMock = vi.hoisted(() => vi.fn())
const isAdminUsernameMock = vi.hoisted(() => vi.fn((name: string) => name === 'admin'))
const hashMock = vi.hoisted(() => vi.fn(async () => 'hashed-password'))

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/api-auth', () => ({
  requireUserAuth: requireUserAuthMock,
  isErrorResponse: isErrorResponseMock,
}))

vi.mock('@/lib/admin', () => ({
  isAdminSession: isAdminSessionMock,
  isAdminUsername: isAdminUsernameMock,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: hashMock,
  },
}))

describe('api specific - admin users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireUserAuthMock.mockResolvedValue({
      session: {
        user: {
          id: 'admin-id',
          name: 'admin',
          isAdmin: true,
        },
      },
    })
    isErrorResponseMock.mockReturnValue(false)
    isAdminSessionMock.mockReturnValue(true)
  })

  it('returns forbidden when requester is not admin', async () => {
    isAdminSessionMock.mockReturnValue(false)
    const mod = await import('@/app/api/admin/users/route')
    const req = buildMockRequest({
      path: '/api/admin/users',
      method: 'GET',
    })

    const res = await mod.GET(req, { params: Promise.resolve({}) })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error?.code).toBe('FORBIDDEN')
    expect(body.error?.details?.errorCode).toBe('ADMIN_REQUIRED')
  })

  it('returns users list for admin requester', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'u-1',
        name: 'admin',
        createdAt: new Date('2026-02-01T00:00:00.000Z'),
        updatedAt: new Date('2026-02-01T00:00:00.000Z'),
      },
      {
        id: 'u-2',
        name: 'member',
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
        updatedAt: new Date('2026-02-02T00:00:00.000Z'),
      },
    ])
    const mod = await import('@/app/api/admin/users/route')
    const req = buildMockRequest({
      path: '/api/admin/users',
      method: 'GET',
    })

    const res = await mod.GET(req, { params: Promise.resolve({}) })
    const body = await res.json() as {
      users: Array<{ id: string; name: string; isAdmin: boolean }>
    }

    expect(res.status).toBe(200)
    expect(body.users).toHaveLength(2)
    expect(body.users[0]).toEqual(expect.objectContaining({ id: 'u-1', name: 'admin', isAdmin: true }))
    expect(body.users[1]).toEqual(expect.objectContaining({ id: 'u-2', name: 'member', isAdmin: false }))
  })

  it('creates user with hashed password for admin requester', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({
      id: 'u-new',
      name: 'new-user',
      createdAt: new Date('2026-02-03T00:00:00.000Z'),
      updatedAt: new Date('2026-02-03T00:00:00.000Z'),
    })

    const mod = await import('@/app/api/admin/users/route')
    const req = buildMockRequest({
      path: '/api/admin/users',
      method: 'POST',
      body: {
        name: 'new-user',
        password: 'StrongPass123',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({}) })
    const body = await res.json() as {
      user: { id: string; name: string; isAdmin: boolean }
    }

    expect(res.status).toBe(201)
    expect(hashMock).toHaveBeenCalledWith('StrongPass123', 12)
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        name: 'new-user',
        password: 'hashed-password',
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    expect(body.user).toEqual(expect.objectContaining({
      id: 'u-new',
      name: 'new-user',
      isAdmin: false,
    }))
  })

  it('resets password for target user via patch endpoint', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u-1',
      name: 'member',
      createdAt: new Date('2026-02-03T00:00:00.000Z'),
      updatedAt: new Date('2026-02-03T00:00:00.000Z'),
    })
    prismaMock.user.update.mockResolvedValue({
      id: 'u-1',
      name: 'member',
      createdAt: new Date('2026-02-03T00:00:00.000Z'),
      updatedAt: new Date('2026-02-04T00:00:00.000Z'),
    })

    const mod = await import('@/app/api/admin/users/[userId]/route')
    const req = buildMockRequest({
      path: '/api/admin/users/u-1',
      method: 'PATCH',
      body: {
        password: 'NextPass123',
      },
    })

    const res = await mod.PATCH(req, { params: Promise.resolve({ userId: 'u-1' }) })
    const body = await res.json() as {
      success: boolean
      user: { id: string; name: string }
    }

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(hashMock).toHaveBeenCalledWith('NextPass123', 12)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'u-1' },
      data: { password: 'hashed-password' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  })
})
