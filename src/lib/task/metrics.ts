import { createScopedLogger } from '@/lib/logging/core'
import type { TaskLifecycleEventType, TaskStatus } from './types'

const metricsLogger = createScopedLogger({ module: 'task.metrics' })
const UNKNOWN_LABEL = 'unknown'

export const TASK_METRIC = {
  TERMINAL_STATE_MISMATCH_TOTAL: 'task_terminal_state_mismatch_total',
  TRANSITION_DENIED_TOTAL: 'task_transition_denied_total',
  SUBMIT_TOTAL: 'task_submit_total',
  ENQUEUE_TOTAL: 'task_enqueue_total',
  WORKER_LIFECYCLE_TOTAL: 'task_worker_lifecycle_total',
  WORKER_DURATION_MS: 'task_worker_duration_ms',
  EVENT_PUBLISH_TOTAL: 'task_event_publish_total',
  SSE_CONNECTION_TOTAL: 'task_sse_connection_total',
  SSE_REPLAY_EVENTS_TOTAL: 'task_sse_replay_events_total',
  SSE_PAYLOAD_PARSE_FAILED_TOTAL: 'task_sse_payload_parse_failed_total',
  SSE_CONNECTION_DURATION_MS: 'task_sse_connection_duration_ms',
} as const

type TaskMetricName = (typeof TASK_METRIC)[keyof typeof TASK_METRIC]
type TaskMetricLabelValue = string | number | boolean | null | undefined
type TaskMetricLabels = Record<string, TaskMetricLabelValue>

export type TaskTelemetryContextInput = {
  requestId?: string | null
  taskId?: string | null
  projectId?: string | null
  userId?: string | null
}

export type TaskTelemetryContext = {
  requestId: string
  taskId: string
  projectId: string
  userId: string
}

function normalizeLabelValue(value: TaskMetricLabelValue) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : UNKNOWN_LABEL
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized || UNKNOWN_LABEL
}

function normalizeMetricLabels(labels: TaskMetricLabels | undefined): Record<string, string> {
  if (!labels) return {}
  const normalizedEntries = Object.entries(labels).map(([key, value]) => [key, normalizeLabelValue(value)])
  return Object.fromEntries(normalizedEntries)
}

function normalizeCounterValue(value: number | undefined): number {
  if (value === undefined) {
    return 1
  }
  if (!Number.isFinite(value)) {
    return 1
  }
  if (value < 0) {
    return 0
  }
  return value
}

function normalizeHistogramValue(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  return value
}

export function normalizeTaskTelemetryContext(input: TaskTelemetryContextInput): TaskTelemetryContext {
  return {
    requestId: normalizeLabelValue(input.requestId),
    taskId: normalizeLabelValue(input.taskId),
    projectId: normalizeLabelValue(input.projectId),
    userId: normalizeLabelValue(input.userId),
  }
}

function emitTaskCounter(params: {
  metric: TaskMetricName
  labels?: TaskMetricLabels
  context: TaskTelemetryContextInput
  value?: number
  action?: string
  message?: string
}) {
  const context = normalizeTaskTelemetryContext(params.context)
  metricsLogger.info({
    action: params.action || 'task.metric.counter',
    message: params.message || 'task metric counter increment',
    metric: params.metric,
    value: normalizeCounterValue(params.value),
    labels: normalizeMetricLabels(params.labels),
    requestId: context.requestId,
    taskId: context.taskId,
    projectId: context.projectId,
    userId: context.userId,
  })
}

function emitTaskHistogram(params: {
  metric: TaskMetricName
  value: number
  labels?: TaskMetricLabels
  context: TaskTelemetryContextInput
  action?: string
  message?: string
}) {
  const context = normalizeTaskTelemetryContext(params.context)
  metricsLogger.info({
    action: params.action || 'task.metric.histogram',
    message: params.message || 'task metric histogram observed',
    metric: params.metric,
    value: normalizeHistogramValue(params.value),
    labels: normalizeMetricLabels(params.labels),
    requestId: context.requestId,
    taskId: context.taskId,
    projectId: context.projectId,
    userId: context.userId,
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
    context: {
      taskId: params.taskId,
      projectId: params.projectId,
    },
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
    context: {
      taskId: params.taskId,
    },
    labels: {
      source: normalizeLabelValue(params.source),
      reason: params.reason,
      expectedStatuses: normalizeLabelValue(params.expectedStatuses.join('|')),
      currentStatus: normalizeLabelValue(params.currentStatus),
    },
  })
}

export function recordTaskSubmit(params: {
  requestId?: string | null
  taskId: string
  projectId: string
  userId: string
  taskType: string
  deduped: boolean
}) {
  emitTaskCounter({
    metric: TASK_METRIC.SUBMIT_TOTAL,
    context: params,
    labels: {
      taskType: params.taskType,
      result: params.deduped ? 'deduped' : 'created',
    },
  })
}

export function recordTaskEnqueueResult(params: {
  requestId?: string | null
  taskId: string
  projectId: string
  userId: string
  taskType: string
  queueName: string
  result: 'enqueued' | 'enqueue_failed'
}) {
  emitTaskCounter({
    metric: TASK_METRIC.ENQUEUE_TOTAL,
    context: params,
    labels: {
      taskType: params.taskType,
      queue: params.queueName,
      result: params.result,
    },
  })
}

export function recordTaskWorkerLifecycle(params: {
  requestId?: string | null
  taskId: string
  projectId: string
  userId: string
  taskType: string
  queueName: string
  outcome: 'started' | 'completed' | 'failed' | 'retry_scheduled' | 'terminated' | 'skipped_terminal'
}) {
  emitTaskCounter({
    metric: TASK_METRIC.WORKER_LIFECYCLE_TOTAL,
    context: params,
    labels: {
      taskType: params.taskType,
      queue: params.queueName,
      outcome: params.outcome,
    },
  })
}

export function recordTaskWorkerDuration(params: {
  requestId?: string | null
  taskId: string
  projectId: string
  userId: string
  taskType: string
  queueName: string
  outcome: 'completed' | 'failed' | 'retry_scheduled' | 'terminated' | 'skipped_terminal' | 'unknown'
  durationMs: number
}) {
  emitTaskHistogram({
    metric: TASK_METRIC.WORKER_DURATION_MS,
    value: params.durationMs,
    context: params,
    labels: {
      taskType: params.taskType,
      queue: params.queueName,
      outcome: params.outcome,
    },
  })
}

export function recordTaskEventPublish(params: {
  requestId?: string | null
  taskId: string
  projectId: string
  userId: string
  eventType: string
  streamType: 'lifecycle' | 'stream'
  persist: boolean
  result: 'published' | 'failed'
}) {
  emitTaskCounter({
    metric: TASK_METRIC.EVENT_PUBLISH_TOTAL,
    context: params,
    labels: {
      eventType: params.eventType,
      streamType: params.streamType,
      persist: params.persist,
      result: params.result,
    },
  })
}

export function recordTaskSSEConnection(params: {
  requestId?: string | null
  projectId: string
  userId: string
  event: 'connect' | 'disconnect'
  episodeId?: string | null
  lastEventId?: number
}) {
  emitTaskCounter({
    metric: TASK_METRIC.SSE_CONNECTION_TOTAL,
    context: params,
    labels: {
      event: params.event,
      hasEpisodeFilter: Boolean(params.episodeId),
      hasReplayCursor: typeof params.lastEventId === 'number' && params.lastEventId > 0,
    },
  })
}

export function recordTaskSSEReplayEvents(params: {
  requestId?: string | null
  projectId: string
  userId: string
  source: 'replay' | 'snapshot'
  delivered: number
}) {
  emitTaskCounter({
    metric: TASK_METRIC.SSE_REPLAY_EVENTS_TOTAL,
    context: params,
    value: params.delivered,
    labels: {
      source: params.source,
    },
  })
}

export function recordTaskSSEPayloadParseFailed(params: {
  requestId?: string | null
  projectId: string
  userId: string
}) {
  emitTaskCounter({
    metric: TASK_METRIC.SSE_PAYLOAD_PARSE_FAILED_TOTAL,
    context: params,
    labels: {
      reason: 'json_parse_failed',
    },
  })
}

export function recordTaskSSEConnectionDuration(params: {
  requestId?: string | null
  projectId: string
  userId: string
  durationMs: number
  episodeId?: string | null
}) {
  emitTaskHistogram({
    metric: TASK_METRIC.SSE_CONNECTION_DURATION_MS,
    value: params.durationMs,
    context: params,
    labels: {
      hasEpisodeFilter: Boolean(params.episodeId),
    },
  })
}
