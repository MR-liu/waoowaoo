import { beforeEach, describe, expect, it, vi } from 'vitest'

const taskEventFindManyMock = vi.hoisted(() => vi.fn(async () => []))
const taskEventCreateMock = vi.hoisted(() => vi.fn(async () => null))
const taskFindManyMock = vi.hoisted(() => vi.fn(async () => []))
const taskFindUniqueMock = vi.hoisted(() => vi.fn(async () => null))
const redisPublishMock = vi.hoisted(() => vi.fn(async () => 1))
const taskMetricsMock = vi.hoisted(() => ({
  recordTaskTerminalStateMismatch: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    taskEvent: {
      findMany: taskEventFindManyMock,
      create: taskEventCreateMock,
    },
    task: {
      findMany: taskFindManyMock,
      findUnique: taskFindUniqueMock,
    },
  },
}))

vi.mock('@/lib/redis', () => ({
  redis: {
    publish: redisPublishMock,
  },
}))
vi.mock('@/lib/task/metrics', () => taskMetricsMock)

import { listEventsAfter, listTaskLifecycleEvents, publishTaskStreamEvent } from '@/lib/task/publisher'
import { TASK_EVENT_TYPE } from '@/lib/task/types'

describe('task publisher replay', () => {
  beforeEach(() => {
    taskEventFindManyMock.mockReset()
    taskEventCreateMock.mockReset()
    taskFindManyMock.mockReset()
    taskFindUniqueMock.mockReset()
    redisPublishMock.mockReset()
    taskMetricsMock.recordTaskTerminalStateMismatch.mockReset()
  })

  it('replays persisted lifecycle + stream rows in chronological order', async () => {
    taskEventFindManyMock.mockResolvedValueOnce([
      {
        id: 12,
        taskId: 'task-1',
        projectId: 'project-1',
        userId: 'user-1',
        eventType: 'task.stream',
        payload: {
          stepId: 'step-1',
          stream: {
            kind: 'text',
            seq: 2,
            lane: 'main',
            delta: 'world',
          },
        },
        createdAt: new Date('2026-02-27T00:00:02.000Z'),
      },
      {
        id: 11,
        taskId: 'task-1',
        projectId: 'project-1',
        userId: 'user-1',
        eventType: 'task.processing',
        payload: {
          lifecycleType: 'task.processing',
          stepId: 'step-1',
          stepTitle: '阶段1',
        },
        createdAt: new Date('2026-02-27T00:00:01.000Z'),
      },
      {
        id: 10,
        taskId: 'task-1',
        projectId: 'project-1',
        userId: 'user-1',
        eventType: 'task.ignored',
        payload: {},
        createdAt: new Date('2026-02-27T00:00:00.000Z'),
      },
    ])
    taskFindManyMock.mockResolvedValueOnce([
      {
        id: 'task-1',
        type: 'script_to_storyboard_run',
        targetType: 'episode',
        targetId: 'episode-1',
        episodeId: 'episode-1',
      },
    ])

    const events = await listTaskLifecycleEvents('task-1', 50)

    expect(taskEventFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: { taskId: 'task-1' },
      orderBy: { id: 'desc' },
      take: 50,
    }))
    expect(events).toHaveLength(2)
    expect(events.map((event) => event.id)).toEqual(['11', '12'])
    expect(events.map((event) => event.type)).toEqual(['task.lifecycle', 'task.stream'])
    expect((events[1]?.payload as { stream?: { delta?: string } }).stream?.delta).toBe('world')
  })

  it('persists stream rows when persist=true', async () => {
    taskEventCreateMock.mockResolvedValueOnce({
      id: 99,
      taskId: 'task-1',
      projectId: 'project-1',
      userId: 'user-1',
      eventType: 'task.stream',
      payload: {
        stream: {
          kind: 'text',
          seq: 1,
          lane: 'main',
          delta: 'hello',
        },
      },
      createdAt: new Date('2026-02-27T00:00:03.000Z'),
    })
    redisPublishMock.mockResolvedValueOnce(1)

    const message = await publishTaskStreamEvent({
      taskId: 'task-1',
      projectId: 'project-1',
      userId: 'user-1',
      taskType: 'story_to_script_run',
      targetType: 'episode',
      targetId: 'episode-1',
      episodeId: 'episode-1',
      payload: {
        stepId: 'step-1',
        stream: {
          kind: 'text',
          seq: 1,
          lane: 'main',
          delta: 'hello',
        },
      },
      persist: true,
    })

    expect(taskEventCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        taskId: 'task-1',
        eventType: 'task.stream',
      }),
    }))
    expect(redisPublishMock).toHaveBeenCalledTimes(1)
    expect(message?.id).toBe('99')
    expect(message?.type).toBe('task.stream')
    expect(message?.payload?.lifecycleType).toBe(TASK_EVENT_TYPE.PROCESSING)
    expect(typeof message?.payload?.flowId).toBe('string')
    expect(typeof message?.payload?.flowStageIndex).toBe('number')
    expect(typeof message?.payload?.flowStageTotal).toBe('number')
  })

  it('replays lifecycle + stream rows in listEventsAfter', async () => {
    taskEventFindManyMock.mockResolvedValueOnce([
      {
        id: 101,
        taskId: 'task-1',
        projectId: 'project-1',
        userId: 'user-1',
        eventType: 'task.stream',
        payload: {
          stepId: 'step-1',
          stream: {
            kind: 'text',
            seq: 3,
            lane: 'main',
            delta: 'chunk',
          },
        },
        createdAt: new Date('2026-02-27T00:00:03.000Z'),
      },
      {
        id: 102,
        taskId: 'task-1',
        projectId: 'project-1',
        userId: 'user-1',
        eventType: 'task.processing',
        payload: {
          lifecycleType: 'task.processing',
          stepId: 'step-1',
        },
        createdAt: new Date('2026-02-27T00:00:04.000Z'),
      },
    ])
    taskFindManyMock.mockResolvedValueOnce([
      {
        id: 'task-1',
        type: 'story_to_script_run',
        targetType: 'episode',
        targetId: 'episode-1',
        episodeId: 'episode-1',
      },
    ])

    const events = await listEventsAfter('project-1', 100, 20)

    expect(taskEventFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        projectId: 'project-1',
        id: { gt: 100 },
      },
      orderBy: { id: 'asc' },
    }))
    expect(events).toHaveLength(2)
    expect(events.map((event) => event.id)).toEqual(['101', '102'])
    expect(events.map((event) => event.type)).toEqual(['task.stream', 'task.lifecycle'])
    expect((events[0]?.payload as { stream?: { delta?: string } }).stream?.delta).toBe('chunk')
  })

  it('listEventsAfter appends db_reconcile terminal lifecycle when replay misses terminal event', async () => {
    taskEventFindManyMock.mockResolvedValueOnce([
      {
        id: 201,
        taskId: 'task-13',
        projectId: 'project-1',
        userId: 'user-1',
        eventType: 'task.processing',
        payload: {
          lifecycleType: 'task.processing',
          stepId: 'step-1',
          message: 'running',
        },
        createdAt: new Date('2026-02-27T00:00:06.000Z'),
      },
    ])
    taskFindManyMock
      .mockResolvedValueOnce([
        {
          id: 'task-13',
          type: 'story_to_script_run',
          targetType: 'episode',
          targetId: 'episode-1',
          episodeId: 'episode-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'task-13',
          projectId: 'project-1',
          userId: 'user-1',
          type: 'story_to_script_run',
          targetType: 'episode',
          targetId: 'episode-1',
          episodeId: 'episode-1',
          status: 'failed',
          payload: {},
          errorCode: 'INTERNAL_ERROR',
          errorMessage: 'terminal missing in task_events',
          finishedAt: new Date('2026-02-27T00:00:07.000Z'),
          updatedAt: new Date('2026-02-27T00:00:07.000Z'),
        },
      ])

    const events = await listEventsAfter('project-1', 200, 20)

    expect(events).toHaveLength(2)
    expect(events[0]?.id).toBe('201')
    expect(events[1]?.type).toBe('task.lifecycle')
    expect(events[1]?.payload?.source).toBe('db_reconcile')
    expect(events[1]?.payload?.reconcileErrorCode).toBe('TASK_TERMINAL_STATE_MISMATCH')
    expect(events[1]?.payload?.lifecycleType).toBe('task.failed')
    expect(events[1]?.payload?.reconcileReason).toBe('terminal_event_missing')
    expect(taskMetricsMock.recordTaskTerminalStateMismatch).toHaveBeenCalledWith({
      taskId: 'task-13',
      projectId: 'project-1',
      dbStatus: 'failed',
      expectedLifecycleType: 'task.failed',
      replayTerminalLifecycleType: null,
    })
  })

  it('listEventsAfter does not append reconcile event when replay terminal already matches db status', async () => {
    taskEventFindManyMock.mockResolvedValueOnce([
      {
        id: 221,
        taskId: 'task-14',
        projectId: 'project-1',
        userId: 'user-1',
        eventType: 'task.failed',
        payload: {
          lifecycleType: 'task.failed',
          message: 'terminal already persisted',
        },
        createdAt: new Date('2026-02-27T00:00:08.000Z'),
      },
    ])
    taskFindManyMock
      .mockResolvedValueOnce([
        {
          id: 'task-14',
          type: 'story_to_script_run',
          targetType: 'episode',
          targetId: 'episode-1',
          episodeId: 'episode-1',
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'task-14',
          projectId: 'project-1',
          userId: 'user-1',
          type: 'story_to_script_run',
          targetType: 'episode',
          targetId: 'episode-1',
          episodeId: 'episode-1',
          status: 'failed',
          payload: {},
          errorCode: 'INTERNAL_ERROR',
          errorMessage: 'terminal already exists',
          finishedAt: new Date('2026-02-27T00:00:08.000Z'),
          updatedAt: new Date('2026-02-27T00:00:08.000Z'),
        },
      ])

    const events = await listEventsAfter('project-1', 220, 20)

    expect(events).toHaveLength(1)
    expect(events[0]?.id).toBe('221')
    expect(events[0]?.payload?.lifecycleType).toBe('task.failed')
    expect(events[0]?.payload?.source).not.toBe('db_reconcile')
    expect(taskMetricsMock.recordTaskTerminalStateMismatch).not.toHaveBeenCalled()
  })

  it('filters replay query by userId when provided', async () => {
    taskEventFindManyMock.mockResolvedValueOnce([])

    const events = await listEventsAfter('project-1', 100, 20, { userId: 'user-1' })

    expect(events).toEqual([])
    expect(taskEventFindManyMock).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        projectId: 'project-1',
        userId: 'user-1',
        id: { gt: 100 },
      },
      orderBy: { id: 'asc' },
    }))
  })

  it('replays dismissed lifecycle rows with normalized base fields', async () => {
    taskEventFindManyMock.mockResolvedValueOnce([
      {
        id: 301,
        taskId: 'task-9',
        projectId: 'project-1',
        userId: 'user-1',
        eventType: 'task.dismissed',
        payload: {
          message: 'Task dismissed by user',
        },
        createdAt: new Date('2026-02-27T00:00:05.000Z'),
      },
    ])
    taskFindManyMock.mockResolvedValueOnce([
      {
        id: 'task-9',
        type: 'story_to_script_run',
        targetType: 'episode',
        targetId: 'episode-1',
        episodeId: 'episode-1',
      },
    ])

    const events = await listTaskLifecycleEvents('task-9', 20)

    expect(events).toHaveLength(1)
    expect(events[0]?.type).toBe('task.lifecycle')
    expect(events[0]?.payload?.lifecycleType).toBe('task.dismissed')
    expect(typeof events[0]?.payload?.flowId).toBe('string')
    expect(typeof events[0]?.payload?.flowStageIndex).toBe('number')
    expect(typeof events[0]?.payload?.flowStageTotal).toBe('number')
    expect(events[0]?.payload?.intent).toBeTruthy()
  })

  it('appends db_reconcile terminal event when db is terminal but replay lacks terminal lifecycle', async () => {
    taskEventFindManyMock.mockResolvedValueOnce([
      {
        id: 401,
        taskId: 'task-11',
        projectId: 'project-1',
        userId: 'user-1',
        eventType: 'task.processing',
        payload: {
          lifecycleType: 'task.processing',
          stepId: 'step-1',
          message: 'running',
        },
        createdAt: new Date('2026-02-27T00:00:01.000Z'),
      },
    ])
    taskFindManyMock.mockResolvedValueOnce([
      {
        id: 'task-11',
        type: 'story_to_script_run',
        targetType: 'episode',
        targetId: 'episode-1',
        episodeId: 'episode-1',
      },
    ])
    taskFindUniqueMock.mockResolvedValueOnce({
      id: 'task-11',
      projectId: 'project-1',
      userId: 'user-1',
      type: 'story_to_script_run',
      targetType: 'episode',
      targetId: 'episode-1',
      episodeId: 'episode-1',
      status: 'completed',
      payload: {
        flowId: 'story_to_script',
      },
      errorCode: null,
      errorMessage: null,
      finishedAt: new Date('2026-02-27T00:00:02.000Z'),
      updatedAt: new Date('2026-02-27T00:00:02.000Z'),
    })

    const events = await listTaskLifecycleEvents('task-11', 20)

    expect(events).toHaveLength(2)
    expect(events[1]?.type).toBe('task.lifecycle')
    expect(events[1]?.payload?.source).toBe('db_reconcile')
    expect(events[1]?.payload?.reconcileErrorCode).toBe('TASK_TERMINAL_STATE_MISMATCH')
    expect(events[1]?.payload?.lifecycleType).toBe('task.completed')
    expect(taskMetricsMock.recordTaskTerminalStateMismatch).toHaveBeenCalledWith({
      taskId: 'task-11',
      projectId: 'project-1',
      dbStatus: 'completed',
      expectedLifecycleType: 'task.completed',
      replayTerminalLifecycleType: null,
    })
  })

  it('appends db_reconcile terminal event when replay terminal mismatches db status', async () => {
    taskEventFindManyMock.mockResolvedValueOnce([
      {
        id: 501,
        taskId: 'task-12',
        projectId: 'project-1',
        userId: 'user-1',
        eventType: 'task.failed',
        payload: {
          lifecycleType: 'task.failed',
          message: 'old failed terminal',
        },
        createdAt: new Date('2026-02-27T00:00:01.000Z'),
      },
    ])
    taskFindManyMock.mockResolvedValueOnce([
      {
        id: 'task-12',
        type: 'story_to_script_run',
        targetType: 'episode',
        targetId: 'episode-1',
        episodeId: 'episode-1',
      },
    ])
    taskFindUniqueMock.mockResolvedValueOnce({
      id: 'task-12',
      projectId: 'project-1',
      userId: 'user-1',
      type: 'story_to_script_run',
      targetType: 'episode',
      targetId: 'episode-1',
      episodeId: 'episode-1',
      status: 'completed',
      payload: {},
      errorCode: null,
      errorMessage: null,
      finishedAt: new Date('2026-02-27T00:00:03.000Z'),
      updatedAt: new Date('2026-02-27T00:00:03.000Z'),
    })

    const events = await listTaskLifecycleEvents('task-12', 20)

    expect(events).toHaveLength(2)
    expect(events[0]?.payload?.lifecycleType).toBe('task.failed')
    expect(events[1]?.payload?.source).toBe('db_reconcile')
    expect(events[1]?.payload?.reconcileReason).toBe('terminal_event_mismatch')
    expect(events[1]?.payload?.replayTerminalLifecycleType).toBe('task.failed')
    expect(events[1]?.payload?.lifecycleType).toBe('task.completed')
    expect(taskMetricsMock.recordTaskTerminalStateMismatch).toHaveBeenCalledWith({
      taskId: 'task-12',
      projectId: 'project-1',
      dbStatus: 'completed',
      expectedLifecycleType: 'task.completed',
      replayTerminalLifecycleType: 'task.failed',
    })
  })
})
