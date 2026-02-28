import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

describe('api specific - auth register disabled', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns forbidden with REGISTER_DISABLED error code', async () => {
    const mod = await import('@/app/api/auth/register/route')
    const req = buildMockRequest({
      path: '/api/auth/register',
      method: 'POST',
      body: {
        name: 'internal-user',
        password: '123456',
      },
    })

    const res = await mod.POST(req, { params: Promise.resolve({}) })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error?.code).toBe('FORBIDDEN')
    expect(body.error?.details?.errorCode).toBe('REGISTER_DISABLED')
    expect(body.error?.message).toBe('Registration is disabled for internal-only deployment')
  })
})
