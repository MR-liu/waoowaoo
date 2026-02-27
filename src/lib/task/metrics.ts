import { createScopedLogger } from '@/lib/logging/core'
import type { TaskLifecycleEventType, TaskStatus } from './types'

const metricsLogger = createScopedLogger({ module: 'task.metrics' })

const TASK_METRIC = {
  TERMINAL_STATE_MISMATCH_TOTAL: 'task_terminal_state_mismatch_total',
  TRANSITION_DENIED_TOTAL: 'task_transition_denied_total',
} as const

type TaskMetricName = (typeof TASK_METRIC)[keyof typeof TASK_METRIC]

function normalizeLabelValue(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || 'unknown'
}

function emitTaskCounter(params: {
  metric: TaskMetricName
  labels: Record<string, string>
  taskId: string
  projectId?: string | null
}) {
  metricsLogger.info({
    action: 'task.metric.counter',
    message: 'task metric counter increment',
    metric: params.metric,
    labels: params.labels,
    taskId: params.taskId,
    projectId: params.projectId || null,
  })
}

export function recordTaskTerminalStateMismatch(params: {
  taskId: string
  projectId: string
  dbStatus: string
  expectedLifecycleType: TaskLifecycleEventType
  replayTerminalLifecycleType: TaskLifecycleEventType | null
}) {
  emitTaskCounter({
    metric: TASK_METRIC.TERMINAL_STATE_MISMATCH_TOTAL,
    taskId: params.taskId,
    projectId: params.projectId,
    labels: {
      reason: params.replayTerminalLifecycleType ? 'terminal_event_mismatch' : 'terminal_event_missing',
      dbStatus: normalizeLabelValue(params.dbStatus),
      expectedLifecycleType: normalizeLabelValue(params.expectedLifecycleType),
      replayTerminalLifecycleType: normalizeLabelValue(params.replayTerminalLifecycleType),
    },
  })
}

export function recordTaskTransitionDenied(params: {
  taskId: string
  source: string
  expectedStatuses: readonly TaskStatus[]
  currentStatus: string | null
  reason: 'status_mismatch' | 'task_missing'
}) {
  emitTaskCounter({
    metric: TASK_METRIC.TRANSITION_DENIED_TOTAL,
    taskId: params.taskId,
    labels: {
      source: normalizeLabelValue(params.source),
      reason: params.reason,
      expectedStatuses: normalizeLabelValue(params.expectedStatuses.join('|')),
      currentStatus: normalizeLabelValue(params.currentStatus),
    },
  })
}
