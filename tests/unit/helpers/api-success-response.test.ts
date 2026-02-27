import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { apiSuccess } from '@/lib/api-errors'

describe('api success envelope', () => {
  it('returns unified envelope and keeps top-level compatibility when flattenData=true', async () => {
    const req = new NextRequest(new URL('http://localhost/api/tasks'))
    const response = apiSuccess(
      req,
      {
        async: true,
        taskId: 'task-1',
      },
      { flattenData: true },
    )

    const body = await response.json()
    expect(body).toMatchObject({
      success: true,
      code: 'OK',
      message: 'OK',
      data: {
        async: true,
        taskId: 'task-1',
      },
      async: true,
      taskId: 'task-1',
    })
    expect(typeof body.requestId).toBe('string')
    expect(response.headers.get('x-request-id')).toBe(body.requestId)
  })

  it('does not flatten nested data when flattenData=false', async () => {
    const req = new NextRequest(new URL('http://localhost/api/tasks'))
    const response = apiSuccess(
      req,
      {
        async: true,
        taskId: 'task-2',
      },
      { flattenData: false },
    )

    const body = await response.json()
    expect(body).toMatchObject({
      success: true,
      data: {
        async: true,
        taskId: 'task-2',
      },
    })
    expect(body.async).toBeUndefined()
    expect(body.taskId).toBeUndefined()
  })
})
