import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const hashMock = vi.hoisted(() => vi.fn(async () => 'hashed-password'))
const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))
const logInfoMock = vi.hoisted(() => vi.fn())
const logWarnMock = vi.hoisted(() => vi.fn())

vi.mock('bcryptjs', () => ({
  default: {
    hash: hashMock,
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}))

vi.mock('@/lib/logging/core', () => ({
  logInfo: logInfoMock,
  logWarn: logWarnMock,
}))

describe('admin bootstrap', () => {
  const envBackup = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...envBackup }
  })

  afterEach(() => {
    process.env = { ...envBackup }
  })

  it('creates admin user from env when account does not exist', async () => {
    process.env.ADMIN_USERNAME = 'root-admin'
    process.env.ADMIN_PASSWORD = 'StrongPass123'
    prismaMock.user.findUnique.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue({ id: 'admin-id' })

    const mod = await import('@/lib/admin')
    await mod.ensureAdminUser()

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { name: 'root-admin' },
      select: { id: true, password: true },
    })
    expect(hashMock).toHaveBeenCalledWith('StrongPass123', 12)
    expect(prismaMock.user.create).toHaveBeenCalledWith({
      data: {
        name: 'root-admin',
        password: 'hashed-password',
      },
      select: { id: true },
    })
  })

  it('throws when admin username/password env is partially configured', async () => {
    process.env.ADMIN_USERNAME = 'root-admin'
    delete process.env.ADMIN_PASSWORD

    const mod = await import('@/lib/admin')
    await expect(mod.ensureAdminUser()).rejects.toThrow('ADMIN_USERNAME and ADMIN_PASSWORD must be configured together')
  })

  it('matches admin usernames from both primary and whitelist env', async () => {
    process.env.ADMIN_USERNAME = 'primary-admin'
    process.env.ADMIN_USERNAMES = 'ops-admin,qa-admin'

    const mod = await import('@/lib/admin')

    expect(mod.isAdminUsername('primary-admin')).toBe(true)
    expect(mod.isAdminUsername('ops-admin')).toBe(true)
    expect(mod.isAdminUsername('qa-admin')).toBe(true)
    expect(mod.isAdminUsername('normal-user')).toBe(false)
  })
})
