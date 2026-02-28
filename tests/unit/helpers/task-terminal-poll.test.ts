import { afterEach, describe, expect, it, vi } from 'vitest'
import { pollTaskTerminalState } from '@/lib/query/hooks/run-stream/task-terminal-poll'

describe('task terminal poll parse error visibility', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns failed terminal result when non-ok response body is invalid json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('bad-gateway', {
        status: 502,
        headers: { 'content-type': 'text/plain' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const applyAndCapture = vi.fn()
    const result = await pollTaskTerminalState({
      taskId: 'task-1',
      applyAndCapture,
    })

    expect(result?.status).toBe('failed')
    expect(result?.errorMessage).toContain('invalid JSON response')
    expect(applyAndCapture).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'task-1',
      event: 'run.error',
      status: 'failed',
    }))
  })

  it('returns failed terminal result when ok response body is invalid json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const applyAndCapture = vi.fn()
    const result = await pollTaskTerminalState({
      taskId: 'task-2',
      applyAndCapture,
    })

    expect(result?.status).toBe('failed')
    expect(result?.errorMessage).toContain('task terminal poll snapshot payload: invalid JSON response')
    expect(applyAndCapture).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'task-2',
      event: 'run.error',
      status: 'failed',
    }))
  })
})
