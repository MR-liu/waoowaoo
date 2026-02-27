import { describe, expect, it } from 'vitest'
import { readRequestJsonObject } from '@/lib/request-json'
import { ApiError } from '@/lib/api-errors'

describe('readRequestJsonObject', () => {
  it('returns parsed object when request body is valid object json', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
      headers: { 'content-type': 'application/json' },
    })

    await expect(readRequestJsonObject(req)).resolves.toEqual({ a: 1 })
  })

  it('throws INVALID_PARAMS when request body is invalid json', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: '{bad-json',
      headers: { 'content-type': 'application/json' },
    })

    await expect(readRequestJsonObject(req)).rejects.toMatchObject({
      name: ApiError.name,
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('请求体必须是合法 JSON 对象'),
    })
  })

  it('throws INVALID_PARAMS when request body is non-object json', async () => {
    const req = new Request('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(['a', 'b']),
      headers: { 'content-type': 'application/json' },
    })

    await expect(readRequestJsonObject(req)).rejects.toMatchObject({
      name: ApiError.name,
      code: 'INVALID_PARAMS',
      message: expect.stringContaining('请求体必须是 JSON 对象'),
    })
  })
})
