import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_STATUS, TASK_TYPE } from '@/lib/task/types'

const reconcileMock = vi.hoisted(() => ({
  isJobAlive: vi.fn(async () => true),
}))

const taskModelMock = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
}))

vi.mock('@/lib/task/reconcile', () => reconcileMock)
vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: taskModelMock,
  },
}))
vi.mock('@/lib/prisma-retry', () => ({
  withPrismaRetry: vi.fn(async <T>(handler: () => Promise<T>) => await handler()),
}))
vi.mock('@/lib/billing', () => ({
  rollbackTaskBilling: vi.fn(async ({ billingInfo }: { billingInfo: unknown }) => billingInfo),
}))

function buildCreateInput() {
  return {
    userId: 'user-1',
    projectId: 'project-1',
    episodeId: null,
    type: TASK_TYPE.ANALYZE_NOVEL,
    targetType: 'NovelPromotionProject',
    targetId: 'project-1',
    payload: { meta: { locale: 'zh' } },
    dedupeKey: 'dedupe-key-1',
  }
}

describe('task service createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fails explicitly when reconcile liveness check errors in dedupe path', async () => {
    taskModelMock.findFirst.mockResolvedValueOnce({
      id: 'task-existing',
      status: TASK_STATUS.QUEUED,
      payload: { meta: { locale: 'zh' } },
      billingInfo: null,
    })
    reconcileMock.isJobAlive.mockRejectedValueOnce(new Error('redis unavailable'))

    const { createTask } = await import('@/lib/task/service')

    await expect(createTask(buildCreateInput())).rejects.toThrow('RECONCILE_CHECK_FAILED')
    expect(taskModelMock.create).not.toHaveBeenCalled()
  })

  it('creates task when no dedupe collision exists', async () => {
    taskModelMock.findFirst.mockResolvedValueOnce(null)
    taskModelMock.create.mockResolvedValueOnce({
      id: 'task-new',
      status: TASK_STATUS.QUEUED,
    })

    const { createTask } = await import('@/lib/task/service')
    const result = await createTask(buildCreateInput())

    expect(result).toMatchObject({
      deduped: false,
      task: {
        id: 'task-new',
        status: TASK_STATUS.QUEUED,
      },
    })
    expect(taskModelMock.create).toHaveBeenCalled()
  })

  it('does not overwrite terminal task status during dedupe race and only releases dedupeKey', async () => {
    taskModelMock.findFirst.mockResolvedValueOnce({
      id: 'task-existing',
      status: TASK_STATUS.QUEUED,
      payload: { meta: { locale: 'zh' } },
      billingInfo: null,
      dedupeKey: 'dedupe-key-1',
    })
    reconcileMock.isJobAlive.mockResolvedValueOnce(false)
    taskModelMock.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })
    taskModelMock.findUnique.mockResolvedValueOnce({
      status: TASK_STATUS.COMPLETED,
      dedupeKey: 'dedupe-key-1',
    })
    taskModelMock.create.mockResolvedValueOnce({
      id: 'task-new-race',
      status: TASK_STATUS.QUEUED,
    })

    const { createTask } = await import('@/lib/task/service')
    const result = await createTask(buildCreateInput())

    expect(result).toMatchObject({
      deduped: false,
      task: {
        id: 'task-new-race',
        status: TASK_STATUS.QUEUED,
      },
    })
    expect(taskModelMock.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'task-existing',
        status: { in: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING] },
      },
      data: {
        status: TASK_STATUS.FAILED,
        errorCode: 'RECONCILE_ORPHAN',
        errorMessage: 'Queue job lost, replaced by new task',
        finishedAt: expect.any(Date),
        heartbeatAt: null,
        dedupeKey: null,
      },
    })
    expect(taskModelMock.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'task-existing',
        status: { in: [TASK_STATUS.COMPLETED, TASK_STATUS.FAILED, TASK_STATUS.DISMISSED] },
        dedupeKey: { not: null },
      },
      data: {
        dedupeKey: null,
      },
    })
    expect(taskModelMock.create).toHaveBeenCalledTimes(1)
  })
})
