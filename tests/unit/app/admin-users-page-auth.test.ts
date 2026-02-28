import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectMock = vi.hoisted(() => vi.fn())
const getServerSessionMock = vi.hoisted(() => vi.fn())
const isAdminSessionMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

vi.mock('next-auth', () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}))

vi.mock('@/lib/admin', () => ({
  isAdminSession: isAdminSessionMock,
}))

vi.mock('@/components/Navbar', () => ({
  default: () => null,
}))

vi.mock('@/app/[locale]/admin/users/AdminUsersClient', () => ({
  default: () => null,
}))

describe('admin users page auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('redirects unauthenticated user to localized signin route', async () => {
    getServerSessionMock.mockResolvedValue(null)
    isAdminSessionMock.mockReturnValue(false)

    const mod = await import('@/app/[locale]/admin/users/page')
    await mod.default({ params: Promise.resolve({ locale: 'zh' }) })

    expect(redirectMock).toHaveBeenCalledWith('/zh/auth/signin')
  })

  it('renders page for admin user without signin redirect', async () => {
    getServerSessionMock.mockResolvedValue({
      user: { id: 'admin-user', name: 'admin', isAdmin: true },
    })
    isAdminSessionMock.mockReturnValue(true)

    const mod = await import('@/app/[locale]/admin/users/page')
    const result = await mod.default({ params: Promise.resolve({ locale: 'en' }) })

    expect(redirectMock).not.toHaveBeenCalled()
    expect(result).toBeTruthy()
  })
})
