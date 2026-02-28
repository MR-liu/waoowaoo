import { afterEach, describe, expect, it, vi } from 'vitest'
import { readResponseJsonSafely } from '@/lib/query/hooks/run-stream/response-json'

describe('run-stream response json helper', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('parses json payload from standard Response', async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 })
    const result = await readResponseJsonSafely({
      response,
      context: 'test context',
      requestUrl: '/api/test',
      requestMethod: 'GET',
    })

    expect(result.parseError).toBeNull()
    expect(result.payload).toEqual({ ok: true })
  })

  it('supports response-like mock object without clone()', async () => {
    const responseLike = {
      status: 200,
      json: async () => ({ tasks: [{ id: 'task-1' }] }),
    } as unknown as Response

    const result = await readResponseJsonSafely({
      response: responseLike,
      context: 'response-like',
      requestUrl: '/api/tasks',
    })

    expect(result.parseError).toBeNull()
    expect(result.payload).toEqual({ tasks: [{ id: 'task-1' }] })
  })

  it('returns parseError when payload is not valid json', async () => {
    const response = new Response('not-json', { status: 500 })
    const result = await readResponseJsonSafely({
      response,
      context: 'broken payload',
      requestUrl: '/api/tasks',
    })

    expect(result.payload).toBeNull()
    expect(result.parseError).toContain('broken payload: invalid JSON response')
  })
})
