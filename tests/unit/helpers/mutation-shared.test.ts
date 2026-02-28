import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  readResponseJsonRecord,
  requestBlobWithError,
  requestJsonWithError,
  requestTaskResponseWithError,
  requestVoidWithError,
} from '@/lib/query/mutations/mutation-shared'

describe('mutation shared response parsing contract', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('throws explicit parse error when successful json mutation response is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })))

    await expect(
      requestJsonWithError('/api/test', { method: 'GET' }, '保存失败'),
    ).rejects.toThrow('保存失败; query mutation response payload: invalid JSON response')
  })

  it('attaches parseError in payload when non-ok json mutation response is invalid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('bad-gateway', { status: 502 })))

    await expect(
      requestJsonWithError('/api/test', { method: 'POST' }, '请求失败'),
    ).rejects.toMatchObject({
      status: 502,
      detail: expect.stringContaining('query mutation response payload: invalid JSON response'),
      payload: expect.objectContaining({
        parseError: expect.stringContaining('query mutation response payload: invalid JSON response'),
      }),
    })
  })

  it('surfaces parseError in task response request failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('service unavailable', { status: 503 })))

    await expect(
      requestTaskResponseWithError('/api/task', { method: 'POST' }, '任务提交失败'),
    ).rejects.toMatchObject({
      status: 503,
      detail: expect.stringContaining('query mutation task response error payload: invalid JSON response'),
    })
  })

  it('readResponseJsonRecord returns parseError for non-object json payload', async () => {
    const parsed = await readResponseJsonRecord(
      new Response(JSON.stringify(['x']), { status: 200 }),
      'unit test payload',
    )
    expect(parsed.payload).toEqual({})
    expect(parsed.parseError).toBe('unit test payload: response JSON is not an object')
  })

  it('keeps existing fallback behavior for void/blob helpers with parse errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('html-error', { status: 500 })))

    await expect(
      requestVoidWithError('/api/void', { method: 'DELETE' }, '删除失败'),
    ).rejects.toThrow('删除失败; query mutation error payload: invalid JSON response')

    await expect(
      requestBlobWithError('/api/blob', { method: 'GET' }, '下载失败'),
    ).rejects.toThrow('下载失败; query mutation blob error payload: invalid JSON response')
  })
})
