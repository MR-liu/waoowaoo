import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaTaskFindManyMock = vi.hoisted(() => vi.fn(async () => []))
const addTaskJobMock = vi.hoisted(() => vi.fn(async () => null))
const resetProcessingTasksToQueuedOnStartupMock = vi.hoisted(() => vi.fn(async () => 0))
const markTaskEnqueuedMock = vi.hoisted(() => vi.fn(async () => true))
const markTaskEnqueueFailedMock = vi.hoisted(() => vi.fn(async () => true))
const tryMarkTaskFailedMock = vi.hoisted(() => vi.fn(async () => true))
const startTaskWatchdogMock = vi.hoisted(() => vi.fn())
const logInfoMock = vi.hoisted(() => vi.fn())
const logErrorMock = vi.hoisted(() => vi.fn())
const logWarnMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      findMany: prismaTaskFindManyMock,
    },
  },
}))

vi.mock('@/lib/task/queues', () => ({
  addTaskJob: addTaskJobMock,
}))

vi.mock('@/lib/task/service', () => ({
  resetProcessingTasksToQueuedOnStartup: resetProcessingTasksToQueuedOnStartupMock,
  markTaskEnqueued: markTaskEnqueuedMock,
  markTaskEnqueueFailed: markTaskEnqueueFailedMock,
  tryMarkTaskFailed: tryMarkTaskFailedMock,
}))

vi.mock('@/lib/task/reconcile', () => ({
  startTaskWatchdog: startTaskWatchdogMock,
}))

vi.mock('@/lib/logging/core', () => ({
  logInfo: logInfoMock,
  logError: logErrorMock,
  logWarn: logWarnMock,
}))

const originalNextRuntime = process.env.NEXT_RUNTIME

describe('instrumentation register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.NEXT_RUNTIME = 'nodejs'
    prismaTaskFindManyMock.mockResolvedValue([])
    resetProcessingTasksToQueuedOnStartupMock.mockResolvedValue(0)
    addTaskJobMock.mockResolvedValue(null)
    markTaskEnqueuedMock.mockResolvedValue(true)
    markTaskEnqueueFailedMock.mockResolvedValue(true)
    tryMarkTaskFailedMock.mockResolvedValue(true)
  })

  afterAll(() => {
    process.env.NEXT_RUNTIME = originalNextRuntime
  })

  it('resets processing tasks via task service on startup', async () => {
    resetProcessingTasksToQueuedOnStartupMock.mockResolvedValueOnce(2)

    const { register } = await import('@/instrumentation')
    await register()

    expect(resetProcessingTasksToQueuedOnStartupMock).toHaveBeenCalledTimes(1)
    expect(logInfoMock).toHaveBeenCalledWith('[Instrumentation] Reset 2 processing tasks to queued')
  })

  it('re-enqueues queued tasks and marks enqueue metadata via task service', async () => {
    prismaTaskFindManyMock.mockResolvedValueOnce([
      {
        id: 'task-1',
        userId: 'user-1',
        projectId: 'project-1',
        episodeId: 'episode-1',
        type: 'analyze_novel',
        targetType: 'NovelPromotionProject',
        targetId: 'project-1',
        payload: { meta: { locale: 'zh' } },
        billingInfo: null,
        priority: 3,
      },
    ])

    const { register } = await import('@/instrumentation')
    await register()

    expect(addTaskJobMock).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-1',
      type: 'analyze_novel',
      locale: 'zh',
      projectId: 'project-1',
      userId: 'user-1',
    }), expect.objectContaining({
      priority: 3,
    }))
    expect(markTaskEnqueuedMock).toHaveBeenCalledWith('task-1')
    expect(tryMarkTaskFailedMock).not.toHaveBeenCalled()
    expect(startTaskWatchdogMock).toHaveBeenCalledTimes(1)
  })

  it('marks queued task failed when task type is invalid', async () => {
    prismaTaskFindManyMock.mockResolvedValueOnce([
      {
        id: 'task-invalid',
        userId: 'user-1',
        projectId: 'project-1',
        episodeId: null,
        type: 'unknown_type',
        targetType: 'NovelPromotionProject',
        targetId: 'project-1',
        payload: { meta: { locale: 'zh' } },
        billingInfo: null,
        priority: 0,
      },
    ])

    const { register } = await import('@/instrumentation')
    await register()

    expect(tryMarkTaskFailedMock).toHaveBeenCalledWith(
      'task-invalid',
      'INVALID_TASK_TYPE',
      'invalid task type: unknown_type',
    )
    expect(addTaskJobMock).not.toHaveBeenCalled()
    expect(markTaskEnqueuedMock).not.toHaveBeenCalled()
  })

  it('marks queued task failed when locale is missing', async () => {
    prismaTaskFindManyMock.mockResolvedValueOnce([
      {
        id: 'task-no-locale',
        userId: 'user-1',
        projectId: 'project-1',
        episodeId: null,
        type: 'analyze_novel',
        targetType: 'NovelPromotionProject',
        targetId: 'project-1',
        payload: {},
        billingInfo: null,
        priority: 0,
      },
    ])

    const { register } = await import('@/instrumentation')
    await register()

    expect(tryMarkTaskFailedMock).toHaveBeenCalledWith(
      'task-no-locale',
      'TASK_LOCALE_REQUIRED',
      'task locale is missing',
    )
    expect(addTaskJobMock).not.toHaveBeenCalled()
  })

  it('records enqueue failure through task service when addTaskJob throws', async () => {
    prismaTaskFindManyMock.mockResolvedValueOnce([
      {
        id: 'task-enqueue-error',
        userId: 'user-1',
        projectId: 'project-1',
        episodeId: null,
        type: 'analyze_novel',
        targetType: 'NovelPromotionProject',
        targetId: 'project-1',
        payload: { meta: { locale: 'zh' } },
        billingInfo: null,
        priority: 0,
      },
    ])
    addTaskJobMock.mockRejectedValueOnce(new Error('redis down'))

    const { register } = await import('@/instrumentation')
    await register()

    expect(markTaskEnqueueFailedMock).toHaveBeenCalledWith('task-enqueue-error', 'redis down')
    expect(markTaskEnqueuedMock).not.toHaveBeenCalled()
  })
})
