import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveTaskResponse, waitForTaskResult } from '@/lib/task/client'

describe('task client json parsing contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('resolveTaskResponse throws explicit error when response body is invalid json', async () => {
    const response = new Response('not-json', {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    })

    await expect(resolveTaskResponse(response)).rejects.toThrow('resolve task response: invalid JSON response')
  })

  it('waitForTaskResult throws explicit parse error when task snapshot body is invalid json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(waitForTaskResult('task-1')).rejects.toThrow('task snapshot task-1: invalid JSON response')
  })

  it('waitForTaskResult surfaces parse error for non-ok task snapshot response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('bad-gateway', {
        status: 502,
        headers: { 'content-type': 'text/plain' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(waitForTaskResult('task-err')).rejects.toThrow(
      /Task fetch failed: task-err; task snapshot task-err: invalid JSON response/,
    )
  })

  it('resolveTaskResponse keeps async task flow and returns terminal result', async () => {
    const submitResponse = new Response(JSON.stringify({
      async: true,
      taskId: 'task-42',
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        success: true,
        task: {
          id: 'task-42',
          status: 'completed',
          result: { ok: true },
        },
      }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await resolveTaskResponse<{ ok: boolean }>(submitResponse, {
      intervalMs: 1,
      timeoutMs: 1000,
    })
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledWith('/api/tasks/task-42', expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
    }))
  })
})
