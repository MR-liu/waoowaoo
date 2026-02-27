import { beforeEach, describe, expect, it, vi } from 'vitest'

const taskFindManyMock = vi.hoisted(() => vi.fn(async () => []))
const imageGetJobMock = vi.hoisted(() => vi.fn(async () => null))
const videoGetJobMock = vi.hoisted(() => vi.fn(async () => null))
const voiceGetJobMock = vi.hoisted(() => vi.fn(async () => null))
const textGetJobMock = vi.hoisted(() => vi.fn(async () => null))
const failActiveTaskWithDedupeReleaseMock = vi.hoisted(() => vi.fn(async () => true))
const rollbackTaskBillingForTaskMock = vi.hoisted(() =>
  vi.fn(async () => ({ attempted: false, rolledBack: true, billingInfo: null }))
)
const publishTaskEventMock = vi.hoisted(() => vi.fn(async () => null))
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    task: {
      findMany: taskFindManyMock,
    },
  },
}))

vi.mock('@/lib/logging/core', () => ({
  createScopedLogger: vi.fn(() => loggerMock),
}))

vi.mock('@/lib/task/queues', () => ({
  imageQueue: {
    name: 'image',
    getJob: imageGetJobMock,
  },
  videoQueue: {
    name: 'video',
    getJob: videoGetJobMock,
  },
  voiceQueue: {
    name: 'voice',
    getJob: voiceGetJobMock,
  },
  textQueue: {
    name: 'text',
    getJob: textGetJobMock,
  },
}))

vi.mock('@/lib/task/service', () => ({
  failActiveTaskWithDedupeRelease: failActiveTaskWithDedupeReleaseMock,
  rollbackTaskBillingForTask: rollbackTaskBillingForTaskMock,
}))

vi.mock('@/lib/task/publisher', () => ({
  publishTaskEvent: publishTaskEventMock,
}))

type QueueJobState = 'waiting' | 'active' | 'delayed' | 'waiting-children' | 'completed' | 'failed'

function createQueueJob(state: QueueJobState) {
  return {
    getState: vi.fn(async () => state),
  }
}

describe('task reconcile queue state guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taskFindManyMock.mockResolvedValue([])
    imageGetJobMock.mockResolvedValue(null)
    videoGetJobMock.mockResolvedValue(null)
    voiceGetJobMock.mockResolvedValue(null)
    textGetJobMock.mockResolvedValue(null)
    failActiveTaskWithDedupeReleaseMock.mockResolvedValue(true)
    rollbackTaskBillingForTaskMock.mockResolvedValue({
      attempted: false,
      rolledBack: true,
      billingInfo: null,
    })
  })

  it('fails explicitly when queue state checks error and task liveness is uncertain', async () => {
    imageGetJobMock.mockRejectedValue(new Error('redis down'))
    videoGetJobMock.mockRejectedValue(new Error('redis down'))
    voiceGetJobMock.mockRejectedValue(new Error('redis down'))
    textGetJobMock.mockRejectedValue(new Error('redis down'))

    const { isJobAlive } = await import('@/lib/task/reconcile')

    await expect(isJobAlive('task-err')).rejects.toThrow('RECONCILE_QUEUE_CHECK_FAILED')
    expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({
      action: 'task.reconcile.job_state.failed',
      taskId: 'task-err',
      errorCode: 'RECONCILE_QUEUE_CHECK_FAILED',
    }))
  })

  it('returns alive when any queue confirms active state even if previous queue errored', async () => {
    imageGetJobMock.mockRejectedValue(new Error('redis timeout'))
    videoGetJobMock.mockResolvedValue(createQueueJob('active'))

    const { isJobAlive } = await import('@/lib/task/reconcile')

    await expect(isJobAlive('task-alive')).resolves.toBe(true)
  })

  it('skips reconcile update when queue state check fails for a task', async () => {
    taskFindManyMock.mockResolvedValue([
      {
        id: 'task-1',
        userId: 'user-1',
        projectId: 'project-1',
        episodeId: 'episode-1',
        type: 'story_to_script_run',
        targetType: 'episode',
        targetId: 'episode-1',
        billingInfo: null,
        updatedAt: new Date(0),
      },
    ])
    imageGetJobMock.mockRejectedValue(new Error('redis unavailable'))
    videoGetJobMock.mockRejectedValue(new Error('redis unavailable'))
    voiceGetJobMock.mockRejectedValue(new Error('redis unavailable'))
    textGetJobMock.mockRejectedValue(new Error('redis unavailable'))

    const { reconcileActiveTasks } = await import('@/lib/task/reconcile')
    const reconciled = await reconcileActiveTasks()

    expect(reconciled).toEqual([])
    expect(failActiveTaskWithDedupeReleaseMock).not.toHaveBeenCalled()
    expect(loggerMock.error).toHaveBeenCalledWith(expect.objectContaining({
      action: 'task.reconcile.task_state_check.failed',
      taskId: 'task-1',
      projectId: 'project-1',
      errorCode: 'RECONCILE_QUEUE_CHECK_FAILED',
    }))
  })

  it('fails orphan task when queue confirms missing state and grace window already passed', async () => {
    taskFindManyMock.mockResolvedValue([
      {
        id: 'task-2',
        userId: 'user-2',
        projectId: 'project-2',
        episodeId: 'episode-2',
        type: 'story_to_script_run',
        targetType: 'episode',
        targetId: 'episode-2',
        billingInfo: null,
        updatedAt: new Date(0),
      },
    ])

    const { reconcileActiveTasks } = await import('@/lib/task/reconcile')
    const reconciled = await reconcileActiveTasks()

    expect(reconciled).toEqual(['task-2'])
    expect(rollbackTaskBillingForTaskMock).toHaveBeenCalledWith({
      taskId: 'task-2',
      billingInfo: null,
    })
    expect(failActiveTaskWithDedupeReleaseMock).toHaveBeenCalledWith({
      taskId: 'task-2',
      errorCode: 'RECONCILE_ORPHAN',
      errorMessage: 'Queue job missing (likely lost during restart)',
      source: 'reconcile_orphan',
    })
    expect(publishTaskEventMock).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task-2',
      projectId: 'project-2',
      userId: 'user-2',
      type: 'task.failed',
    }))
  })
})
