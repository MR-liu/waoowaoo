import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiError } from '@/lib/api-errors'
import { buildDefaultTaskBillingInfo } from '@/lib/billing/task-policy'
import { submitTask } from '@/lib/task/submitter'
import { TASK_TYPE } from '@/lib/task/types'
import { prisma } from '../../helpers/prisma'
import { resetBillingState } from '../../helpers/db-reset'
import { createTestProject, createTestUser, seedBalance } from '../../helpers/billing-fixtures'

const addTaskJobMock = vi.hoisted(() => vi.fn(async () => ({ id: 'mock-job' })))
const getQueueTypeByTaskTypeMock = vi.hoisted(() => vi.fn(() => 'voice'))
const metricsMock = vi.hoisted(() => ({
  recordTaskSubmit: vi.fn(),
  recordTaskEnqueueResult: vi.fn(),
}))

vi.mock('@/lib/task/queues', () => ({
  addTaskJob: addTaskJobMock,
  getQueueTypeByTaskType: getQueueTypeByTaskTypeMock,
}))

vi.mock('@/lib/task/publisher', () => ({
  publishTaskEvent: vi.fn(async () => ({})),
}))

vi.mock('@/lib/task/metrics', () => metricsMock)

describe('billing/submitter integration', () => {
  beforeEach(async () => {
    await resetBillingState()
    process.env.BILLING_MODE = 'ENFORCE'
    addTaskJobMock.mockReset()
    addTaskJobMock.mockResolvedValue({ id: 'mock-job' })
    getQueueTypeByTaskTypeMock.mockReset()
    getQueueTypeByTaskTypeMock.mockReturnValue('voice')
    metricsMock.recordTaskSubmit.mockReset()
    metricsMock.recordTaskEnqueueResult.mockReset()
  })

  it('builds billing info server-side for billable task submission', async () => {
    const user = await createTestUser()
    const project = await createTestProject(user.id)
    await seedBalance(user.id, 10)

    const result = await submitTask({
      userId: user.id,
      locale: 'en',
      projectId: project.id,
      type: TASK_TYPE.VOICE_LINE,
      targetType: 'VoiceLine',
      targetId: 'line-a',
      payload: { maxSeconds: 5 },
    })

    expect(result.success).toBe(true)
    const task = await prisma.task.findUnique({ where: { id: result.taskId } })
    expect(task).toBeTruthy()
    const billing = task?.billingInfo as { billable?: boolean; source?: string } | null
    expect(billing?.billable).toBe(true)
    expect(billing?.source).toBe('task')
    expect(metricsMock.recordTaskSubmit).toHaveBeenCalledWith(expect.objectContaining({
      requestId: null,
      projectId: project.id,
      userId: user.id,
      taskType: TASK_TYPE.VOICE_LINE,
      deduped: false,
    }))
    expect(metricsMock.recordTaskEnqueueResult).toHaveBeenCalledWith(expect.objectContaining({
      projectId: project.id,
      userId: user.id,
      taskType: TASK_TYPE.VOICE_LINE,
      queueName: 'voice',
      result: 'enqueued',
    }))
  })

  it('marks task as failed when balance is insufficient', async () => {
    const user = await createTestUser()
    const project = await createTestProject(user.id)
    await seedBalance(user.id, 0)

    const billingInfo = buildDefaultTaskBillingInfo(TASK_TYPE.VOICE_LINE, { maxSeconds: 10 })
    expect(billingInfo?.billable).toBe(true)

    await expect(
      submitTask({
        userId: user.id,
        locale: 'en',
        projectId: project.id,
        type: TASK_TYPE.VOICE_LINE,
        targetType: 'VoiceLine',
        targetId: 'line-b',
        payload: { maxSeconds: 10 },
        billingInfo,
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' } satisfies Pick<ApiError, 'code'>)

    const task = await prisma.task.findFirst({
      where: {
        userId: user.id,
        type: TASK_TYPE.VOICE_LINE,
      },
      orderBy: { createdAt: 'desc' },
    })

    expect(task).toBeTruthy()
    expect(task?.status).toBe('failed')
    expect(task?.errorCode).toBe('INSUFFICIENT_BALANCE')
    expect(metricsMock.recordTaskSubmit).toHaveBeenCalledWith(expect.objectContaining({
      projectId: project.id,
      userId: user.id,
      taskType: TASK_TYPE.VOICE_LINE,
      deduped: false,
    }))
    expect(metricsMock.recordTaskEnqueueResult).not.toHaveBeenCalled()
  })

  it('records enqueue_failed metric when queue submission fails', async () => {
    const user = await createTestUser()
    const project = await createTestProject(user.id)
    await seedBalance(user.id, 10)
    addTaskJobMock.mockRejectedValueOnce(new Error('queue unavailable'))

    await expect(
      submitTask({
        userId: user.id,
        locale: 'en',
        projectId: project.id,
        type: TASK_TYPE.VOICE_LINE,
        targetType: 'VoiceLine',
        targetId: 'line-c',
        payload: { maxSeconds: 5 },
      }),
    ).rejects.toMatchObject({ code: 'EXTERNAL_ERROR' } satisfies Pick<ApiError, 'code'>)

    expect(metricsMock.recordTaskEnqueueResult).toHaveBeenCalledWith(expect.objectContaining({
      projectId: project.id,
      userId: user.id,
      taskType: TASK_TYPE.VOICE_LINE,
      queueName: 'voice',
      result: 'enqueue_failed',
    }))
  })
})
