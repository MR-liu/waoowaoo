import { describe, expect, it, vi, beforeEach } from 'vitest'

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/lib/logging/core', () => ({
  createScopedLogger: vi.fn(() => loggerMock),
}))

describe('task metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('records terminal mismatch counter with normalized labels', async () => {
    const { recordTaskTerminalStateMismatch } = await import('@/lib/task/metrics')
    recordTaskTerminalStateMismatch({
      taskId: 'task-1',
      projectId: 'project-1',
      dbStatus: 'failed',
      expectedLifecycleType: 'task.failed',
      replayTerminalLifecycleType: null,
    })

    expect(loggerMock.info).toHaveBeenCalledWith(expect.objectContaining({
      action: 'task.metric.counter',
      metric: 'task_terminal_state_mismatch_total',
      taskId: 'task-1',
      projectId: 'project-1',
      labels: {
        reason: 'terminal_event_missing',
        dbStatus: 'failed',
        expectedLifecycleType: 'task.failed',
        replayTerminalLifecycleType: 'unknown',
      },
    }))
  })

  it('records transition denied counter with reason labels', async () => {
    const { recordTaskTransitionDenied } = await import('@/lib/task/metrics')
    recordTaskTransitionDenied({
      taskId: 'task-2',
      source: 'processing',
      expectedStatuses: ['queued', 'processing'],
      currentStatus: 'dismissed',
      reason: 'status_mismatch',
    })

    expect(loggerMock.info).toHaveBeenCalledWith(expect.objectContaining({
      action: 'task.metric.counter',
      metric: 'task_transition_denied_total',
      taskId: 'task-2',
      labels: {
        source: 'processing',
        reason: 'status_mismatch',
        expectedStatuses: 'queued|processing',
        currentStatus: 'dismissed',
      },
    }))
  })
})
