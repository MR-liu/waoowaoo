import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildMockRequest } from '../../../helpers/request'

const readFileMock = vi.hoisted(() => vi.fn())

vi.mock('fs/promises', () => ({
  readFile: readFileMock,
}))

describe('api specific - files route contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns FORBIDDEN when path traversal is detected', async () => {
    const mod = await import('@/app/api/files/[...path]/route')
    const req = buildMockRequest({
      path: '/api/files/..%2Fsecret.txt',
      method: 'GET',
    })

    const res = await mod.GET(req, {
      params: Promise.resolve({ path: ['..', 'secret.txt'] }),
    })

    expect(res.status).toBe(403)
    const body = await res.json() as { error?: { code?: string }; code?: string }
    expect(body.error?.code || body.code).toBe('FORBIDDEN')
    expect(readFileMock).not.toHaveBeenCalled()
  })

  it('returns NOT_FOUND when file does not exist', async () => {
    readFileMock.mockRejectedValueOnce({ code: 'ENOENT' })

    const mod = await import('@/app/api/files/[...path]/route')
    const req = buildMockRequest({
      path: '/api/files/missing.txt',
      method: 'GET',
    })

    const res = await mod.GET(req, {
      params: Promise.resolve({ path: ['missing.txt'] }),
    })

    expect(res.status).toBe(404)
    const body = await res.json() as { error?: { code?: string }; code?: string }
    expect(body.error?.code || body.code).toBe('NOT_FOUND')
  })

  it('returns binary file content when file exists', async () => {
    readFileMock.mockResolvedValueOnce(Buffer.from('hello'))

    const mod = await import('@/app/api/files/[...path]/route')
    const req = buildMockRequest({
      path: '/api/files/demo.txt',
      method: 'GET',
    })

    const res = await mod.GET(req, {
      params: Promise.resolve({ path: ['demo.txt'] }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('text/plain')
    expect(await res.text()).toBe('hello')
  })
})
