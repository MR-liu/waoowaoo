import { beforeEach, describe, expect, it, vi } from 'vitest'

const redirectMock = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}))

describe('auth signup page redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('redirects signup route to localized signin route', async () => {
    const mod = await import('@/app/[locale]/auth/signup/page')
    await mod.default({ params: Promise.resolve({ locale: 'en' }) })
    expect(redirectMock).toHaveBeenCalledWith('/en/auth/signin')
  })
})
