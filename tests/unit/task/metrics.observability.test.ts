import { beforeEach, describe, expect, it, vi } from 'vitest'

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/lib/logging/core', () => ({
  createScopedLogger: vi.fn(() => loggerMock),
}))

describe('task metrics observability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('normalizes missing telemetry context fields to unknown labels', async () => {
    const { normalizeTaskTelemetryContext } = await import('@/lib/task/metrics')
    const context = normalizeTaskTelemetryContext({
      projectId: 'project-1',
    })

    expect(context).toEqual({
      requestId: 'unknown',
      taskId: 'unknown',
      projectId: 'project-1',
      userId: 'unknown',
    })
  })

  it('records enqueue failure metric with required identity labels', async () => {
    const { recordTaskEnqueueResult } = await import('@/lib/task/metrics')
    recordTaskEnqueueResult({
      requestId: 'req-1',
      taskId: 'task-1',
      projectId: 'project-1',
      userId: 'user-1',
      taskType: 'voice_line',
      queueName: 'voice',
      result: 'enqueue_failed',
    })

    expect(loggerMock.info).toHaveBeenCalledWith(expect.objectContaining({
      action: 'task.metric.counter',
      metric: 'task_enqueue_total',
      requestId: 'req-1',
      taskId: 'task-1',
      projectId: 'project-1',
      userId: 'user-1',
      labels: {
        taskType: 'voice_line',
        queue: 'voice',
        result: 'enqueue_failed',
      },
    }))
  })

  it('records worker duration histogram and clamps negative duration to zero', async () => {
    const { recordTaskWorkerDuration } = await import('@/lib/task/metrics')
    recordTaskWorkerDuration({
      requestId: 'req-2',
      taskId: 'task-2',
      projectId: 'project-2',
      userId: 'user-2',
      taskType: 'story_to_script_run',
      queueName: 'text',
      outcome: 'failed',
      durationMs: -30,
    })

    expect(loggerMock.info).toHaveBeenCalledWith(expect.objectContaining({
      action: 'task.metric.histogram',
      metric: 'task_worker_duration_ms',
      value: 0,
      requestId: 'req-2',
      taskId: 'task-2',
      projectId: 'project-2',
      userId: 'user-2',
      labels: {
        taskType: 'story_to_script_run',
        queue: 'text',
        outcome: 'failed',
      },
    }))
  })

  it('records sse parse failure metric with normalized identity fields', async () => {
    const { recordTaskSSEPayloadParseFailed } = await import('@/lib/task/metrics')
    recordTaskSSEPayloadParseFailed({
      requestId: null,
      projectId: 'project-3',
      userId: 'user-3',
    })

    expect(loggerMock.info).toHaveBeenCalledWith(expect.objectContaining({
      metric: 'task_sse_payload_parse_failed_total',
      requestId: 'unknown',
      taskId: 'unknown',
      projectId: 'project-3',
      userId: 'user-3',
      labels: {
        reason: 'json_parse_failed',
      },
    }))
  })
})
