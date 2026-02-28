import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextResponse } from 'next/server'
import { buildMockRequest } from '../../helpers/request'
import { getInternalLLMStreamCallbacks } from '@/lib/llm-observe/internal-stream-context'

const publishTaskEventMock = vi.hoisted(() => vi.fn(async () => undefined))
const publishTaskStreamEventMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/lib/task/publisher', () => ({
  publishTaskEvent: publishTaskEventMock,
  publishTaskStreamEvent: publishTaskStreamEventMock,
}))

import { apiHandler } from '@/lib/api-errors'

function buildInternalStreamHeaders() {
  return {
    'x-internal-task-stream': '1',
    'x-internal-task-id': 'task-1',
    'x-internal-project-id': 'project-1',
    'x-internal-user-id': 'user-1',
    'x-internal-task-type': 'story_to_script_run',
  }
}

describe('api handler internal stream callbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.INTERNAL_TASK_TOKEN = ''
  })

  it('returns INTERNAL_ERROR when internal progress event publish fails', async () => {
    publishTaskEventMock.mockRejectedValueOnce(new Error('stream publish failure'))

    const route = apiHandler(async () => {
      const callbacks = getInternalLLMStreamCallbacks()
      callbacks?.onStage?.({
        stage: 'streaming',
        provider: 'ark',
        step: { id: 'step-1', index: 1, total: 1 },
      })
      return NextResponse.json({ success: true })
    })

    const req = buildMockRequest({
      path: '/api/test',
      method: 'POST',
      headers: buildInternalStreamHeaders(),
      body: {},
    })

    const response = await route(req, { params: Promise.resolve({}) })
    const body = await response.json() as {
      success: boolean
      error?: { code?: string; message?: string }
      code?: string
      message?: string
    }

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error?.code || body.code).toBe('INTERNAL_ERROR')
    expect(String(body.error?.message || body.message || '')).toContain('stream publish failure')
  })

  it('returns INTERNAL_ERROR when internal stream chunk publish fails', async () => {
    publishTaskStreamEventMock.mockRejectedValueOnce(new Error('chunk publish failure'))

    const route = apiHandler(async () => {
      const callbacks = getInternalLLMStreamCallbacks()
      callbacks?.onChunk?.({
        kind: 'text',
        delta: 'hello',
        seq: 1,
        lane: 'main',
        step: { id: 'step-1', index: 1, total: 1 },
      })
      return NextResponse.json({ success: true })
    })

    const req = buildMockRequest({
      path: '/api/test',
      method: 'POST',
      headers: buildInternalStreamHeaders(),
      body: {},
    })

    const response = await route(req, { params: Promise.resolve({}) })
    const body = await response.json() as {
      success: boolean
      error?: { code?: string; message?: string }
      code?: string
      message?: string
    }

    expect(response.status).toBe(500)
    expect(body.success).toBe(false)
    expect(body.error?.code || body.code).toBe('INTERNAL_ERROR')
    expect(String(body.error?.message || body.message || '')).toContain('chunk publish failure')
  })
})
