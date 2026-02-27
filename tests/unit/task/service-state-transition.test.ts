import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TASK_STATUS } from '@/lib/task/types'

const taskModelMock = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  updateMany: vi.fn(),
}))
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))
const metricsMock = vi.hoisted(() => ({
  recordTaskTransitionDenied: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: taskModelMock,
  },
}))
vi.mock('@/lib/logging/core', () => ({
  createScopedLogger: vi.fn(() => loggerMock),
}))
vi.mock('@/lib/task/metrics', () => metricsMock)
vi.mock('@/lib/prisma-retry', () => ({
  withPrismaRetry: vi.fn(async <T>(handler: () => Promise<T>) => await handler()),
}))
vi.mock('@/lib/billing', () => ({
  rollbackTaskBilling: vi.fn(async ({ billingInfo }: { billingInfo: unknown }) => billingInfo),
}))

describe('task service transition guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taskModelMock.updateMany.mockResolvedValue({ count: 1 })
  })

  it('restricts processing transition source to queued/processing', async () => {
    const { tryMarkTaskProcessing } = await import('@/lib/task/service')
    const ok = await tryMarkTaskProcessing('task-1', 'ext-1')

    expect(ok).toBe(true)
    expect(taskModelMock.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'task-1',
        status: { in: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING] },
      },
      data: {
        status: TASK_STATUS.PROCESSING,
        startedAt: expect.any(Date),
        heartbeatAt: expect.any(Date),
        externalId: 'ext-1',
        attempt: { increment: 1 },
      },
    })
  })

  it('sets externalId only when task is processing and externalId is empty', async () => {
    const { trySetTaskExternalId } = await import('@/lib/task/service')
    const ok = await trySetTaskExternalId('task-2', ' ext-2 ')

    expect(ok).toBe(true)
    expect(taskModelMock.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'task-2',
        status: { in: [TASK_STATUS.PROCESSING] },
        OR: [{ externalId: null }, { externalId: '' }],
      },
      data: {
        externalId: 'ext-2',
      },
    })
  })

  it('rejects empty externalId without touching DB', async () => {
    const { trySetTaskExternalId } = await import('@/lib/task/service')
    const ok = await trySetTaskExternalId('task-3', '   ')

    expect(ok).toBe(false)
    expect(taskModelMock.updateMany).not.toHaveBeenCalled()
  })

  it('updates heartbeat only for processing tasks', async () => {
    const { touchTaskHeartbeat } = await import('@/lib/task/service')
    const ok = await touchTaskHeartbeat('task-4')

    expect(ok).toBe(true)
    expect(taskModelMock.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'task-4',
        status: { in: [TASK_STATUS.PROCESSING] },
      },
      data: { heartbeatAt: expect.any(Date) },
    })
  })

  it('updates progress only for processing tasks', async () => {
    const { tryUpdateTaskProgress } = await import('@/lib/task/service')
    const ok = await tryUpdateTaskProgress('task-5', 45, { stage: 'rendering' })

    expect(ok).toBe(true)
    expect(taskModelMock.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'task-5',
        status: { in: [TASK_STATUS.PROCESSING] },
      },
      data: {
        progress: 45,
        payload: { stage: 'rendering' },
      },
    })
  })

  it('marks completed only from processing status', async () => {
    const { tryMarkTaskCompleted } = await import('@/lib/task/service')
    const ok = await tryMarkTaskCompleted('task-6', { result: 'ok' })

    expect(ok).toBe(true)
    expect(taskModelMock.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'task-6',
        status: { in: [TASK_STATUS.PROCESSING] },
      },
      data: {
        status: TASK_STATUS.COMPLETED,
        progress: 100,
        result: { result: 'ok' },
        finishedAt: expect.any(Date),
        heartbeatAt: null,
      },
    })
  })

  it('marks failed from queued/processing statuses', async () => {
    const { tryMarkTaskFailed } = await import('@/lib/task/service')
    const ok = await tryMarkTaskFailed('task-7', 'ERR_SAMPLE', 'sample error')

    expect(ok).toBe(true)
    expect(taskModelMock.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'task-7',
        status: { in: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING] },
      },
      data: {
        status: TASK_STATUS.FAILED,
        errorCode: 'ERR_SAMPLE',
        errorMessage: 'sample error',
        finishedAt: expect.any(Date),
        heartbeatAt: null,
      },
    })
  })

  it('updates enqueue metadata only for queued status', async () => {
    const { markTaskEnqueued, markTaskEnqueueFailed } = await import('@/lib/task/service')

    await markTaskEnqueued('task-8')
    expect(taskModelMock.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'task-8',
        status: { in: [TASK_STATUS.QUEUED] },
      },
      data: {
        enqueuedAt: expect.any(Date),
        lastEnqueueError: null,
      },
    })

    await markTaskEnqueueFailed('task-8', 'e'.repeat(600))
    expect(taskModelMock.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: 'task-8',
        status: { in: [TASK_STATUS.QUEUED] },
      },
      data: {
        enqueueAttempts: { increment: 1 },
        lastEnqueueError: 'e'.repeat(500),
      },
    })
  })

  it('resets processing tasks to queued on startup through service entry', async () => {
    taskModelMock.updateMany.mockResolvedValueOnce({ count: 3 })
    const { resetProcessingTasksToQueuedOnStartup } = await import('@/lib/task/service')

    const count = await resetProcessingTasksToQueuedOnStartup()

    expect(count).toBe(3)
    expect(taskModelMock.updateMany).toHaveBeenCalledWith({
      where: {
        status: TASK_STATUS.PROCESSING,
      },
      data: {
        status: TASK_STATUS.QUEUED,
        startedAt: null,
        heartbeatAt: null,
      },
    })
  })

  it('dismisses failed tasks with terminal metadata and returns dismissed rows', async () => {
    const { dismissFailedTasksWithDetails } = await import('@/lib/task/service')
    taskModelMock.findMany
      .mockResolvedValueOnce([
        {
          id: 'task-9',
          userId: 'user-1',
          projectId: 'project-1',
          type: 'story_to_script_run',
          targetType: 'NovelPromotionEpisode',
          targetId: 'episode-1',
          episodeId: 'episode-1',
          payload: { flowId: 'novel_promotion_generation' },
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'task-9',
          userId: 'user-1',
          projectId: 'project-1',
          type: 'story_to_script_run',
          targetType: 'NovelPromotionEpisode',
          targetId: 'episode-1',
          episodeId: 'episode-1',
          payload: { flowId: 'novel_promotion_generation' },
        },
      ])
    taskModelMock.updateMany.mockResolvedValueOnce({ count: 1 })

    const rows = await dismissFailedTasksWithDetails(['task-9', 'task-9'], 'user-1')

    expect(taskModelMock.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['task-9'] },
        userId: 'user-1',
        status: TASK_STATUS.FAILED,
      },
      data: {
        status: TASK_STATUS.DISMISSED,
        finishedAt: expect.any(Date),
        heartbeatAt: null,
      },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe('task-9')
  })

  it('denies terminal-state transitions when update count is zero (e.g. dismissed task)', async () => {
    taskModelMock.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 })
    taskModelMock.findUnique
      .mockResolvedValueOnce({ status: TASK_STATUS.DISMISSED })
      .mockResolvedValueOnce({ status: TASK_STATUS.DISMISSED })
      .mockResolvedValueOnce({ status: TASK_STATUS.DISMISSED })

    const { tryMarkTaskProcessing, tryMarkTaskCompleted, tryMarkTaskFailed } = await import('@/lib/task/service')

    await expect(tryMarkTaskProcessing('task-terminal')).resolves.toBe(false)
    await expect(tryMarkTaskCompleted('task-terminal', { ok: true })).resolves.toBe(false)
    await expect(tryMarkTaskFailed('task-terminal', 'ERR_TERMINAL', 'terminal task')).resolves.toBe(false)

    const statusInSets = taskModelMock.updateMany.mock.calls
      .map((call) => {
        const arg = call[0] as {
          where?: { status?: { in?: string[] } }
        }
        return arg.where?.status?.in || []
      })
      .flat()

    expect(statusInSets).not.toContain(TASK_STATUS.DISMISSED)
    expect(statusInSets).not.toContain(TASK_STATUS.COMPLETED)
    expect(taskModelMock.findUnique).toHaveBeenCalledTimes(3)
    expect(metricsMock.recordTaskTransitionDenied).toHaveBeenNthCalledWith(1, {
      taskId: 'task-terminal',
      source: 'processing',
      expectedStatuses: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING],
      currentStatus: TASK_STATUS.DISMISSED,
      reason: 'status_mismatch',
    })
    expect(metricsMock.recordTaskTransitionDenied).toHaveBeenNthCalledWith(2, {
      taskId: 'task-terminal',
      source: 'completed',
      expectedStatuses: [TASK_STATUS.PROCESSING],
      currentStatus: TASK_STATUS.DISMISSED,
      reason: 'status_mismatch',
    })
    expect(metricsMock.recordTaskTransitionDenied).toHaveBeenNthCalledWith(3, {
      taskId: 'task-terminal',
      source: 'failed',
      expectedStatuses: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING],
      currentStatus: TASK_STATUS.DISMISSED,
      reason: 'status_mismatch',
    })
    expect(loggerMock.warn).toHaveBeenNthCalledWith(1, expect.objectContaining({
      action: 'task.transition.denied',
      taskId: 'task-terminal',
      source: 'processing',
      expectedStatuses: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING],
      currentStatus: TASK_STATUS.DISMISSED,
      details: { operation: 'tryMarkTaskProcessing' },
    }))
    expect(loggerMock.warn).toHaveBeenNthCalledWith(2, expect.objectContaining({
      action: 'task.transition.denied',
      taskId: 'task-terminal',
      source: 'completed',
      expectedStatuses: [TASK_STATUS.PROCESSING],
      currentStatus: TASK_STATUS.DISMISSED,
      details: { operation: 'tryMarkTaskCompleted' },
    }))
    expect(loggerMock.warn).toHaveBeenNthCalledWith(3, expect.objectContaining({
      action: 'task.transition.denied',
      taskId: 'task-terminal',
      source: 'failed',
      expectedStatuses: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING],
      currentStatus: TASK_STATUS.DISMISSED,
      details: { operation: 'tryMarkTaskFailed' },
    }))
  })

  it('logs missing-task transition denial payload when status guard cannot find task', async () => {
    taskModelMock.updateMany.mockResolvedValueOnce({ count: 0 })
    taskModelMock.findUnique.mockResolvedValueOnce(null)

    const { tryMarkTaskFailed } = await import('@/lib/task/service')
    await expect(tryMarkTaskFailed('task-missing', 'ERR_MISSING', 'missing task')).resolves.toBe(false)

    expect(loggerMock.warn).toHaveBeenCalledWith(expect.objectContaining({
      action: 'task.transition.denied.missing',
      taskId: 'task-missing',
      source: 'failed',
      expectedStatuses: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING],
      details: { operation: 'tryMarkTaskFailed' },
    }))
    expect(metricsMock.recordTaskTransitionDenied).toHaveBeenCalledWith({
      taskId: 'task-missing',
      source: 'failed',
      expectedStatuses: [TASK_STATUS.QUEUED, TASK_STATUS.PROCESSING],
      currentStatus: null,
      reason: 'task_missing',
    })
  })
})
